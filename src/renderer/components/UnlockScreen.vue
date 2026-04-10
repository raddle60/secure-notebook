<template>
  <div class="unlock-screen">
    <div class="unlock-card">
      <h1>Secure Notebook</h1>
      <p class="subtitle">本地加密记事本</p>

      <!-- 目录选择区域 -->
      <div class="dir-section">
        <div class="dir-input-row">
          <input
            v-model="selectedDir"
            type="text"
            placeholder="输入或选择笔记目录..."
            class="dir-input"
            @change="handleDirChange"
          />
          <button class="browse-btn" @click="browseDirectory" :disabled="loading">
            浏览
          </button>
        </div>

        <!-- 最近目录列表 -->
        <div v-if="recentDirs.length > 0" class="recent-section">
          <p class="recent-label">最近打开:</p>
          <ul class="recent-list">
            <li
              v-for="(dir, index) in recentDirs"
              :key="dir"
              class="recent-item"
            >
              <span class="folder-icon svg-folder"></span>
              <span class="dir-name" @click="selectRecentDir(dir)">{{ formatDirName(dir) }}</span>
              <button class="remove-dir-btn" @click.stop="removeRecentDir(index)" title="移除">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <!-- 密码输入区域 - 已存在目录 -->
      <div v-if="vaultState === 'existing'" class="password-section">
        <div class="vault-info">
          <span class="vault-icon svg-unlock"></span>
          <span>已存在的记事本 - 输入密码解锁</span>
        </div>
        <form @submit.prevent="handleUnlock">
          <input
            v-model="password"
            type="password"
            placeholder="输入主密码"
            class="password-input"
            autofocus
          />
          <p v-if="error" class="error">{{ error }}</p>
          <button type="submit" class="action-btn" :disabled="loading">
            {{ loading ? '解锁中...' : '打开记事本' }}
          </button>
          <button type="button" class="reset-btn" @click="showResetPassword = true">
            <span class="key-icon">🔑</span>
            使用密钥文件重置密码
          </button>
        </form>
      </div>

      <!-- 密码输入区域 - 新目录（将自动创建） -->
      <div v-if="vaultState === 'new'" class="password-section">
        <div class="vault-info new">
          <span class="vault-icon svg-create"></span>
          <span>新记事本 - 将自动创建</span>
        </div>
        <div class="password-rules">
          <p class="rules-title">密码要求：</p>
          <ul class="rules-list">
            <li :class="{ valid: passwordRules.length, invalid: !passwordRules.length && password }">至少 8 个字符</li>
            <li :class="{ valid: passwordRules.hasLetter, invalid: !passwordRules.hasLetter && password }">包含至少一个字母</li>
            <li :class="{ valid: passwordRules.hasNumber, invalid: !passwordRules.hasNumber && password }">包含至少一个数字</li>
          </ul>
        </div>

        <!-- 重置密钥文件选项 -->
        <div class="recovery-key-option">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="wantRecoveryKey"
              @change="toggleRecoveryKeyOption"
            />
            <span>生成重置密钥文件（忘记密码时使用）</span>
          </label>

          <div v-if="wantRecoveryKey" class="recovery-key-details">
            <div class="recovery-warning">
              <span class="warning-icon">⚠️</span>
              <p><strong>重要提示：</strong>重置密钥文件必须保存在<strong>数据目录之外</strong>的安全位置，<strong>避免密钥泄露</strong></p>
            </div>
            <div class="recovery-dir-select">
              <p class="recovery-dir-label">选择保存目录：</p>
              <div class="recovery-dir-row">
                <input
                  v-model="recoverySaveDir"
                  type="text"
                  placeholder="请选择保存目录..."
                  class="recovery-dir-input"
                  readonly
                />
                <button class="recovery-browse-btn" @click="selectRecoveryDir" :disabled="creating">
                  浏览
                </button>
              </div>
              <p class="recovery-file-hint">文件名：{{ recoveryFilename }}</p>
            </div>
          </div>
        </div>

        <form @submit.prevent="handleCreate">
          <input
            v-model="password"
            type="password"
            placeholder="设置主密码"
            class="password-input"
            :class="{ 'input-invalid': !passwordRules.valid && password }"
            autofocus
            @input="validatePassword"
          />
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="确认主密码"
            class="password-input"
            :class="{ 'input-invalid': confirmPassword && password !== confirmPassword }"
            @input="validatePassword"
          />
          <p v-if="error" class="error">{{ error }}</p>
          <button type="submit" class="action-btn" :disabled="loading || !passwordRules.valid || password !== confirmPassword">
            {{ loading ? '创建中...' : '创建记事本' }}
          </button>
        </form>
      </div>

      <!-- 返回按钮 -->
      <button v-if="vaultState !== 'select'" class="back-btn" @click="goBack">
        <span class="svg-icon svg-back"></span>
        <span>选择其他目录</span>
      </button>

      <!-- 重置密码对话框 -->
      <ResetPasswordDialog
        v-if="showResetPassword"
        :vault-dir="selectedDir"
        @close="showResetPassword = false"
        @success="handleResetSuccess"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useVault } from '../composables/useVault'
