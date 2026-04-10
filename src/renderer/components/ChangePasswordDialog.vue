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
              autocomplete="off"
            />
          </div>
          <div class="form-group">
            <label class="form-label">新密码</label>
            <input
              v-model="newPassword"
              type="password"
              placeholder="输入新密码"
              class="form-input"
              autocomplete="off"
            />
            <p v-if="newPassword && newPassword.length < 8" class="hint error">
              密码至少 8 个字符
            </p>
            <p v-if="newPassword && !/[a-zA-Z]/.test(newPassword)" class="hint error">
              密码必须包含至少一个字母
            </p>
            <p v-if="newPassword && !/[0-9]/.test(newPassword)" class="hint error">
              密码必须包含至少一个数字
            </p>
          </div>
          <div class="form-group">
            <label class="form-label">确认新密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="再次输入新密码"
              class="form-input"
              autocomplete="off"
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
  const hasLetter = /[a-zA-Z]/.test(newPassword.value)
  const hasNumber = /[0-9]/.test(newPassword.value)
  return (
    oldPassword.value &&
    newPassword.value.length >= 8 &&
    hasLetter &&
    hasNumber &&
    newPassword.value === confirmPassword.value &&
    newPassword.value !== oldPassword.value
  )
})

async function handleChangePassword() {
  error.value = ''

  // 验证新密码
  const hasLetter = /[a-zA-Z]/.test(newPassword.value)
  const hasNumber = /[0-9]/.test(newPassword.value)
  if (newPassword.value.length < 8) {
    error.value = '密码至少 8 个字符'
    return
  }
  if (!hasLetter) {
    error.value = '密码必须包含至少一个字母'
    return
  }
  if (!hasNumber) {
    error.value = '密码必须包含至少一个数字'
    return
  }

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
      // 成功后立即清空密码
      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      emit('close')
    } else {
      error.value = result.error || '密码修改失败'
    }
  } catch (e) {
    console.error('[ChangePasswordDialog] error:', e)
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
  color: var(--text-primary);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

/* 暗色主题下使用不同的边框颜色 */
:root[data-theme='dark'] .form-input:focus {
  border-color: var(--bg-selected);
}

/* 密码输入框文本颜色（包括占位符和圆点） */
.form-input[type="password"] {
  color: var(--text-primary);
  -webkit-text-fill-color: var(--text-primary);
}

.form-input::placeholder {
  color: var(--text-secondary);
  opacity: 1;
}

:root[data-theme='dark'] .form-input::placeholder {
  opacity: 0.7;
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
  color: var(--text-primary);
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

/* 暗色主题下使用不同的背景色 */
:root[data-theme='dark'] .btn-primary {
  background: var(--bg-selected);
}

:root[data-theme='dark'] .btn-primary:hover:not(:disabled) {
  background: var(--bg-hover);
}
</style>
