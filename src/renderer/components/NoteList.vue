<template>
  <div class="note-list">
    <div class="list-header">
      <span>{{ notes.length }} 篇笔记</span>
      <div class="header-actions">
        <button
          class="action-btn"
          @click="toggleHideDate"
          :title="hideDate ? '显示日期' : '隐藏日期'"
        >
          <svg v-if="hideDate" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="12" y1="14" x2="12" y2="18"/>
            <line x1="10" y1="16" x2="14" y2="16"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="3" y1="2" x2="21" y2="22"/>
          </svg>
        </button>
        <button class="add-btn" @click="openNewNoteDialog" title="新建笔记">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <ul class="note-items" @contextmenu.prevent="handleBlankContextMenu($event)" @dragover.prevent @drop.prevent>
      <li
        v-for="note in notes"
        :key="note.id"
        class="note-item"
        :class="{
          active: note.id === currentNoteId,
          dragging: draggingNoteId === note.id,
          'drag-over-before': dragOverNoteId === note.id && dragPosition === 'before',
          'drag-over-after': dragOverNoteId === note.id && dragPosition === 'after'
        }"
        draggable="true"
        @click="selectNote(note.id)"
        @contextmenu.prevent="handleContextMenu($event, note)"
        @dragstart="handleDragStart($event, note)"
        @dragover="handleDragOver($event, note)"
        @dragleave="handleDragLeave($event)"
        @drop="handleDrop($event, note)"
        @dragend="handleDragEnd($event)"
      >
        <span class="note-icon">
          <span v-if="note.content_type === 'plain'" class="svg-icon svg-note-plain"></span>
          <span v-else-if="note.content_type === 'markdown'" class="svg-icon svg-note-markdown"></span>
          <span v-else-if="note.content_type === 'richtext'" class="svg-icon svg-note-richtext"></span>
          <span v-else class="svg-icon svg-note-plain"></span>
        </span>
        <span class="note-title">{{ note.title }}</span>
        <span v-if="!hideDate" class="note-date">{{ formatDate(note.updated_at) }}</span>
        <button class="note-menu-btn" @click.stop="openContextMenu($event, note)">⋯</button>
      </li>
      <li v-if="notes.length === 0" class="empty" @contextmenu.prevent.stop="handleBlankContextMenu($event)">
        暂无笔记
      </li>
    </ul>

    <!-- 右键菜单 -->
    <ContextMenu
      v-model="contextMenuVisible"
      :position="contextMenuPosition"
      :anchor="contextMenuAnchor"
      :items="contextMenuItems"
    />

    <!-- 重命名对话框 -->
    <RenameDialog
      v-model="renameDialogVisible"
      title="重命名笔记"
      :default-value="renameDefaultValue"
      @confirm="handleRenameConfirm"
    />

    <!-- 新建笔记对话框 -->
    <NoteDialog
      v-model="newNoteDialogVisible"
      title="新建笔记"
      :default-value="''"
      @confirm="handleNewNoteConfirm"
    />

    <!-- 确认删除对话框 -->
    <ConfirmDialog
      v-model="confirmDialogVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-text="删除"
      @confirm="handleConfirmDelete"
    />

    <!-- 消息提示对话框 -->
    <MessageDialog
      v-model="messageDialogVisible"
      :title="messageTitle"
      :message="messageContent"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useVault } from '../composables/useVault'
import ContextMenu from './ContextMenu.vue'
import RenameDialog from './RenameDialog.vue'
import NoteDialog from './NoteDialog.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import MessageDialog from './MessageDialog.vue'

const { notes, currentNoteId, currentFolderId, folders, selectNote, createNote: create, deleteNote: remove, renameNote: rename, updateNoteOrder } = useVault()

// 消息提示对话框
const messageDialogVisible = ref(false)
const messageTitle = ref('')
const messageContent = ref('')

// 隐藏日期状态
const hideDate = ref(false)

// 加载设置
onMounted(async () => {
  try {
    const uiSettings = await window.vaultAPI.settings.getUiDisplaySettings()
    hideDate.value = uiSettings.noteListHideDate
  } catch (e) {
    console.error('[NoteList] Error loading UI settings:', e)
  }
})

// 切换隐藏日期状态
async function toggleHideDate() {
  hideDate.value = !hideDate.value
  try {
    await window.vaultAPI.settings.updateNoteListHideDate(hideDate.value)
  } catch (e) {
    console.error('[NoteList] Error saving UI settings:', e)
  }
}

const contextMenuNote = ref<any>(null)
const contextMenuAnchor = ref<HTMLElement | null>(null)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

// 重命名对话框
const renameDialogVisible = ref(false)
const renameDefaultValue = ref('')
const renamingNote = ref<any>(null)

