<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h2>生成重置密钥文件</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="dialog-body">
        <!-- 成功提示 -->
        <div v-if="successMessage" class="success-message">
          <span class="success-icon">✓</span>
          <p>{{ successMessage }}</p>
        </div>

        <div class="info-section">
          <p class="info-title">
            <span class="icon">🔑</span>
            重置密钥文件说明
          </p>
          <ul class="info-list">
            <li>此文件用于忘记密码时重置密码</li>
            <li>请将文件保存到安全位置， <strong>防止密钥泄露</strong></li>
            <li><strong>不要</strong> 与数据目录放在同一位置</li>
            <li>这是第 <span class="count-highlight">{{ genCount + 1 }}</span> 次生成</li>
          </ul>
        </div>

        <div class="file-info-section">
          <p class="file-label">文件名：</p>
          <p class="file-name">{{ suggestedFilename }}</p>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>

        <div class="save-location-section">
          <p class="location-label">选择保存目录：</p>
          <div class="location-input-row">
            <input
              v-model="saveDir"
              type="text"
              placeholder="请选择保存目录..."
              class="location-input"
              readonly
            />
            <button class="browse-btn" @click="selectSaveDir" :disabled="generating">
              浏览
            </button>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button v-if="successMessage" class="btn-primary" @click="$emit('close')">
          完成
        </button>
        <template v-else>
          <button class="btn-skip" @click="handleSkip" :disabled="generating">
            取消
          </button>
          <button
            class="btn-primary"
            @click="handleGenerate"
            :disabled="!saveDir || generating"
          >
            {{ generating ? '生成中...' : '生成并保存' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVault } from '../composables/useVault'

const emit = defineEmits<{ close: []; skipped: []; generated: [] }>()
const { getRecoveryKeyGenCount, generateRecoveryKey, selectRecoveryKeySaveDir, getCurrentDirName } = useVault()

const genCount = ref(0)
const saveDir = ref('')
const error = ref('')
const successMessage = ref('')
const generating = ref(false)
const vaultDirName = ref('')

const suggestedFilename = computed(() => {
  const now = new Date()
  const timestamp = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')

  // 清理目录名称中的非法字符
  const sanitizedVaultDirName = vaultDirName.value.replace(/[<>:"/\\|?*]/g, '_')

  return `recovery_${sanitizedVaultDirName}_${timestamp}_${genCount.value + 1}.key`
})

onMounted(async () => {
  genCount.value = await getRecoveryKeyGenCount()
  vaultDirName.value = await getCurrentDirName()
})

async function selectSaveDir() {
  const dir = await selectRecoveryKeySaveDir()
  if (dir) {
    saveDir.value = dir
    error.value = ''
  }
}

function handleSkip() {
  emit('skipped')
  emit('close')
}

async function handleGenerate() {
  if (!saveDir.value) {
    error.value = '请选择保存目录'
    return
  }

  error.value = ''
  generating.value = true

  try {
    const result = await generateRecoveryKey(saveDir.value)
    if (result.success) {
      successMessage.value = `重置密钥文件已生成并保存：${result.filename}`
      emit('generated')
    } else {
      error.value = result.error || '生成失败'
    }
  } catch (e: any) {
    error.value = e.message || '生成失败'
  } finally {
    generating.value = false
  }
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

.success-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin-bottom: 16px;
  background: rgba(34, 197, 94, 0.1);
  border-radius: 6px;
  border: 1px solid #22c55e;
}

.success-icon {
  font-size: 24px;
  color: #22c55e;
}

.success-message p {
  margin: 0;
  font-size: 13px;
  color: var(--text-primary);
}

.info-section {
  background: var(--bg-secondary);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
}

.info-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-title .icon {
  font-size: 16px;
}

.info-list {
  margin: 0;
  padding-left: 20px;
}

.info-list li {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.5;
}

.info-list li strong {
  color: var(--danger-color);
}

.count-highlight {
  color: var(--accent-color);
  font-weight: 600;
  font-size: 16px;
}

.file-info-section {
  margin-bottom: 16px;
}

.file-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.file-name {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  padding: 8px 12px;
  border-radius: 4px;
}

.error-message {
  color: var(--danger-color);
  font-size: 13px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: rgba(var(--danger-rgb, 239, 68, 68), 0.1);
  border-radius: 4px;
}

.save-location-section {
  margin-top: 16px;
}

.location-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.location-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.location-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.location-input:focus {
  outline: none;
  border-color: var(--accent-color);
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

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.btn-skip {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
}

.btn-skip:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-skip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
