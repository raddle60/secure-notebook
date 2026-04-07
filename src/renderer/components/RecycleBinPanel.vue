<template>
  <div class="recycle-bin-panel">
    <div class="panel-header">
      <span>回收站</span>
      <button class="empty-btn" @click="showEmptyConfirm" :disabled="isEmpty" title="清空回收站">
        <span class="svg-icon svg-empty"></span>
      </button>
    </div>
    <div class="panel-body">
      <div v-if="deletedItems.folders.length === 0 && deletedItems.notes.length === 0 && deletedItems.attachments.length === 0" class="empty">
        回收站为空
      </div>
      <div v-else class="tree-list">
        <!-- 已删除的文件夹（树形结构） -->
        <div v-for="folder in rootFolders" :key="folder.id" class="tree-item">
          <RecycleFolderItem
            :folder="folder"
            :all-folders="deletedItems.folders"
            :all-notes="deletedItems.notes"
            @restore-folder="handleRestoreFolder"
            @delete-folder="handleDeleteFolder"
            @restore-note="handleRestoreNote"
            @delete-note="handleDeleteNote"
            @restore-attachment="handleRestoreAttachment"
            @delete-attachment="handleDeleteAttachment"
          />
        </div>
        <!-- 孤立的笔记（没有文件夹的） -->
        <div v-for="note in orphanNotes" :key="note.id" class="tree-item note-item">
          <div class="item-row" @contextmenu.prevent="showNoteMenu($event, note)">
            <span class="item-icon svg-note-plain"></span>
            <span class="item-name">{{ note.title }}</span>
            <span class="item-date">{{ formatDate(note.deleted_at) }}</span>
            <button class="item-menu-btn" @click.stop="showNoteMenu($event, note)">⋯</button>
          </div>
        </div>
        <!-- 附件（笔记不在回收站中） -->
        <div v-for="att in orphanAttachments" :key="att.id" class="tree-item attachment-item" :class="{ orphaned: !att.canRestore }">
          <div class="item-row" @contextmenu.prevent="showAttachmentMenu($event, att, att.canRestore)">
            <span class="item-icon svg-attachment"></span>
            <span class="item-name">{{ att.filename }}</span>
            <span class="item-date">{{ formatDate(att.deleted_at) }}</span>
            <button class="item-menu-btn" @click.stop="showAttachmentMenu($event, att, att.canRestore)">⋯</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 笔记右键菜单 -->
    <ContextMenu
      v-model="noteMenuVisible"
      :position="menuPosition"
      :items="noteMenuItems"
    />

    <!-- 附件右键菜单 -->
    <ContextMenu
      v-model="attachmentMenuVisible"
      :position="menuPosition"
      :items="attachmentMenuItems"
    />

    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-text="confirmText"
      @confirm="handleConfirm"
    />

    <!-- 确认清空对话框 -->
    <ConfirmDialog
      v-model="emptyConfirmVisible"
      title="清空回收站"
      message="确定要清空回收站吗？此操作不可恢复。"
      confirm-text="清空"
      @confirm="handleEmptyAll"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ContextMenu from './ContextMenu.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import RecycleFolderItem from './RecycleFolderItem.vue'
import { onRecycleBinRefresh, emitNavigationRefresh, emitAttachmentRefresh, useVault } from '../composables/useVault'

const api = window.vaultAPI
const { refreshNotes } = useVault()
let unsubscribe: (() => void) | null = null

const deletedItems = ref<{ folders: any[]; notes: any[]; attachments: any[] }>({ folders: [], notes: [], attachments: [] })

const isEmpty = computed(() => deletedItems.value.folders.length === 0 && deletedItems.value.notes.length === 0 && deletedItems.value.attachments.length === 0)

// 根文件夹（没有 parent_id 或 parent 已被删除的）
const rootFolders = computed(() => {
  const folderIds = new Set(deletedItems.value.folders.map(f => f.id))
  return deletedItems.value.folders.filter(f => !f.parent_id || !folderIds.has(f.parent_id))
})

