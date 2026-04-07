# 本地跨平台加密记事本 — 设计文档

**日期**: 2026-03-27
**状态**: 已批准

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────┐
│                     Electron 主进程                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  文件加密模块   │  │  数据库模块   │  │  IPC 桥接  │ │
│  │ (AES-256-CBC) │  │  (SQLite) │  │           │ │
│  │ + AES-256-GCM│  └──────────────┘  └───────────┘ │
│  └──────────────┘
└─────────────────────────────────────────────────────┘
                         │ IPC
┌─────────────────────────────────────────────────────┐
│                    Vue 3 渲染进程                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐  │
│  │ 树形导航  │  │ 笔记列表  │  │   编辑器/查看器     │  │
│  │(文件夹树) │  │(列表视图) │  │(支持纯文本/MD/富文本)│  │
│  └─────────┘  └─────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**设计原则**：
- 所有敏感数据仅存在于主进程，渲染进程无状态
- 内容文件按需加载，不在列表中暴露明文
- 主密钥存于主进程内存，不写入磁盘

---

## 二、技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端框架 | Vue 3 |
| 构建工具 | Vite + electron-builder |
| 数据库 | better-sqlite3 |
| 加密 | AES-256-CBC（密码验证），AES-256-GCM（内容+附件） |
| 密钥派生 | Argon2id |
| 富文本 | TipTap |
| Markdown | markdown-it + 实时预览 |
| 样式 | 极简 CSS，无 UI 框架 |

---

## 三、数据结构

### 3.1 SQLite 元数据表

```sql
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  created_at INTEGER,
  updated_at INTEGER,
  deleted_at INTEGER DEFAULT NULL  -- 逻辑删除时间戳，NULL=正常，非NULL=已在回收站
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT DEFAULT 'plain',
  has_attachments INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  deleted_at INTEGER DEFAULT NULL  -- 逻辑删除时间戳，NULL=正常，非NULL=已在回收站
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  created_at INTEGER
);
```

### 3.2 内容文件结构

```
userData/
├── vault.salt              -- 128位Salt (16字节) + IV (16字节) + test_vector密文 (32字节)
├── metadata.db              -- SQLite 元数据（整体加密）
└── vault/
    ├── contents/
    │   └── {尾2字符哈希}/
    │       └── {note_id}.enc
    └── attachments/
        └── {尾2字符哈希}/
            └── {attachment_id}.enc
```

