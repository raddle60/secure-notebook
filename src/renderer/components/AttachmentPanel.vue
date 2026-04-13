<template>
  <div class="attachment-panel" v-if="!isExternal">
    <div class="attachment-header">
      <span class="attachment-title">附件</span>
      <button class="upload-btn" @click="triggerUpload" title="上传附件">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
      </button>
      <input
        ref="fileInput"
        type="file"
        multiple
        style="display: none"
        @change="handleFileSelect"
      />
    </div>
    <div class="attachment-list" v-if="attachments.length > 0">
      <div
        v-for="att in attachments"
        :key="att.id"
        class="attachment-item"
      >
        <span class="attachment-icon" :class="getFileIconClass(att.mime_type)" :title="att.mime_type"></span>
        <span class="attachment-name" :class="{ 'is-image': isImage(att.mime_type) }" :title="att.filename" @click="isImage(att.mime_type) && previewImage(att)">{{ att.filename }}</span>
        <span class="attachment-size">{{ formatSize(att.size) }}</span>
        <div class="attachment-actions">
          <button @click="downloadAttachment(att)" title="下载">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
          </button>
          <button @click="copyAttachmentId(att)" title="复制附件ID">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button @click="deleteAttachment(att)" title="删除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    <div class="empty-attachment" v-else>
      暂无附件
    </div>

    <!-- 图片预览对话框 -->
    <div v-if="showPreview" class="image-preview-overlay" @click="closePreview">
      <div class="image-preview-content" @click.stop>
        <div class="image-preview-header">
          <span class="image-preview-title">{{ currentPreviewImage?.filename }}</span>
          <div class="image-preview-controls">
            <button class="zoom-btn" @click="zoomOut" title="缩小">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
            <button class="zoom-btn" @click="zoomIn" title="放大">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <button class="zoom-btn" @click="resetZoom" title="重置缩放">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
            </button>
            <button class="image-preview-close" @click="closePreview" title="关闭">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="image-preview-body" @wheel="handleWheel" @mousedown="handleDragStart" @mousemove="handleDragMove" @mouseup="handleDragEnd" @mouseleave="handleDragEnd">
          <div class="image-wrapper" :style="{ transform: `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})` }">
            <img :src="currentPreviewImage?.src" :alt="currentPreviewImage?.filename" draggable="false" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { onAttachmentRefresh, emitRecycleBinRefresh } from '../composables/useVault'

const props = defineProps<{
  noteId: string | null
  isExternal?: boolean
}>()

const attachments = ref<any[]>([])
const showPreview = ref(false)
const currentPreviewImage = ref<{ filename: string; src: string } | null>(null)
const zoomLevel = ref(1)
const minZoom = 0.25
const maxZoom = 4
// 拖动相关状态
const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)
const translateX = ref(0)
const translateY = ref(0)

// 订阅附件刷新事件（回收站恢复附件时触发）
const unsubscribe = onAttachmentRefresh(() => {
  loadAttachments()
})

async function loadAttachments() {
  if (!props.noteId) {
    attachments.value = []
    return
  }
  attachments.value = await window.vaultAPI.attachments.list(props.noteId)
}

// 判断是否为图片
function isImage(mimeType: string): boolean {
  return mimeType?.startsWith('image/') || false
}

// 预览图片
async function previewImage(att: any) {
  const data = await window.vaultAPI.attachments.get(att.id)
  if (!data) return

  // 将 base64 转换为图片 src
  const src = `data:${att.mime_type};base64,${data.data}`
  currentPreviewImage.value = {
    filename: att.filename,
    src
  }
  zoomLevel.value = 1
  translateX.value = 0
  translateY.value = 0
  showPreview.value = true
}

// 关闭预览
function closePreview() {
  showPreview.value = false
  currentPreviewImage.value = null
  zoomLevel.value = 1
  translateX.value = 0
  translateY.value = 0
}

// 滚轮缩放
function handleWheel(event: WheelEvent) {
  event.preventDefault()
  const delta = event.deltaY > 0 ? -0.1 : 0.1
  const newZoom = Math.min(maxZoom, Math.max(minZoom, zoomLevel.value + delta))
  zoomLevel.value = newZoom
}

// 重置缩放
function resetZoom() {
  zoomLevel.value = 1
  translateX.value = 0
  translateY.value = 0
}

// 放大
function zoomIn() {
  zoomLevel.value = Math.min(maxZoom, zoomLevel.value + 0.5)
}

// 缩小
function zoomOut() {
  zoomLevel.value = Math.max(minZoom, zoomLevel.value - 0.5)
}

// 拖动开始
function handleDragStart(event: MouseEvent) {
  isDragging.value = true
  startX.value = event.clientX - translateX.value
  startY.value = event.clientY - translateY.value
}