// 新建笔记对话框
const newNoteDialogVisible = ref(false)

// 确认删除对话框
const confirmDialogVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const noteToDelete = ref<any>(null)

function checkFolderSelected(): boolean {
  if (!currentFolderId.value) {
    if (folders.value.length === 0) {
      messageTitle.value = '提示'
      messageContent.value = '请先创建一个文件夹'
      messageDialogVisible.value = true
    } else {
      messageTitle.value = '提示'
      messageContent.value = '请先选择一个文件夹'
      messageDialogVisible.value = true
    }
    return false
  }
  return true
}

async function openNewNoteDialog() {
  if (checkFolderSelected()) {
    newNoteDialogVisible.value = true
  }
}

function handleNewNoteConfirm(data: { title: string; format: string }) {
  create(data.title, data.format)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

function showDeleteConfirm(note: any) {
  noteToDelete.value = note
  confirmTitle.value = '删除笔记'
  confirmMessage.value = `确定要删除笔记 "${note.title}" 吗？将移入回收站。`
  confirmDialogVisible.value = true
}

async function handleConfirmDelete() {
  if (noteToDelete.value) {
    await remove(noteToDelete.value.id)
    noteToDelete.value = null
  }
}

function handleContextMenu(event: MouseEvent, note: any) {
  event.preventDefault()
  contextMenuNote.value = note
  contextMenuAnchor.value = null
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

function openContextMenu(event: Event, note: any) {
  contextMenuNote.value = note
  contextMenuAnchor.value = event.target as HTMLElement
  contextMenuVisible.value = true
}

function handleBlankContextMenu(event: MouseEvent) {
  // Only handle if clicking directly on ul or empty area, not on li
  const target = event.target as HTMLElement
  if (!target.classList.contains('note-items') && !target.classList.contains('empty')) {
    return
  }
  contextMenuNote.value = null
  contextMenuAnchor.value = null
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

function handleRenameConfirm(newName: string) {
  if (!renamingNote.value || !newName) return
  rename(renamingNote.value.id, newName)
}

function getContextMenuItems() {
  const items = [
    {
      label: '新建笔记',
      icon: 'svg-note-plain',
      action: () => {
        if (checkFolderSelected()) {
          newNoteDialogVisible.value = true
        }
      }
    }
  ]
  if (contextMenuNote.value) {
    items.push(
      {
        label: '重命名',
        icon: 'svg-rename',
        action: () => {
          if (!contextMenuNote.value) return
          renamingNote.value = contextMenuNote.value
          renameDefaultValue.value = contextMenuNote.value.title
          renameDialogVisible.value = true
        }
      },
      {
        label: '删除',
        icon: 'svg-delete',
        action: () => {
          if (!contextMenuNote.value) return
          showDeleteConfirm(contextMenuNote.value)
        }
      }
    )
  }
  return items
}

const contextMenuItems = computed(() => getContextMenuItems())

// 拖拽排序相关状态
const draggingNoteId = ref<string | null>(null)
const dragOverNoteId = ref<string | null>(null)
const dragPosition = ref<'before' | 'after' | null>(null)

// 获取鼠标在元素中的相对位置，判断是放在前面还是后面
function getDragPosition(event: DragEvent, element: HTMLElement): 'before' | 'after' {
  const rect = element.getBoundingClientRect()
  const y = event.clientY - rect.top
  return y < rect.height / 2 ? 'before' : 'after'
}

// 拖拽开始
function handleDragStart(event: DragEvent, note: any) {
  draggingNoteId.value = note.id
  event.dataTransfer?.setData('text/plain', note.id)
  event.dataTransfer!.effectAllowed = 'move'
  // 设置拖拽 ghost 图像
  const dragImage = document.createElement('div')
  dragImage.textContent = note.title
  dragImage.style.position = 'absolute'
  dragImage.style.top = '-1000px'
  document.body.appendChild(dragImage)
  event.dataTransfer?.setDragImage(dragImage, 0, 0)
  setTimeout(() => {
    document.body.removeChild(dragImage)
  }, 0)
}

// 拖拽经过（同时处理 enter 和 over）
function handleDragOver(event: DragEvent, note: any) {
  event.preventDefault()
  if (draggingNoteId.value === note.id) {
    return
  }

  const position = getDragPosition(event, event.currentTarget as HTMLElement)
  dragOverNoteId.value = note.id
  dragPosition.value = position
  event.dataTransfer!.dropEffect = 'move'
}

// 拖拽离开
function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  // 清除状态
  dragOverNoteId.value = null
  dragPosition.value = null
}

// 放下
async function handleDrop(event: DragEvent, targetNote: any) {
  event.preventDefault()
  const draggedId = event.dataTransfer?.getData('text/plain')

  if (!draggedId || draggedId === targetNote.id) {
    dragOverNoteId.value = null
    dragPosition.value = null
    draggingNoteId.value = null
    return
  }

  const draggedIndex = notes.value.findIndex(n => n.id === draggedId)
  const targetIndex = notes.value.findIndex(n => n.id === targetNote.id)

  if (draggedIndex === -1 || targetIndex === -1) {
    dragOverNoteId.value = null
    dragPosition.value = null
    draggingNoteId.value = null
    return
  }

  // 判断是相邻元素且位置不变的情况
  const position = dragPosition.value || 'before'
  if (
    (position === 'before' && draggedIndex === targetIndex - 1) ||
    (position === 'after' && draggedIndex === targetIndex + 1) ||
    (position === 'before' && draggedIndex === targetIndex) ||
    (position === 'after' && draggedIndex === targetIndex)
  ) {
    dragOverNoteId.value = null
    dragPosition.value = null
    draggingNoteId.value = null
    return
  }

  // 计算新的 order 值
  let newOrder: number

  if (position === 'before') {
    // 放在目标笔记前面
    const prevNote = targetIndex > 0 ? notes.value[targetIndex - 1] : null
    const targetOrder = targetNote.order ?? 0

    if (!prevNote || prevNote.id === draggedId) {
      // 目标是第一个或者前一个就是被拖动的
      newOrder = targetOrder - 1000
    } else {
      const prevOrder = prevNote.order ?? 0
      newOrder = (prevOrder + targetOrder) / 2
    }
  } else {
    // 放在目标笔记后面
    const nextNote = targetIndex < notes.value.length - 1 ? notes.value[targetIndex + 1] : null
    const targetOrder = targetNote.order ?? 0

    if (!nextNote || nextNote.id === draggedId) {
      // 目标是最后一个或者后一个就是被拖动的
      newOrder = targetOrder + 1000
    } else {
      const nextOrder = nextNote.order ?? 0
      newOrder = (targetOrder + nextOrder) / 2
    }
  }

  // 更新被拖拽笔记的顺序
  await updateNoteOrder(draggedId, newOrder)

  // 清理状态
  dragOverNoteId.value = null
  dragPosition.value = null
  draggingNoteId.value = null
}

// 拖拽结束
function handleDragEnd(event: DragEvent) {
  dragOverNoteId.value = null
  dragPosition.value = null
  draggingNoteId.value = null
}
</script>

<style scoped>
.note-list {
  width: 100%;
  height: 100%;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.header-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.add-btn,
.action-btn {
  background: none;
  border: none;
  width: 24px;
  height: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn:hover,
.action-btn:hover {
  background: var(--bg-primary);
  color: var(--accent-color);
}

/* 暗色主题下使用不同的颜色 */
:root[data-theme='dark'] .add-btn,
:root[data-theme='dark'] .action-btn {
  color: var(--text-primary);
}

.note-items {
  list-style: none;
  flex: 1;
  overflow-y: auto;
}

.note-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s, transform 0.2s;
}

.note-item.dragging {
  opacity: 0.5;
  background: var(--bg-secondary);
}

.note-item[draggable="true"] {
  user-select: none;
}

.note-item.drag-over-before {
  border-top: 2px solid var(--drag-over-border-color);
}

.note-item.drag-over-after {
  border-bottom: 2px solid var(--drag-over-border-color);
}

/* 当拖到最后一个元素后面时，添加底部边框 */
.note-item.drag-over-after:last-child {
  border-bottom: 2px solid var(--drag-over-border-color);
}

.note-icon {
  font-size: 14px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.note-icon .svg-icon {
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

.note-icon .svg-note-plain {
  -webkit-mask-image: url('../assets/icons/note-plain.svg');
  mask-image: url('../assets/icons/note-plain.svg');
}

.note-icon .svg-note-markdown {
  -webkit-mask-image: url('../assets/icons/note-markdown.svg');
  mask-image: url('../assets/icons/note-markdown.svg');
}

.note-icon .svg-note-richtext {
  -webkit-mask-image: url('../assets/icons/note-richtext.svg');
  mask-image: url('../assets/icons/note-richtext.svg');
}

.note-item:hover {
  background: var(--bg-secondary);
}

.note-item.active {
  background: var(--bg-selected);
  color: var(--text-primary);
}

.note-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-date {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.note-item.active .note-date {
  color: var(--text-primary);
}

.note-item.active .note-menu-btn {
  color: var(--text-primary);
}

.note-menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.note-item:hover .note-menu-btn {
  opacity: 1;
}

.empty {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