// 孤立的笔记（没有文件夹或文件夹已被删除的）
const orphanNotes = computed(() => {
  const folderIds = new Set(deletedItems.value.folders.map(f => f.id))
  return deletedItems.value.notes.filter(n => !n.folder_id || !folderIds.has(n.folder_id))
})

// 附件（笔记不在回收站中）：noteInRecycleBin=false 表示笔记不在回收站中
const orphanAttachments = computed(() => {
  return deletedItems.value.attachments.filter(a => a.noteInRecycleBin === false)
})

// 菜单相关
const noteMenuVisible = ref(false)
const attachmentMenuVisible = ref(false)
const menuPosition = ref({ x: 0, y: 0 })
const selectedNote = ref<any>(null)
const selectedAttachment = ref<any>(null)
const emptyConfirmVisible = ref(false)
const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmText = ref('')
const confirmAction = ref<'restore' | 'delete'>('restore')
const confirmTargetId = ref<string | null>(null)
const confirmType = ref<'note' | 'attachment'>('note')

const noteMenuItems = [
  {
    label: '恢复',
    icon: 'svg-restore',
    action: () => showNoteConfirm('restore', selectedNote.value.id, selectedNote.value.title)
  },
  {
    label: '删除',
    icon: 'svg-delete',
    action: () => showNoteConfirm('delete', selectedNote.value.id, selectedNote.value.title)
  }
]

const attachmentMenuItems = [
  {
    label: '恢复',
    icon: 'svg-restore',
    disabled: false,
    action: () => showAttachmentConfirm('restore', selectedAttachment.value.id, selectedAttachment.value.filename)
  },
  {
    label: '删除',
    icon: 'svg-delete',
    action: () => showAttachmentConfirm('delete', selectedAttachment.value.id, selectedAttachment.value.filename)
  }
]

function showNoteConfirm(action: 'restore' | 'delete', noteId: string, noteTitle: string) {
  confirmAction.value = action
  confirmTargetId.value = noteId
  confirmType.value = 'note'
  confirmText.value = action === 'restore' ? '恢复' : '删除'
  confirmTitle.value = `${confirmText.value}笔记`
  if (action === 'restore') {
    confirmMessage.value = `确定要恢复笔记 "${noteTitle}" 吗？`
  } else {
    confirmMessage.value = `确定要删除笔记 "${noteTitle}" 吗？此操作不可恢复。`
  }
  confirmVisible.value = true
}

function showAttachmentConfirm(action: 'restore' | 'delete', attachmentId: string, filename: string) {
  confirmAction.value = action
  confirmTargetId.value = attachmentId
  confirmType.value = 'attachment'
  confirmText.value = action === 'restore' ? '恢复' : '删除'
  confirmTitle.value = `${confirmText.value}附件`
  if (action === 'restore') {
    confirmMessage.value = `确定要恢复附件 "${filename}" 吗？`
  } else {
    confirmMessage.value = `确定要删除附件 "${filename}" 吗？此操作不可恢复。`
  }
  confirmVisible.value = true
}

function handleConfirm() {
  if (!confirmTargetId.value || !confirmAction.value) return
  const action = confirmAction.value
  const targetId = confirmTargetId.value
  const type = confirmType.value

  if (type === 'note') {
    if (action === 'restore') {
      api.recycle.restore({ folderIds: [], noteIds: [targetId], attachmentIds: [] })
    } else {
      api.recycle.purge({ folderIds: [], noteIds: [targetId], attachmentIds: [] })
    }
  } else {
    if (action === 'restore') {
      api.recycle.restore({ folderIds: [], noteIds: [], attachmentIds: [targetId] })
      // 通知编辑区附件列表刷新
      emitAttachmentRefresh()
    } else {
      api.recycle.purge({ folderIds: [], noteIds: [], attachmentIds: [targetId] })
    }
  }
  loadRecycleBin()
  emitNavigationRefresh()
  refreshNotes()
  confirmTargetId.value = null
}

