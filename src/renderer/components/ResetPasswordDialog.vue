<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h2>重置密码</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="dialog-body">
        <!-- 步骤 1：选择 recovery.key 文件 -->
        <div v-if="step === 1" class="step-section">
          <p class="step-title">步骤 1：选择重置密钥文件</p>
          <div class="file-select-section">
            <input
              v-model="recoveryKeyPath"
              type="text"
              placeholder="请选择 recovery_*.key 文件..."
              class="file-input"
              readonly
            />
            <button class="browse-btn" @click="selectRecoveryKey" :disabled="verifying">
              浏览
            </button>
          </div>
          <div v-if="recoveryKeyPath" class="file-info">
            <span class="file-icon">🔑</span>
            <span class="file-name-display">{{ getFileName(recoveryKeyPath) }}</span>
          </div>
        </div>

        <!-- 步骤 2：验证 recovery.key -->
        <div v-if="step === 2" class="step-section">
          <p class="step-title">步骤 2：验证重置密钥</p>
          <div v-if="verifying" class="verifying">
            <div class="spinner"></div>
            <p>正在验证重置密钥文件...</p>
          </div>
          <div v-else-if="verificationSuccess" class="verification-success">
            <span class="success-icon">✓</span>
            <p>验证成功！可以继续重置密码。</p>
          </div>
          <div v-else-if="verificationFailed" class="verification-failed">
            <span class="failed-icon">✗</span>
            <p>{{ verifyError }}</p>
          </div>
        </div>

        <!-- 步骤 3：输入新密码 -->
        <div v-if="step === 3" class="step-section">
          <p class="step-title">步骤 3：设置新密码</p>
          <div class="form-group">
            <label class="form-label">新密码</label>
            <input
              v-model="newPassword"
              type="password"
              placeholder="输入新密码"
              class="form-input"
              autofocus
            />
            <div class="password-rules">
              <p :class="{ valid: passwordRules.length, invalid: !passwordRules.length && newPassword }">
                {{ passwordRules.length ? '✓' : '○' }} 至少 8 个字符
              </p>
              <p :class="{ valid: passwordRules.hasLetter, invalid: !passwordRules.hasLetter && newPassword }">
                {{ passwordRules.hasLetter ? '✓' : '○' }} 包含至少一个字母
              </p>
              <p :class="{ valid: passwordRules.hasNumber, invalid: !passwordRules.hasNumber && newPassword }">
                {{ passwordRules.hasNumber ? '✓' : '○' }} 包含至少一个数字
              </p>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">确认新密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="再次输入新密码"
              class="form-input"
              :class="{ 'input-invalid': confirmPassword && newPassword !== confirmPassword }"
            />
          </div>
          <div v-if="error" class="error-message">{{ error }}</div>
        </div>

        <!-- 步骤 4：执行重置 -->
        <div v-if="step === 4" class="step-section">
          <p class="step-title">步骤 4：执行重置</p>
          <div v-if="resetting" class="resetting">
            <div class="spinner"></div>
            <p>正在重置密码...</p>
          </div>
          <div v-else-if="resetSuccess" class="reset-success">
            <span class="success-icon">✓</span>
            <p>密码重置成功！</p>
          </div>
          <div v-else-if="resetFailed" class="reset-failed">
            <span class="failed-icon">✗</span>
            <p>{{ resetError }}</p>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button v-if="step > 1 && step < 4 && !verifying && !resetting" class="btn-secondary" @click="prevStep">
          上一步
        </button>
        <button
          v-if="step === 1"
          class="btn-primary"
          @click="goToStep2"
          :disabled="!recoveryKeyPath"
        >
          验证密钥文件
        </button>
        <button
          v-if="step === 2 && verificationSuccess"
          class="btn-primary"
          @click="goToStep3"
        >
          继续
        </button>
        <button
          v-if="step === 3"
          class="btn-primary"
          @click="goToStep4"
          :disabled="!canSubmit"
        >
          重置密码
        </button>
        <button
          v-if="step === 4 && resetSuccess"
          class="btn-primary"
          @click="handleComplete"
        >
          完成
        </button>
        <button
          v-if="(step === 2 && verificationFailed) || (step === 4 && resetFailed)"
          class="btn-primary"
          @click="retryStep"
        >
          重试
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVault } from '../composables/useVault'

