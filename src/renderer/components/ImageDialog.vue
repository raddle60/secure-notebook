<template>
  <div v-if="modelValue" class="image-dialog-overlay" @click="handleCancel">
    <div class="image-dialog" @click.stop>
      <h3 class="dialog-title">插入图片</h3>
      <div class="image-list" v-if="imageAttachments.length > 0">
        <div
          v-for="att in imageAttachments"
          :key="att.id"
          class="image-item"
          :class="{ selected: selectedId === att.id }"
          @click="selectedId = att.id"
        >
          <span class="image-icon">🖼️</span>
          <span class="image-name">{{ att.filename }}</span>
          <span class="image-size">{{ formatSize(att.size) }}</span>
        </div>
      </div>
      <div class="empty-image" v-else>
        暂无图片附件
      </div>
      <div class="dialog-actions">
        <button class="btn-cancel" @click="handleCancel">取消</button>
        <button class="btn-confirm" @click="handleConfirm" :disabled="!selectedId">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  noteId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'select': [data: { id: string; filename: string; data: string }]
}>()

const attachments = ref<any[]>([])
const selectedId = ref<string | null>(null)

// 只显示图片类型的附件
const imageAttachments = computed(() => {
  return attachments.value.filter(att => {
    const mime = att.mime_type || ''
    return mime.startsWith('image/')
  })
})

watch(() => props.modelValue, async (visible) => {
  if (visible && props.noteId) {
    attachments.value = await window.vaultAPI.attachments.list(props.noteId)
    selectedId.value = null
  }
})

async function handleConfirm() {
  if (selectedId.value) {
    const attachment = attachments.value.find(a => a.id === selectedId.value)
    if (attachment) {
      // 获取附件数据
      const data = await window.vaultAPI.attachments.get(selectedId.value)
      emit('select', {
        id: selectedId.value,
        filename: attachment.filename,
        data: data?.data || ''
      })
    }
    emit('update:modelValue', false)
  }
}

function handleCancel() {
  emit('update:modelValue', false)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style scoped>
.image-dialog-overlay {
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

.image-dialog {
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

.image-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.image-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.image-item:hover {
  background: var(--bg-hover);
}

.image-item.selected {
  background: var(--accent-color);
  color: white;
}

.image-item.selected .image-size {
  color: rgba(255, 255, 255, 0.8);
}

.image-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.image-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-size {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.empty-image {
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
