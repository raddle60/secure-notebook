# 密码重置功能 - 实现计划

## 设计概要

### 文件命名

**recovery.key 文件名格式：**
```
recovery_yyyyMMddHHmmss_N.key
```
- `yyyyMMddHHmmss` - 生成时间戳
- `N` - 生成次数（从 1 开始）

**示例：**
- `recovery_20260409153022_1.key` - 第 1 次生成
- `recovery_20260409153022_2.key` - 第 2 次生成
- `recovery_20260409153022_3.key` - 第 3 次生成

### 元数据记录

在 `metadata.json` 中添加字段：

```json
{
  "recovery_key_gen_count": 0,  // recovery.key 生成次数
  // ... 其他字段
}
```

**计数规则：**
- 首次创建保险库时，用户选择生成 recovery.key → 计数 +1
- 在设置中重新生成 recovery.key → 计数 +1
- 重置密码时 → 计数不变（vault_salt 不变，recovery.key 仍有效）

### 文件结构

```
vault.salt (144 字节，保持不变)
├─ salt(16) + iv_hash(16) + tag_hash(16) + encrypted_hash(32) + iv_key(16) + tag_key(16) + encrypted_masterKey(32)

recovery_yyyyMMddHHmmss_N.key (48 字节)
├─ iv_recovery(16) - AES-GCM 的 IV
├─ tag_recovery(16) - AES-GCM 的 tag
└─ encrypted_masterKey(32) - 用 recovery_key_enc 加密的 masterKey
```

### 密钥派生

```
固定 passphrase (硬编码) + vault_salt → recovery_key_enc → 加密/解密 masterKey
masterKey → 加密/解密所有笔记内容
```

---

## 实现任务

### Phase 1: 后端核心功能

#### Task 1: 修改 DatabaseService.ts

**文件：** `src/main/services/DatabaseService.ts`

**新增内容：**

1. 在 `Database` 接口中添加字段：
```typescript
interface Database {
  // ... 现有字段
  recovery_key_gen_count?: number  // recovery.key 生成次数
}
```

2. 添加方法：
```typescript
getRecoveryKeyGenCount(): number {
  return this.db.recovery_key_gen_count ?? 0
}

incrementRecoveryKeyGenCount(): number {
  this.db.recovery_key_gen_count = (this.db.recovery_key_gen_count ?? 0) + 1
  this.save()
  return this.db.recovery_key_gen_count
}
```

---

#### Task 2: 修改 CryptoService.ts

**文件：** `src/main/services/CryptoService.ts`

**新增内容：**

1. 添加常量 `RECOVERY_PASSPHRASE`（硬编码字符串）

2. 添加方法 `generateRecoveryKey(): { data: Buffer; filename: string }`
```typescript
async generateRecoveryKey(): Promise<{ data: Buffer; filename: string }> {
  // 从 vault.salt 读取 vault_salt
  const salt = this.readVaultSalt()
  
  // 生成 recovery_key_enc = derive_key(RECOVERY_PASSPHRASE + vault_salt)
  const recoveryKeyEnc = await this.deriveRecoveryKey(salt)
  
  // 用 recovery_key_enc 加密 masterKey
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM_GCM, recoveryKeyEnc, iv)
  const encryptedMasterKey = Buffer.concat([cipher.update(this.masterKey!), cipher.final()])
  const tag = cipher.getAuthTag()
  
  // recovery.key 数据 = iv(16) + tag(16) + encrypted_masterKey(32) = 64 字节
  const recoveryData = Buffer.concat([iv, tag, encryptedMasterKey])
  
  // 生成文件名
  const count = databaseService.incrementRecoveryKeyGenCount()
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 14)
  const filename = `recovery_${timestamp}_${count}.key`
  
  return { data: recoveryData, filename }
}
```

3. 添加方法 `resetPassword(recoveryKeyPath: string, newPassword: string): Promise<{success: boolean; error?: string}>`
   - 读取 vault.salt 获取 vault_salt
   - 读取 recovery.key 获取 iv, tag, encrypted_masterKey
   - 用 `recovery_key_enc = derive_key(RECOVERY_PASSPHRASE + vault_salt)` 解密 → 得到 masterKey
   - 用 masterKey 解密一个笔记验证
   - 用新密码派生新的 derivedKey → 重新加密 masterKey → 写入 vault.salt
   - **注意：** 不改变 recovery_key_gen_count，recovery.key 仍有效

4. 添加方法 `verifyRecoveryKey(recoveryKeyPath: string): Promise<boolean>`