import ResetPasswordDialog from './ResetPasswordDialog.vue'
import { APP_VERSION } from '../../shared/constants'

const api = window.vaultAPI
const { openVault, createVault, isUnlocked, selectRecoveryKeySaveDir } = useVault()

const selectedDir = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const recentDirs = ref<string[]>([])

// 密码验证状态
const passwordRules = ref({
  valid: false,
  length: false,
  hasLetter: false,
  hasNumber: false
})

// vaultState: 'select' | 'existing' | 'new'
const vaultState = ref<'select' | 'existing' | 'new'>('select')

// 重置密码对话框
const showResetPassword = ref(false)

// 重置密钥文件选项（仅新建笔记目录时）
const wantRecoveryKey = ref(false)
const recoverySaveDir = ref('')
const creating = ref(false)
const recoveryKeyGenCount = ref(0)

onMounted(async () => {
  // 更新窗口标题
  document.title = `安全记事本 v${APP_VERSION}`

  // 获取最近目录
  recentDirs.value = await api.vault.getRecentDirs()

  // 检查上次目录
  const lastDir = await api.vault.getLastOpenedDir()
  if (lastDir) {
    const exists = await api.vault.checkExists(lastDir)
    if (exists) {
      selectedDir.value = lastDir
      vaultState.value = 'existing'
    }
  }

  // 获取重置密钥生成次数
  recoveryKeyGenCount.value = await api.recovery.getGenCount()
})

async function browseDirectory() {
  const dir = await api.vault.selectDirectory()
  if (dir) {
    selectedDir.value = dir
    checkVaultState(dir)
  }
}

async function checkVaultState(dir: string) {
  const exists = await api.vault.checkExists(dir)
  vaultState.value = exists ? 'existing' : 'new'
}

async function selectRecentDir(dir: string) {
  selectedDir.value = dir
  checkVaultState(dir)
}

async function removeRecentDir(index: number) {
  const dir = recentDirs.value[index]
  recentDirs.value.splice(index, 1)
  // 更新设置中的最近目录列表
  try {
    await api.vault.removeRecentDir(dir)
  } catch (e) {
    console.error('[UnlockScreen] Error removing recent dir:', e)
    // 恢复被删除的目录
    recentDirs.value.splice(index, 0, dir)
  }
}

async function handleDirChange() {
  // 手动修改目录路径后，检测目录状态
  if (selectedDir.value.trim()) {
    const exists = await api.vault.checkExists(selectedDir.value.trim())
    vaultState.value = exists ? 'existing' : 'new'
  } else {
    vaultState.value = 'select'
  }
}

async function handleUnlock() {
  error.value = ''
  if (!password.value) {
    error.value = '请输入密码'
    return
  }

  // 检查是否有其他进程持有锁
  const lockInfo = await api.vault.checkLock()
  if (lockInfo.locked) {
    error.value = `目录已被其他进程锁定（进程 ID: ${lockInfo.pid}），请先关闭其他进程`
    return
  }

  loading.value = true
  try {
    const result = await openVault(selectedDir.value, password.value)
    if (!result.success) {
      // 检查是否是版本不兼容错误
      if (result.error?.includes('版本不兼容')) {
        error.value = result.error
      } else {
        error.value = '密码错误'
      }
    } else {
      // 解锁成功后清空密码
      password.value = ''
      confirmPassword.value = ''
    }
  } catch (e: any) {
    // 捕获版本不兼容错误或其他进程锁定错误
    if (e?.message?.includes('版本不兼容')) {
      error.value = e.message
    } else if (e?.message?.includes('已被其他进程锁定')) {
      error.value = e.message
    } else {
      error.value = '解锁失败'
    }
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  error.value = ''
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次密码不一致'
    return
  }
  // 如果勾选了生成重置密钥文件，检查是否选择了保存目录
  if (wantRecoveryKey.value && !recoverySaveDir.value) {
    error.value = '请选择重置密钥文件的保存目录'
    return
  }

  creating.value = true
  try {
    const result = await createVault(selectedDir.value, password.value)
    if (!result.success) {
      error.value = result.error || '创建失败'
    } else {
      // 创建成功后，生成重置密钥文件（如果用户勾选了）
      if (wantRecoveryKey.value && recoverySaveDir.value) {
        try {
          const genResult = await api.recovery.generate(recoverySaveDir.value)
          if (!genResult.success) {
            console.warn('[UnlockScreen] 重置密钥文件生成失败:', genResult.error)
            // 不阻止流程，只是警告
          }
        } catch (e) {
          console.warn('[UnlockScreen] 重置密钥文件生成异常:', e)
        }
      }
      // 清空密码
      password.value = ''
      confirmPassword.value = ''
    }
  } catch (e) {
    error.value = '创建失败'
  } finally {
    creating.value = false
  }
}