// 拖动中
function handleDragMove(event: MouseEvent) {
  if (!isDragging.value) return
  event.preventDefault()
  translateX.value = event.clientX - startX.value
  translateY.value = event.clientY - startY.value
}

// 拖动结束
function handleDragEnd() {
  isDragging.value = false
}

watch(() => props.noteId, loadAttachments, { immediate: true })

function triggerUpload() {
  const input = document.querySelector('.attachment-panel input[type="file"]') as HTMLInputElement
  if (input) input.click()
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || !props.noteId) return

  for (const file of Array.from(input.files)) {
    // Create a temporary path for the file
    // In Electron, we need to use the actual file path
    const filePath = (file as any).path
    if (filePath) {
      await window.vaultAPI.attachments.add(props.noteId, filePath)
    }
  }

  input.value = ''
  await loadAttachments()
}

async function downloadAttachment(att: any) {
  const data = await window.vaultAPI.attachments.get(att.id)
  if (!data) return

  // Convert base64 to blob and download
  const byteCharacters = atob(data.data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray])
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = att.filename
  a.click()
  URL.revokeObjectURL(url)
}

async function copyAttachmentId(att: any) {
  await navigator.clipboard.writeText(att.id)
}

async function deleteAttachment(att: any) {
  await window.vaultAPI.attachments.delete(att.id)
  await loadAttachments()
  // 通知回收站刷新
  emitRecycleBinRefresh()
}

onUnmounted(() => {
  unsubscribe()
})

function getFileIconClass(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'svg-file-image'
  if (mimeType.startsWith('video/')) return 'svg-file-video'
  if (mimeType.startsWith('audio/')) return 'svg-file-audio'
  if (mimeType === 'application/pdf') return 'svg-file-document'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'svg-file-document'
  if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'svg-file-spreadsheet'
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'svg-file-archive'
  return 'svg-file'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style scoped>
.attachment-panel {
  background: transparent;
}

.attachment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.attachment-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: var(--accent-color);
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.upload-btn:hover {
  background: var(--accent-hover);
}

/* 暗色主题下使用不同的背景色 */
:root[data-theme='dark'] .upload-btn {
  background: var(--bg-selected);
}

:root[data-theme='dark'] .upload-btn:hover {
  background: var(--bg-hover);
}

.attachment-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border-radius: 4px;
  background: var(--bg-primary);
}

.attachment-icon {
  flex-shrink: 0;
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

.attachment-icon.svg-file-image {
  -webkit-mask-image: url('../assets/icons/file-image.svg');
  mask-image: url('../assets/icons/file-image.svg');
}

.attachment-icon.svg-file-video {
  -webkit-mask-image: url('../assets/icons/file-video.svg');
  mask-image: url('../assets/icons/file-video.svg');
}

.attachment-icon.svg-file-audio {
  -webkit-mask-image: url('../assets/icons/file-audio.svg');
  mask-image: url('../assets/icons/file-audio.svg');
}

.attachment-icon.svg-file-document {
  -webkit-mask-image: url('../assets/icons/file-document.svg');
  mask-image: url('../assets/icons/file-document.svg');
}

.attachment-icon.svg-file-spreadsheet {
  -webkit-mask-image: url('../assets/icons/file-spreadsheet.svg');
  mask-image: url('../assets/icons/file-spreadsheet.svg');
}

.attachment-icon.svg-file-archive {
  -webkit-mask-image: url('../assets/icons/file-archive.svg');
  mask-image: url('../assets/icons/file-archive.svg');
}

.attachment-icon.svg-file {
  -webkit-mask-image: url('../assets/icons/file.svg');
  mask-image: url('../assets/icons/file.svg');
}

/* 暗色主题下进一步降低图标亮度 */
:root[data-theme='dark'] .attachment-icon {
  filter: brightness(0.7);
}

.attachment-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-name.is-image {
  cursor: pointer;
}

.attachment-name.is-image:hover {
  color: var(--accent-color);
}

.attachment-size {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.attachment-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.attachment-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.attachment-actions button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.empty-attachment {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 16px 0;
}

/* 图片预览对话框 */
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.image-preview-content {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 16px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.image-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.image-preview-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.zoom-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zoom-level {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: center;
}

.image-preview-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
}

.image-preview-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.image-preview-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.image-preview-body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  max-height: 70vh;
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.image-preview-body:active {
  cursor: grabbing;
}

.image-preview-body.dragging .image-wrapper {
  transition: none;
}

.image-wrapper {
  transition: transform 0.1s ease-out;
  transform-origin: center center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-body img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 4px;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
}
</style>