---

#### Task 3: 修改 IPCHandlers.ts

**文件：** `src/main/services/IPCHandlers.ts`

**新增 IPC 句柄：**

```typescript
// 获取当前生成次数
ipcMain.handle('recovery:getGenCount', () => {
  return databaseService.getRecoveryKeyGenCount()
})

// 生成 recovery.key 文件
ipcMain.handle('recovery:generate', async (_, savePath: string) => {
  const { data, filename } = await cryptoService.generateRecoveryKey()
  const fullPath = path.join(path.dirname(savePath), filename)
  fs.writeFileSync(fullPath, data)
  return { success: true, filename }
})

// 验证 recovery.key 文件
ipcMain.handle('recovery:verify', async (_, recoveryKeyPath: string) => {
  const valid = await cryptoService.verifyRecoveryKey(recoveryKeyPath)
  return { valid }
})

// 使用 recovery.key 重置密码
ipcMain.handle('recovery:reset', async (_, recoveryKeyPath: string, newPassword: string) => {
  const result = await cryptoService.resetPassword(recoveryKeyPath, newPassword)
  return result
})

// 选择 recovery.key 保存位置
ipcMain.handle('recovery:selectSavePath', async () => {
  // 弹出文件保存对话框，验证不与 vault 同目录
})
```

---

#### Task 4: 修改 useVault.ts

**文件：** `src/renderer/composables/useVault.ts`

**新增 API 暴露：**

```typescript
recovery: {
  getGenCount: () => Promise<number>
  generate: (savePath: string) => Promise<{ success: boolean; filename?: string; error?: string }>
  verify: (recoveryKeyPath: string) => Promise<{ valid: boolean }>
  reset: (recoveryKeyPath: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  selectSavePath: () => Promise<string | null>
}
```

---

### Phase 2: 前端 UI

#### Task 5: 创建 RecoveryKeyDialog.vue

**文件：** `src/renderer/components/RecoveryKeyDialog.vue`

**功能：**
- 创建保险库时提示保存 recovery.key
- 显示当前生成次数（第 N 次）
- 显示建议的文件名 `recovery_yyyyMMddHHmmss_N.key`
- 显示保存位置选择器
- 验证保存位置不与 vault 同目录
- 显示安全提示（建议保存到 U 盘/云盘）
- 「跳过」按钮（显示警告后可跳过）
- 「保存」按钮

---

#### Task 6: 创建 ResetPasswordDialog.vue

**文件：** `src/renderer/components/ResetPasswordDialog.vue`

**功能：**
- 步骤 1：选择 recovery.key 文件
- 步骤 2：验证 recovery.key（显示进度）
- 步骤 3：输入新密码和确认密码（与创建密码规则相同）
- 步骤 4：执行重置

---

#### Task 7: 修改 UnlockScreen.vue

**文件：** `src/renderer/components/UnlockScreen.vue`

**新增内容：**
- 在密码输入区域下方添加「使用密钥文件重置」按钮
- 点击后打开 ResetPasswordDialog
- 重置成功后自动解锁

---

#### Task 8: 修改 SettingsDialog.vue

**文件：** `src/renderer/components/SettingsDialog.vue`

**新增内容：**
- 在「密码」设置项下添加「生成重置密钥文件」按钮
- 显示已生成次数（第 N 次）
- 点击后打开 RecoveryKeyDialog

---

## 验收标准

- [ ] 创建保险库时弹窗提示保存 recovery.key
- [ ] 文件名包含时间戳和次数：`recovery_yyyyMMddHHmmss_N.key`
- [ ] metadata.json 中记录生成次数
- [ ] recovery.key 保存位置不能与 vault 同目录
- [ ] 允许跳过保存，但显示警告
- [ ] 解锁屏幕有「使用密钥文件重置」按钮
- [ ] 重置流程需要选择 recovery.key + 输入新密码
- [ ] 重置成功后自动解锁
- [ ] 重置后原 recovery.key 仍可使用
- [ ] 设置中可重新生成 recovery.key，次数递增

---

## 文件清单

**新增文件：**
- `src/renderer/components/RecoveryKeyDialog.vue`
- `src/renderer/components/ResetPasswordDialog.vue`

**修改文件：**
- `src/main/services/DatabaseService.ts`
- `src/main/services/CryptoService.ts`
- `src/main/services/IPCHandlers.ts`
- `src/renderer/composables/useVault.ts`
- `src/renderer/components/UnlockScreen.vue`
- `src/renderer/components/SettingsDialog.vue`
