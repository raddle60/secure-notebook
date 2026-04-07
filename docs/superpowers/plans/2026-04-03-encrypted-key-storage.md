# Encrypted Key Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AES 加密密钥用派生密钥加密后存储到 vault.salt 文件，并实现密码修改功能。

**Architecture:** 扩展 vault.salt 文件格式，在末尾追加 encrypted_derived_key。解锁时直接解密使用该密钥，无需重新派生。密码修改时先验证旧密码，再用新密码重新加密存储。

**Tech Stack:** TypeScript, Node.js crypto 模块 (AES-256-GCM, PBKDF2), Electron IPC, Vue 3

---

### Task 1: 扩展 CryptoService 的 vault.salt 文件格式

**Files:**
- Modify: `src/main/services/CryptoService.ts`

**目标:** 修改 `createVault()` 和 `unlock()` 方法，支持新的文件格式。

**新格式 (144 字节):**
```
salt (16) + iv_hash (16) + tag_hash (16) + encrypted_hash (32) + iv_key (16) + tag_key (16) + encrypted_derived_key (32)
```

- [ ] **Step 1: 修改 createVault() 生成并存储 encrypted_derived_key**

在 `createVault()` 方法末尾，添加加密 derivedKey 并追加到文件的逻辑：

```typescript
async createVault(password: string): Promise<void> {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const derivedKey = await this.deriveKey(password, salt)
  const hash = await this.computeSlowHash(derivedKey, salt)

  const cipher = crypto.createCipheriv(ALGORITHM_GCM, derivedKey, iv)
  const encryptedHash = Buffer.concat([cipher.update(hash), cipher.final()])
  const tag = cipher.getAuthTag()

  // 新增：生成新的 iv 和 tag 用于加密 derivedKey
  const ivKey = crypto.randomBytes(IV_LENGTH)
  const keyCipher = crypto.createCipheriv(ALGORITHM_GCM, derivedKey, ivKey)
  const encryptedDerivedKey = Buffer.concat([keyCipher.update(derivedKey), keyCipher.final()])
  const keyTag = keyCipher.getAuthTag()

  // 新格式：salt (16) + iv_hash (16) + tag_hash (16) + encrypted_hash (32) + iv_key (16) + tag_key (16) + encrypted_derived_key (32)
  const data = Buffer.concat([salt, iv, tag, encryptedHash, ivKey, keyTag, encryptedDerivedKey])
  fs.writeFileSync(this.getVaultSaltPath(), data)

  this.masterKey = derivedKey
}
```

- [ ] **Step 2: 修改 unlock() 读取并解密 encrypted_derived_key**

修改 `unlock()` 方法，从新格式读取并解密 derivedKey：

```typescript
async unlock(password: string): Promise<boolean> {
  const vaultPath = this.getVaultSaltPath()
  if (!fs.existsSync(vaultPath)) {
    return false
  }

  const data = fs.readFileSync(vaultPath)
  const salt = data.subarray(0, SALT_LENGTH)
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 16)
  const encryptedHash = data.subarray(SALT_LENGTH + IV_LENGTH + 16, SALT_LENGTH + IV_LENGTH + 16 + 32)
  
  // 新增：读取 encrypted_derived_key 相关数据
  const ivKey = data.subarray(SALT_LENGTH + IV_LENGTH + 16 + 32, SALT_LENGTH + IV_LENGTH + 16 + 32 + 16)
  const keyTag = data.subarray(SALT_LENGTH + IV_LENGTH + 16 + 32 + 16, SALT_LENGTH + IV_LENGTH + 16 + 32 + 16 + 16)
  const encryptedDerivedKey = data.subarray(SALT_LENGTH + IV_LENGTH + 16 + 32 + 16 + 16)

  const derivedKey = await this.deriveKey(password, salt)

  // AES-256-GCM 解密 hash 验证密码
  const decipher = crypto.createDecipheriv(ALGORITHM_GCM, derivedKey, iv)
  decipher.setAuthTag(tag)
  const decryptedHash = Buffer.concat([decipher.update(encryptedHash), decipher.final()])

  const computedHash = await this.computeSlowHash(derivedKey, salt)

  const isValid = decryptedHash.equals(computedHash)
  if (isValid) {
    // 解密 encrypted_derived_key 并设置为 masterKey
    const keyDecipher = crypto.createDecipheriv(ALGORITHM_GCM, derivedKey, ivKey)
    keyDecipher.setAuthTag(keyTag)
    this.masterKey = Buffer.concat([keyDecipher.update(encryptedDerivedKey), keyDecipher.final()])
  }
  return isValid
}
```