function goBack() {
  vaultState.value = 'select'
  password.value = ''
  confirmPassword.value = ''
  error.value = ''
  passwordRules.value = { valid: false, length: false, hasLetter: false, hasNumber: false }
  wantRecoveryKey.value = false
  recoverySaveDir.value = ''
}

function toggleRecoveryKeyOption() {
  // 切换选项时的处理
}

async function selectRecoveryDir() {
  const dir = await selectRecoveryKeySaveDir()
  if (dir) {
    recoverySaveDir.value = dir
  }
}

const recoveryFilename = computed(() => {
  const now = new Date()
  const timestamp = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')

  // 从用户选择的目录提取名称
  const dirName = selectedDir.value ? selectedDir.value.replace(/[\\/]/g, '/').split('/').pop() || '' : ''
  // 清理目录名称中的非法字符
  const sanitizedVaultDirName = dirName.replace(/[<>:"/\\|?*]/g, '_')

  return `recovery_${sanitizedVaultDirName}_${timestamp}_${recoveryKeyGenCount.value + 1}.key`
})

function handleResetSuccess() {
  // 重置成功后，清空密码输入框
  password.value = ''
  confirmPassword.value = ''
  error.value = ''
}

// 监听锁定事件，清空密码
watch(isUnlocked, (unlocked) => {
  if (!unlocked) {
    password.value = ''
    confirmPassword.value = ''
  }
})

function validatePassword() {
  const pwd = password.value
  passwordRules.value.length = pwd.length >= 8
  passwordRules.value.hasLetter = /[a-zA-Z]/.test(pwd)
  passwordRules.value.hasNumber = /[0-9]/.test(pwd)
  passwordRules.value.valid = passwordRules.value.length && passwordRules.value.hasLetter && passwordRules.value.hasNumber
}

function formatDirName(dir: string): string {
  // 提取目录名称而非完整路径
  const parts = dir.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || dir
}
</script>

<style scoped>
.unlock-screen {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}

.unlock-card {
  background: var(--bg-primary);
  padding: 48px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  text-align: center;
  min-width: 400px;
  max-width: 500px;
}

h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.subtitle {
  color: var(--text-secondary);
  margin-bottom: 32px;
}

.dir-section {
  text-align: left;
}

.dir-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.dir-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.dir-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

/* 暗色主题下使用更柔和的聚焦边框 */
:root[data-theme='dark'] .dir-input:focus {
  border-color: var(--bg-selected);
}

.browse-btn {
  padding: 10px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}

.browse-btn:hover {
  background: var(--bg-hover);
}

.recent-section {
  margin-bottom: 16px;
}

.recent-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.recent-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}

.recent-item:hover {
  background: var(--bg-secondary);
}

.dir-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.remove-dir-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.2s;
}