onMounted(() => {
  loadRecycleBin()
  // 订阅回收站刷新事件（导航区删除文件夹后触发）
  unsubscribe = onRecycleBinRefresh(() => {
    loadRecycleBin()
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

async function loadRecycleBin() {
  deletedItems.value = await api.recycle.list()
}

// 清空回收站
function showEmptyConfirm() {
  emptyConfirmVisible.value = true
}

async function handleEmptyAll() {
  await api.recycle.empty()
  await loadRecycleBin()
  emitNavigationRefresh()
}

// 笔记操作
function showNoteMenu(event: MouseEvent, note: any) {
  selectedNote.value = note
  menuPosition.value = { x: event.clientX, y: event.clientY }
  noteMenuVisible.value = true
}

async function handleRestoreFolder(folderId: string) {
  await api.recycle.restore({ folderIds: [folderId], noteIds: [], attachmentIds: [] })
  await loadRecycleBin()
  emitNavigationRefresh()
  await refreshNotes()
}

async function handleDeleteFolder(folderId: string) {
  await api.recycle.purge({ folderIds: [folderId], noteIds: [], attachmentIds: [] })
  await loadRecycleBin()
  emitNavigationRefresh()
}

async function handleRestoreNote(noteId: string) {
  await api.recycle.restore({ folderIds: [], noteIds: [noteId], attachmentIds: [] })
  await loadRecycleBin()
  emitNavigationRefresh()
  await refreshNotes()
}

async function handleDeleteNote(noteId: string) {
  await api.recycle.purge({ folderIds: [], noteIds: [noteId], attachmentIds: [] })
  await loadRecycleBin()
  emitNavigationRefresh()
}

async function handleRestoreAttachment(attachmentId: string) {
  await api.recycle.restore({ folderIds: [], noteIds: [], attachmentIds: [attachmentId] })
  await loadRecycleBin()
  // 通知编辑区附件列表刷新
  emitAttachmentRefresh()
}

async function handleDeleteAttachment(attachmentId: string) {
  await api.recycle.purge({ folderIds: [], noteIds: [], attachmentIds: [attachmentId] })
  await loadRecycleBin()
  emitNavigationRefresh()
}

function showAttachmentMenu(event: MouseEvent, att: any, canRestore: boolean) {
  selectedAttachment.value = att
  // Update menu items based on whether attachment can be restored
  attachmentMenuItems[0].disabled = !canRestore
  attachmentMenuItems[0].label = canRestore ? '恢复' : '笔记已删除'
  menuPosition.value = { x: event.clientX, y: event.clientY }
  attachmentMenuVisible.value = true
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.recycle-bin-panel {
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.empty-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.empty-btn:hover {
  opacity: 1;
}

.empty-btn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.empty-btn .svg-icon {
  width: 18px;
  height: 18px;
  background-color: var(--text-primary);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.empty-btn .svg-empty {
  -webkit-mask-image: url('../assets/icons/empty.svg');
  mask-image: url('../assets/icons/empty.svg');
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 8px;
  min-height: 0;
}

.empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 24px;
  font-size: 13px;
}

.tree-list {
  list-style: none;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.tree-item {
  list-style: none;
  min-width: 0;
}

.note-item .item-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  min-width: 0;
}

.note-item:hover {
  background: var(--bg-primary);
}

.item-icon {
  font-size: 14px;
  flex-shrink: 0;
  width: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* SVG 图标样式 */
.item-icon.svg-note-plain,
.item-icon.svg-attachment {
  background-color: var(--text-primary);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.item-icon.svg-note-plain {
  -webkit-mask-image: url('../assets/icons/note-plain.svg');
  mask-image: url('../assets/icons/note-plain.svg');
}

.item-icon.svg-attachment {
  -webkit-mask-image: url('../assets/icons/attachment.svg');
  mask-image: url('../assets/icons/attachment.svg');
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-date {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.item-menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.note-item:hover .item-menu-btn {
  opacity: 1;
}

.attachment-item .item-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  min-width: 0;
}

.attachment-item:hover {
  background: var(--bg-primary);
}

.attachment-item:hover .item-menu-btn {
  opacity: 1;
}

.attachment-item.orphaned .item-name {
  color: var(--text-secondary);
}
</style>