- [ ] **Step 3: 添加密码长度常量**

在文件顶部常量定义处添加：

```typescript
const MIN_PASSWORD_LENGTH = 8
```

- [ ] **Step 4: 提交**

```bash
git add src/main/services/CryptoService.ts
git commit -m "feat: encrypt and store derived key in vault.salt"
```

---

### Task 2: 添加密码修改功能到 CryptoService

**Files:**
- Modify: `src/main/services/CryptoService.ts`

- [ ] **Step 1: 添加 changePassword() 方法**

在 `CryptoService` 类中添加新方法：

```typescript
async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  // 验证旧密码
  const oldValid = await this.unlock(oldPassword)
  if (!oldValid) {
    return { success: false, error: '旧密码错误' }
  }

  // 验证新密码
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `密码至少${MIN_PASSWORD_LENGTH}个字符` }
  }

  if (oldPassword === newPassword) {
    return { success: false, error: '新密码不能与旧密码相同' }
  }

  const vaultPath = this.getVaultSaltPath()
  const data = fs.readFileSync(vaultPath)
  const salt = data.subarray(0, SALT_LENGTH)

  // 用新密码派生新密钥
  const newDerivedKey = await this.deriveKey(newPassword, salt)
  const newHash = await this.computeSlowHash(newDerivedKey, salt)

  // 生成新的 iv 和 tag 用于加密 hash
  const newIv = crypto.randomBytes(IV_LENGTH)
  const newCipher = crypto.createCipheriv(ALGORITHM_GCM, newDerivedKey, newIv)
  const newEncryptedHash = Buffer.concat([newCipher.update(newHash), newCipher.final()])
  const newTag = newCipher.getAuthTag()

  // 生成新的 iv 和 tag 用于加密 derivedKey
  const newIvKey = crypto.randomBytes(IV_LENGTH)
  const newKeyCipher = crypto.createCipheriv(ALGORITHM_GCM, newDerivedKey, newIvKey)
  const newEncryptedDerivedKey = Buffer.concat([newKeyCipher.update(newDerivedKey), newKeyCipher.final()])
  const newKeyTag = newKeyCipher.getAuthTag()

  // 写入新格式数据
  const newData = Buffer.concat([salt, newIv, newTag, newEncryptedHash, newIvKey, newKeyTag, newEncryptedDerivedKey])
  fs.writeFileSync(vaultPath, newData)

  // 更新 masterKey
  this.masterKey = newDerivedKey

  return { success: true }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/main/services/CryptoService.ts
git commit -m "feat: add changePassword method to CryptoService"
```

---

### Task 3: 添加 IPC 处理函数

**Files:**
- Modify: `src/main/services/IPCHandlers.ts`

- [ ] **Step 1: 添加 vault:changePassword IPC 处理函数**

在 `registerIPCHandlers()` 函数中，`vault:isUnlocked` 处理函数之后添加：

```typescript
ipcMain.handle('vault:changePassword', async (_, oldPassword: string, newPassword: string) => {
  try {
    const result = await cryptoService.changePassword(oldPassword, newPassword)
    return result
  } catch (error) {
    console.error('[Vault] Error changing password:', error)
    return { success: false, error: '密码修改失败' }
  }
})
```

- [ ] **Step 2: 提交**

```bash
git add src/main/services/IPCHandlers.ts
git commit -m "feat: add vault:changePassword IPC handler"
```

---

### Task 4: 扩展 useVault API

**Files:**
- Modify: `src/renderer/composables/useVault.ts`

- [ ] **Step 1: 扩展 Window.vaultAPI 类型定义**

在 `Window.vaultAPI.vault` 接口中添加：

```typescript
changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
```

- [ ] **Step 2: 添加 changePassword 函数**

在 `lock()` 函数之后添加：

```typescript
async function changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  return await api.vault.changePassword(oldPassword, newPassword)
}
```