.remove-dir-btn:hover {
  background: var(--bg-hover);
  color: var(--danger-color, #ef4444);
}

.recent-item:hover .remove-dir-btn {
  display: flex;
}

.folder-icon {
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background-color: var(--text-primary);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.folder-icon.svg-folder {
  -webkit-mask-image: url('../assets/icons/folder.svg');
  mask-image: url('../assets/icons/folder.svg');
}

.password-section {
  margin-top: 24px;
  text-align: left;
}

.vault-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 13px;
}

.vault-info.new {
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
}

.password-rules {
  background: var(--bg-secondary);
  border-radius: 4px;
  padding: 12px 16px;
  margin-bottom: 16px;
  text-align: left;
}

.rules-title {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.rules-list {
  margin: 0;
  padding-left: 20px;
}

.rules-list li {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  line-height: 1.4;
  list-style: none;
  position: relative;
  padding-left: 16px;
  transition: color 0.2s;
}

.rules-list li::before {
  content: '○';
  position: absolute;
  left: 0;
  font-size: 10px;
  color: var(--text-secondary);
}

.rules-list li.valid {
  color: #22c55e;
}

.rules-list li.valid::before {
  content: '✓';
  color: #22c55e;
}

.rules-list li.invalid {
  color: var(--danger-color, #ef4444);
}

.rules-list li.invalid::before {
  content: '○';
  color: var(--danger-color, #ef4444);
}

.input-invalid {
  border-color: var(--danger-color, #ef4444) !important;
}

.input-invalid:focus {
  border-color: var(--danger-color, #ef4444) !important;
}

.vault-icon {
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background-color: var(--text-primary);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.vault-icon.svg-unlock {
  -webkit-mask-image: url('../assets/icons/unlock.svg');
  mask-image: url('../assets/icons/unlock.svg');
}

.vault-icon.svg-create {
  -webkit-mask-image: url('../assets/icons/check.svg');
  mask-image: url('../assets/icons/check.svg');
}

.password-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 12px;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.password-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

/* 暗色主题下使用更柔和的聚焦边框 */
:root[data-theme='dark'] .password-input:focus {
  border-color: var(--bg-selected);
}

.password-input::placeholder {
  color: var(--text-secondary);
}

.action-btn {
  width: 100%;
  padding: 12px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

/* 暗色主题下使用不同的背景色 */
:root[data-theme='dark'] .action-btn {
  background: var(--bg-selected);
}

:root[data-theme='dark'] .action-btn:hover {
  background: var(--bg-hover);
}

.action-btn:disabled {
  opacity: 0.6;
}

.reset-btn {
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.reset-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.key-icon {
  font-size: 14px;
}

.back-btn {
  margin-top: 16px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.back-btn:hover {
  color: var(--accent-color);
}

.back-btn .svg-icon {
  width: 16px;
  height: 16px;
  background-color: currentColor;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.back-btn .svg-back {
  -webkit-mask-image: url('../assets/icons/back.svg');
  mask-image: url('../assets/icons/back.svg');
}

.error {
  color: var(--danger-color);
  font-size: 13px;
  margin-bottom: 8px;
}

/* 重置密钥文件选项 */
.recovery-key-option {
  margin: 16px 0;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.checkbox-label input[type="checkbox"]:hover {
  border-color: var(--accent-color);
}

.checkbox-label input[type="checkbox"]:checked {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.checkbox-label input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  color: white;
  font-size: 14px;
  font-weight: bold;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 暗色主题样式 */
:root[data-theme='dark'] .checkbox-label input[type="checkbox"] {
  border-color: var(--text-secondary);
  background: var(--bg-secondary);
}

:root[data-theme='dark'] .checkbox-label input[type="checkbox"]:hover {
  border-color: var(--bg-selected);
}

:root[data-theme='dark'] .checkbox-label input[type="checkbox"]:checked {
  background: var(--bg-selected);
  border-color: var(--bg-selected);
}

.checkbox-label input[type="checkbox"]:focus {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

:root[data-theme='dark'] .checkbox-label input[type="checkbox"]:focus {
  outline-color: var(--bg-selected);
}

.recovery-key-details {
  margin-top: 16px;
}

.recovery-warning {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(var(--danger-rgb, 239, 68, 68), 0.1);
  border-radius: 4px;
  border-left: 3px solid var(--danger-color);
  margin-bottom: 12px;
}

.warning-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.recovery-warning p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.recovery-warning strong {
  color: var(--danger-color);
}

.recovery-dir-select {
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 4px;
}

.recovery-dir-label {
  font-size: 13px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.recovery-dir-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.recovery-dir-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.recovery-dir-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

/* 暗色主题下使用更柔和的聚焦边框 */
:root[data-theme='dark'] .recovery-dir-input:focus {
  border-color: var(--bg-selected);
}

.recovery-browse-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}

.recovery-browse-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}

/* 暗色主题下使用不同的边框颜色 */
:root[data-theme='dark'] .recovery-browse-btn:hover:not(:disabled) {
  border-color: var(--bg-selected);
}

.recovery-browse-btn:focus {
  outline: none;
  border-color: var(--accent-color);
}

:root[data-theme='dark'] .recovery-browse-btn:focus {
  border-color: var(--bg-selected);
}

.recovery-browse-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.recovery-file-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
}
</style>