const props = defineProps<{
  vaultDir: string
}>()

const emit = defineEmits<{ close: []; success: [] }>()
const { verifyRecoveryKey, resetPassword } = useVault()

const step = ref(1)
const recoveryKeyPath = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const verifying = ref(false)
const verificationSuccess = ref(false)
const verificationFailed = ref(false)
const verifyError = ref('')
const resetting = ref(false)
const resetSuccess = ref(false)
const resetFailed = ref(false)
const resetError = ref('')

const passwordRules = computed(() => {
  const pwd = newPassword.value
  return {
    length: pwd.length >= 8,
    hasLetter: /[a-zA-Z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    valid: pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd)
  }
})

const canSubmit = computed(() => {
  return (
    passwordRules.value.valid &&
    newPassword.value === confirmPassword.value &&
    newPassword.value !== ''
  )
})

function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

async function selectRecoveryKey() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.key'
  input.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      recoveryKeyPath.value = target.files[0].path
    }
  }
  input.click()
}

async function goToStep2() {
  if (!recoveryKeyPath.value) return

  verifying.value = true
  verificationSuccess.value = false
  verificationFailed.value = false
  verifyError.value = ''
  step.value = 2
  try {
    const result = await verifyRecoveryKey(recoveryKeyPath.value, props.vaultDir)
    if (result.valid) {
      verificationSuccess.value = true
    } else {
      verificationFailed.value = true
      verifyError.value = '重置密钥文件无效或与笔记目录不匹配'
    }
  } catch (e: any) {
    verificationFailed.value = true
    verifyError.value = e.message || '验证失败'
  } finally {
    verifying.value = false
  }
}

function goToStep3() {
  step.value = 3
}

function prevStep() {
  if (step.value === 2) {
    step.value = 1
  } else if (step.value === 3) {
    step.value = 2
  } else if (step.value === 4) {
    step.value = 3
  }
}

async function goToStep4() {
  if (!canSubmit.value) return

  resetting.value = true
  resetSuccess.value = false
  resetFailed.value = false
  resetError.value = ''
  error.value = ''

  try {
    const result = await resetPassword(recoveryKeyPath.value, newPassword.value, props.vaultDir)
    if (result.success) {
      resetSuccess.value = true
      step.value = 4
    } else {
      resetFailed.value = true
      resetError.value = result.error || '重置失败'
    }
  } catch (e: any) {
    resetFailed.value = true
    resetError.value = e.message || '重置失败'
  } finally {
    resetting.value = false
  }
}

function retryStep() {
  if (step.value === 2 && verificationFailed.value) {
    verificationFailed.value = false
    prevStep()
  } else if (step.value === 4 && resetFailed.value) {
    resetFailed.value = false
    goToStep4()
  }
}

function handleComplete() {
  emit('success')
  emit('close')
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
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
  overflow-y: auto;
  flex: 1;
}

.step-section {
  margin-bottom: 16px;
}

.step-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.file-select-section {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.file-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.file-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

/* 暗色主题下使用更柔和的聚焦边框 */
:root[data-theme='dark'] .file-input:focus {
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

.browse-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}

.browse-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 13px;
}

.file-icon {
  font-size: 16px;
}

.file-name-display {
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--text-primary);
}

.verifying,
.resetting {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.verification-success,
.reset-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  color: #22c55e;
}

.success-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.verification-failed,
.reset-failed {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  color: var(--danger-color);
}

.failed-icon {
  font-size: 48px;
  margin-bottom: 12px;
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
  color: var(--text-primary);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.input-invalid {
  border-color: var(--danger-color) !important;
}

.password-rules {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.password-rules p {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  transition: color 0.2s;
}

.password-rules p:last-child {
  margin-bottom: 0;
}

.password-rules p.valid {
  color: #22c55e;
}

.password-rules p.invalid {
  color: var(--danger-color);
}

.error-message {
  color: var(--danger-color);
  font-size: 13px;
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(var(--danger-rgb, 239, 68, 68), 0.1);
  border-radius: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}

.btn-secondary:hover {
  background: var(--bg-hover);
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

:root[data-theme='dark'] .btn-primary {
  background: var(--bg-selected);
}
</style>