- **vault.salt**：Salt（前 16 字节）+ IV（前 16 字节）+ test_vector 密文（32 字节）
  - Salt：128 位随机 Salt，首次创建主密码时随机生成
  - IV：128 位随机 IV，用于 AES-256-GCM 加密 test_vector
  - test_vector：SHA-256_hash（派生 AES-256 主密钥 + Salt，10 万次迭代）的密文，用 AES-256-GCM 加密
  - **验证流程（必须完整比对内容才能判断密钥正确性）**：
    1. 用户输入密码 P' → Argon2id(P', Salt) → 派生 AES-256 主密钥 K'
    2. 用 K' 和 IV 通过 AES-256-GCM 解密 test_vector → 得到 H'（**解密永远成功，即使密钥错误也返回 garbage**）
    3. 独立计算 SHA-256(K' + Salt, 100000 次) → 得到 H_expected
    4. H' == H_expected → 主密钥正确 → 解锁成功
    5. 任何一步不匹配 → 解锁失败
  - **设计优势**：攻击者无法绕过 Argon2id 派生主密钥直接破解；AES-256-GCM 自带认证验证防篡改，伪造 test_vector 需要 2^256 次尝试

- **尾2字符哈希**：取 ID 的末尾两位字符作为子目录名，均匀分布
- 例：`note_id = "abc123"` → `vault/contents/23/abc123.enc`
- 每篇笔记内容单独加密文件，点击标题时按需解密

### 3.3 主密码密钥派生与安全存储

- 使用 **Argon2id**（内存 128MB，迭代 3 次，parallelism 4）从主密码派生 AES-256 主密钥
  - 参数选择参考 OWASP 建议，足以抵抗GPU/ASIC/FPGA 暴力破解
  - Salt 存储在 `userData/vault.salt`，128 位随机 Salt，首次创建主密码时随机生成
- **用户主密码不保存在任何地方**——不存储明文，不存储哈希，不存储派生过程中的任何中间值
- 验证通过后 AES-256 主密钥存入主进程内存（heap），永不写入磁盘
- 应用退出、锁定或崩溃时，主密钥由 Node.js 内存管理自动清除（不依赖显式清零）

---

## 四、安全流程

**首次创建主密码时：**
```
用户输入密码 P
    ↓
Salt = random(16 bytes)
IV = random(16 bytes)
    ↓
K = Argon2id(P, Salt)
    ↓
H = SHA-256(K + Salt, iterations=100000)  ← 慢哈希
    ↓
test_vector = AES-256-GCM(K, H, IV)  ← IV + 密文 存入 vault.salt
```

**解锁验证时：**
```
1. 启动 App → 显示解锁界面
2. 用户输入密码 P' → Argon2id(P', Salt) → 派生 AES-256 主密钥 K'
3. 用 K' 和 IV 通过 AES-256-GCM 解密 test_vector → 得到 H'（解密永远成功）
4. 独立计算 SHA-256(K' + Salt, 100000 次) → 得到 H_expected
5. H' == H_expected → 主密钥正确 → 存入主进程内存 → 进入主界面
   └─ 任何一步不匹配 → 拒绝解锁，提示错误
6. 读取/保存笔记 → 通过 IPC 调用主进程 → AES-256-GCM 加解密（内容+附件）
7. 锁定/退出 App → 主密钥随进程内存释放而清除
8. N 次解锁失败后（可配置，如 5 次）→ 显示警告，延迟递增
```

**关键设计**：AES-256-GCM 用于密码验证（解密永远成功，无法通过异常判断密钥正确性）；AES-256-GCM 用于内容加密（提供认证加密保护）

---

## 五、界面设计（方案 A：三栏布局）

```
┌──────────────────────────────────────────────────────┐
│  🔍 搜索 [标题 ▼] _________________________  [设置]  │
├────────────┬─────────────────┬───────────────────────┤
│ 文件夹      │ 笔记列表          │ 编辑器/查看器           │
│            │                 │                       │
│ ▼ 工作      │  项目A            │ # 项目A               │
│   ▼ 子文件夹 │  项目B            │ 2026-03-27            │
│     笔记1   │  日记             │                       │
│   笔记2     │                  │ [纯文本/MD/富文本]     │
│ ▼ 私人      │                  │                       │
│   日记      │                  │                       │
│   密码      │                  │                       │
│            │                  │                       │
├────────────┴─────────────────┴───────────────────────┤
│ 状态栏：已加密 | 笔记数: 12 | 最后同步: --             │
└──────────────────────────────────────────────────────┘
```

**区域说明**：
- **左侧（文件夹树）**：可折叠，宽度可拖拽调整，支持创建/重命名/删除文件夹
- **中间（笔记列表）**：当前文件夹下的笔记标题列表，按更新时间排序
- **右侧（编辑器/查看器）**：支持纯文本、Markdown 实时预览、富文本三种模式
- **顶部（搜索栏）**：下拉选择搜索范围（标题/全文），主动触发搜索
- **状态栏**：显示加密状态、笔记数量等

---

## 六、主要功能

| 功能 | 说明 |
|------|------|
| 文件夹管理 | 创建/重命名/删除文件夹，支持无限层级嵌套 |
| 笔记 CRUD | 创建/读取/更新/删除笔记，支持三种内容类型 |
| 内容类型 | 纯文本、Markdown（实时预览）、富文本（TipTap） |
| 附件 | 支持图片/文件添加，加密存储，点击预览/下载 |
| 搜索 | 标题搜索（加密索引）、全文搜索（需解密后搜索），用户主动选择 |
| 树形导航 | 左侧面板，展开/折叠文件夹，右键菜单 |
| 笔记列表 | 中间面板，显示标题+更新时间 |
| 编辑器 | 三种模式切换，Tab 切换或快捷键 |
| 导入/导出 | 保险库整体导出为加密压缩包，单笔记导出为 .md 或加密包 |
| 回收站 | 删除时移入回收站（逻辑删除），再次删除才物理删除；支持恢复和清空 |
| 锁定/解锁 | 手动锁定 App，回到解锁界面，需重新输入主密码 |
| 错误处理 | 解密失败提示、文件损坏修复提示、存储空间警告 |

### 6.1 回收站详细逻辑

**删除流程（三态）**：
```
普通删除（第一次删除）
  → 设置 deleted_at = 当前时间戳
  → 内容文件保留不动
  → 仍可通过回收站恢复

恢复（从回收站）
  → 清除 deleted_at
  → 内容文件不动
  → 恢复到原父文件夹（或根目录）

永久删除（从回收站再次删除）
  → 从数据库删除记录
  → 删除对应的 .enc 内容文件
  → 附件同时删除
```

**约束**：
- 删除文件夹时，该文件夹及其所有子文件夹、笔记同步移入回收站
- 回收站中不区分层级，统一平铺展示
- 清空回收站时递归删除所有内容文件

---

## 七、组件清单

### 主进程（Electron）

| 组件 | 职责 |
|------|------|
| `CryptoService` | AES-256-CBC 解密验证（密码）、AES-256-GCM 加解密（内容+附件）、Argon2id 密钥派生 |
| `DatabaseService` | SQLite 读写，元数据加密存储 |
| `VaultService` | 内容文件读写，按需加载/保存 |
| `RecycleService` | 回收站软删除/恢复/永久删除，关联内容文件清理 |
| `IPCHandlers` | 处理渲染进程请求，路由到各 Service |
| `WindowManager` | 窗口创建、主进程生命周期 |

### 渲染进程（Vue 3）

| 组件 | 职责 |
|------|------|
| `App.vue` | 根组件，管理布局状态 |
| `FolderTree.vue` | 左侧文件夹树，支持右键菜单 |
| `NoteList.vue` | 中间笔记列表 |
| `Editor.vue` | 右侧编辑器容器 |
| `PlainTextEditor.vue` | 纯文本编辑模式 |
| `MarkdownEditor.vue` | Markdown 编辑+预览 |
| `RichTextEditor.vue` | 富文本编辑（TipTap） |
| `SearchBar.vue` | 顶部搜索栏，范围选择 |
| `UnlockScreen.vue` | 解锁界面 |
| `SettingsDialog.vue` | 设置弹窗 |
| `RecycleBinDialog.vue` | 回收站弹窗，支持恢复和永久删除 |

---

## 八、IPC 接口（主进程 ↔ 渲染进程）

| 通道 | 方向 | 说明 |
|------|------|------|
| `vault:unlock` | Renderer → Main | 验证主密码，解锁保险库 |
| `vault:lock` | Renderer → Main | 锁定 App，清除内存密钥 |
| `vault:isUnlocked` | Renderer → Main | 查询当前是否已解锁 |
| `folders:list` | Renderer → Main | 获取文件夹树 |
| `folders:create` | Renderer → Main | 创建文件夹 |
| `folders:update` | Renderer → Main | 重命名文件夹 |
| `folders:delete` | Renderer → Main | 软删除文件夹（移入回收站） |
| `notes:list` | Renderer → Main | 获取某文件夹下的笔记列表（不含内容） |
| `notes:get` | Renderer → Main | 获取单篇笔记内容（解密） |
| `notes:create` | Renderer → Main | 创建笔记 |
| `notes:update` | Renderer → Main | 更新笔记 |
| `notes:delete` | Renderer → Main | 软删除笔记（移入回收站） |
| `recycle:list` | Renderer → Main | 获取回收站中的文件夹+笔记列表 |
| `recycle:restore` | Renderer → Main | 恢复指定的文件夹或笔记（从回收站） |
| `recycle:purge` | Renderer → Main | 永久删除回收站中的指定项（物理删除） |
| `recycle:empty` | Renderer → Main | 清空回收站（物理删除所有项） |
| `attachments:add` | Renderer → Main | 添加附件 |
| `attachments:get` | Renderer → Main | 获取附件（解密） |
| `attachments:delete` | Renderer → Main | 删除附件 |
| `search:title` | Renderer → Main | 标题搜索 |
| `search:content` | Renderer → Main | 全文搜索（需解密） |
| `export:note` | Renderer → Main | 导出单笔记 |
| `export:vault` | Renderer → Main | 导出整个保险库 |

---

## 九、错误处理

| 场景 | 处理方式 |
|------|---------|
| 主密码错误 | 提示"密码错误"，可重试，失败次数超限显示警告 |
| 解密内容失败 | 提示"内容已损坏"，记录日志，可选备份后跳过 |
| 文件缺失 | 提示"笔记不存在"，从列表中移除孤立记录 |
| 存储空间不足 | 保存前检查，警告用户 |
| 导入文件损坏 | 提示错误，不覆盖现有数据 |

---

## 十、后续步骤

1. 初始化 Electron + Vue 3 项目
2. 实现主进程加密模块（Argon2id + AES-256-CBC 密码验证 + AES-256-GCM 内容加密）
3. 实现 SQLite 元数据存储
4. 实现文件保险库（内容分桶存储）
5. 实现 IPC 通道
6. 实现 Vue 三栏布局
7. 实现文件夹树组件
8. 实现笔记列表组件
9. 实现三种编辑器
10. 实现搜索功能
11. 实现附件功能
12. 实现导入/导出
13. 测试与打包