- [ ] **Step 3: 导出 changePassword**

在 return 语句中添加 `changePassword`。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/composables/useVault.ts
git commit -m "feat: add changePassword to useVault API"
```

---

### Task 5: 在 UnlockScreen 添加密码长度校验

**Files:**
- Modify: `src/renderer/components/UnlockScreen.vue`

- [ ] **Step 1: 修改 handleCreate() 添加密码长度校验**

修改 `handleCreate` 函数：

```typescript
async function handleCreate() {
  error.value = ''
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  if (password.value.length < 8) {
    error.value = '密码至少 8 个字符'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次密码不一致'
    return
  }

  loading.value = true
  try {
    const result = await createVault(selectedDir.value, password.value)
    if (!result.success) {
      error.value = result.error || '创建失败'
    }
  } catch (e) {
    error.value = '创建失败'
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/components/UnlockScreen.vue
git commit -m "feat: add password length validation in create vault"
```

---

### Task 6: 创建密码修改对话框组件

**Files:**
- Create: `src/renderer/components/ChangePasswordDialog.vue`

- [ ] **Step 1: 创建密码修改对话框组件**

```vue
<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h2>修改密码</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="dialog-body">
        <form @submit.prevent="handleChangePassword">
          <div class="form-group">
            <label class="form-label">旧密码</label>
            <input
              v-model="oldPassword"
              type="password"
              placeholder="输入旧密码"
              class="form-input"
              autofocus
            />
          </div>
          <div class="form-group">
            <label class="form-label">新密码</label>
            <input
              v-model="newPassword"
              type="password"
              placeholder="输入新密码"
              class="form-input"
            />
            <p v-if="newPassword && newPassword.length < 8" class="hint error">
              密码至少 8 个字符
            </p>
          </div>
          <div class="form-group">
            <label class="form-label">确认新密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="再次输入新密码"
              class="form-input"
            />
          </div>
          <p v-if="error" class="error-message">{{ error }}</p>
          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="$emit('close')">
              取消
            </button>
            <button
              type="submit"
              class="btn-primary"
              :disabled="!canSubmit || loading"
            >
              {{ loading ? '修改中...' : '确认修改' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVault } from '../composables/useVault'

const emit = defineEmits<{ close: [] }>()
const { changePassword } = useVault()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

const canSubmit = computed(() => {
  return (
    oldPassword.value &&
    newPassword.value.length >= 8 &&
    newPassword.value === confirmPassword.value &&
    newPassword.value !== oldPassword.value
  )
})

async function handleChangePassword() {
  error.value = ''
  
  if (newPassword.value !== confirmPassword.value) {
    error.value = '两次输入的新密码不一致'
    return
  }
  
  if (newPassword.value === oldPassword.value) {
    error.value = '新密码不能与旧密码相同'
    return
  }

  loading.value = true
  try {
    const result = await changePassword(oldPassword.value, newPassword.value)
    if (result.success) {
      emit('close')
    } else {
      error.value = result.error || '密码修改失败'
    }
  } catch (e) {
    error.value = '密码修改失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 400px;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
}

.dialog-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  background: var(--bg-secondary);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.hint {
  font-size: 12px;
  margin-top: 4px;
  color: var(--text-secondary);
}

.hint.error {
  color: var(--danger-color);
}

.error-message {
  color: var(--danger-color);
  font-size: 13px;
  margin-bottom: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 13px;
}

.btn-secondary:hover {
  background: var(--bg-secondary);
}

.btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: var(--accent-color);
  color: white;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/components/ChangePasswordDialog.vue
git commit -m "feat: create ChangePasswordDialog component"
```

---

### Task 7: 在 SettingsDialog 添加密码修改入口

**Files:**
- Modify: `src/renderer/components/SettingsDialog.vue`

- [ ] **Step 1: 修改模板添加修改密码按钮**

修改 `dialog-body` 部分：

```vue
<div class="dialog-body">
  <div class="setting-item">
    <span class="setting-label">锁定</span>
    <button class="setting-btn" @click="handleLock">立即锁定</button>
  </div>
  <div class="setting-item">
    <span class="setting-label">密码</span>
    <button class="setting-btn" @click="showChangePassword = true">修改密码</button>
  </div>
  <div class="setting-item">
    <span class="setting-label">导出</span>
    <button class="setting-btn" @click="handleExportVault">导出保险库</button>
  </div>
  <div class="setting-item">
    <span class="setting-label">关于</span>
    <span class="setting-value">Secure Notebook v1.0.0</span>
  </div>
</div>

<!-- 密码修改对话框 -->
<ChangePasswordDialog
  v-if="showChangePassword"
  @close="showChangePassword = false"
/>
```

- [ ] **Step 2: 修改脚本导入并使用 ChangePasswordDialog**

修改 script 部分：

```typescript
<script setup lang="ts">
import { ref } from 'vue'
import { useVault } from '../composables/useVault'
import ChangePasswordDialog from './ChangePasswordDialog.vue'

const emit = defineEmits<{ close: [] }>()
const { lock } = useVault()

const showChangePassword = ref(false)

async function handleLock() {
  await lock()
  emit('close')
}

async function handleExportVault() {
  const api = window.vaultAPI
}
</script>
```

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/SettingsDialog.vue
git commit -m "feat: add change password button to settings"
```

---

### Task 8: 向后兼容处理 - 支持旧格式 vault.salt 文件

**Files:**
- Modify: `src/main/services/CryptoService.ts`

**说明:** 为已存在的金库用户提供平滑迁移，当检测到旧格式文件时，自动升级为新格式。

- [ ] **Step 1: 添加旧格式检测和新格式常量**

在文件顶部添加：

```typescript
const OLD_FORMAT_LENGTH = 80  // salt(16) + iv(16) + tag(16) + encrypted_hash(32)
const NEW_FORMAT_LENGTH = 144 // salt(16) + iv(16) + tag(16) + encrypted_hash(32) + iv_key(16) + tag_key(16) + encrypted_key(32)
```

- [ ] **Step 2: 添加 upgradeVaultFormat() 私有方法**

在 `computeSlowHash` 方法后添加：

```typescript
private async upgradeVaultFormat(password: string): Promise<void> {
  const vaultPath = this.getVaultSaltPath()
  const data = fs.readFileSync(vaultPath)
  
  // 如果已经是新格式，跳过
  if (data.length >= NEW_FORMAT_LENGTH) {
    return
  }
  
  // 旧格式：重新写入新格式
  const salt = data.subarray(0, SALT_LENGTH)
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 16)
  const encryptedHash = data.subarray(SALT_LENGTH + IV_LENGTH + 16)
  
  const derivedKey = await this.deriveKey(password, salt)
  
  // 生成新的 iv 和 tag 用于加密 derivedKey
  const ivKey = crypto.randomBytes(IV_LENGTH)
  const keyCipher = crypto.createCipheriv(ALGORITHM_GCM, derivedKey, ivKey)
  const encryptedDerivedKey = Buffer.concat([keyCipher.update(derivedKey), keyCipher.final()])
  const keyTag = keyCipher.getAuthTag()
  
  // 写入新格式
  const newData = Buffer.concat([salt, iv, tag, encryptedHash, ivKey, keyTag, encryptedDerivedKey])
  fs.writeFileSync(vaultPath, newData)
}
```

- [ ] **Step 3: 在 unlock() 成功后调用升级函数**

修改 `unlock()` 方法，在 `if (isValid)` 块内，设置 `this.masterKey` 后添加：

```typescript
if (isValid) {
  const keyDecipher = crypto.createDecipheriv(ALGORITHM_GCM, derivedKey, ivKey)
  keyDecipher.setAuthTag(keyTag)
  this.masterKey = Buffer.concat([keyDecipher.update(encryptedDerivedKey), keyDecipher.final()])
  
  // 如果是旧格式，升级到新格式
  if (data.length < NEW_FORMAT_LENGTH) {
    await this.upgradeVaultFormat(password)
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/main/services/CryptoService.ts
git commit -m "feat: add backward compatibility for old vault.salt format"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** 检查设计方案中所有要求是否都有对应任务实现
- [ ] **Placeholder scan:** 搜索"TODO"、"TBD"等占位符
- [ ] **Type consistency:** 检查方法签名和返回值类型在各任务中是否一致
- [ ] **Error messages:** 所有错误提示信息是否与设计方案一致
