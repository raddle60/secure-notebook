<template>
  <div v-if="modelValue" class="link-dialog-overlay" @click="handleCancel">
    <div class="link-dialog" @click.stop>
      <h3 class="dialog-title">{{ isEditMode ? '编辑链接' : (linkType === 'url' ? '插入链接' : '插入附件链接') }}</h3>

      <!-- URL 输入模式 -->
      <div v-if="linkType === 'url'" class="url-input-section">
        <div class="input-group">
          <label class="input-label">链接文本</label>
          <input
            ref="textInputRef"
            v-model="textValue"
            class="url-input"
            placeholder="请输入链接文本"
          />
        </div>
        <div class="input-group">
          <label class="input-label">链接地址</label>
          <input
            ref="urlInputRef"
            v-model="urlValue"
            class="url-input"
            placeholder="https://example.com"
            @keyup.enter="handleUrlConfirm"
          />
        </div>
      </div>

      <!-- 附件选择模式 -->
      <div class="attachment-list" v-else-if="attachments.length > 0">
        <div
          v-for="att in attachments"
          :key="att.id"
          class="attachment-item"
          :class="{ selected: selectedId === att.id }"
          @click="selectedId = att.id"
        >
          <span class="attachment-icon">{{ getFileIcon(att.mime_type) }}</span>
          <span class="attachment-name">{{ att.filename }}</span>
          <span class="attachment-size">{{ formatSize(att.size) }}</span>
        </div>
      </div>
      <div class="empty-attachment" v-else>
        暂无附件，请先上传附件
      </div>

      <div class="dialog-actions">
        <button class="btn-cancel" @click="handleCancel">取消</button>
        <button class="btn-confirm" v-if="linkType === 'attachment'" @click="handleConfirm" :disabled="!selectedId">确定</button>
        <button class="btn-confirm" v-else @click="handleUrlConfirm" :disabled="!urlValue.trim()">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  modelValue: boolean
  noteId: string | null
  linkType?: 'url' | 'attachment'
  isEditMode?: boolean
  editLinkText?: string
  editLinkHref?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'select': [data: { id: string; filename: string; href?: string }]
  'url-confirm': [data: { text: string; url: string }]
}>()

const attachments = ref<any[]>([])
const selectedId = ref<string | null>(null)
const urlValue = ref('')
const textValue = ref('')
const urlInputRef = ref<HTMLInputElement | null>(null)
const textInputRef = ref<HTMLInputElement | null>(null)

watch(() => props.modelValue, async (visible) => {
  if (visible) {
    if (props.linkType === 'url') {
      if (props.isEditMode) {
        // 编辑模式：填充现有值
        urlValue.value = props.editLinkHref || ''
        textValue.value = props.editLinkText || ''
      } else {
        // 插入模式：使用传入的文本（选中的文字）或清空
        urlValue.value = ''
        textValue.value = props.editLinkText || ''
      }
      nextTick(() => {
        if (props.isEditMode && props.editLinkText) {
          textInputRef.value?.focus()
        } else {
          urlInputRef.value?.focus()
        }
      })
    } else if (props.noteId) {
      attachments.value = await window.vaultAPI.attachments.list(props.noteId)
      selectedId.value = null
    }
  }
})

function handleConfirm() {
  if (selectedId.value) {
    const attachment = attachments.value.find(a => a.id === selectedId.value)
    emit('select', { id: selectedId.value, filename: attachment?.filename || '附件', href: `http://attachment/${selectedId.value}` })
    emit('update:modelValue', false)
  }
}

function handleUrlConfirm() {
  const url = urlValue.value.trim()
  const text = textValue.value.trim() || urlValue.value.trim()
  if (url) {
    emit('url-confirm', { text, url })
    emit('update:modelValue', false)
  }
}

function handleCancel() {
  emit('update:modelValue', false)
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊'
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦'
  return '📎'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style scoped>
.link-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.link-dialog {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 20px;
  width: 400px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.dialog-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.url-input-section {
  margin-bottom: 16px;
}

.input-group {
  margin-bottom: 12px;
}

.input-group:last-child {
  margin-bottom: 0;
}

.input-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.url-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.url-input:focus {
  border-color: var(--accent-color);
}

.attachment-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.attachment-item:hover {
  background: var(--bg-hover);
}

.attachment-item.selected {
  background: var(--accent-color);
  color: white;
}

.attachment-item.selected .attachment-size {
  color: rgba(255, 255, 255, 0.8);
}

.attachment-icon {
  font-size: 16px;
  flex-shrink: 0;
  filter: brightness(0.85);
}

/* 暗色主题下进一步降低图标亮度 */
:root[data-theme='dark'] .attachment-icon {
  filter: brightness(0.7);
}

.attachment-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-size {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.empty-attachment {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 24px 0;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel,
.btn-confirm {
  padding: 8px 20px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-cancel:hover {
  background: var(--border-color);
}

.btn-confirm {
  background: var(--accent-color);
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
