<template>
  <div class="folder-item">
    <div class="item-row" @contextmenu.prevent="showFolderMenu($event)" @dblclick.stop="handleDblClick">
      <span v-if="hasChildren || folderNotes.length > 0" class="expand-icon" @click.stop="handleToggle">
        {{ isExpanded ? '▼' : '▶' }}
      </span>
      <span v-else class="expand-icon-placeholder"></span>
      <span class="folder-icon" @click.stop="handleToggle">
        <span v-if="hasChildren || folderNotes.length > 0" :class="isExpanded ? 'svg-folder-open' : 'svg-folder'"></span>
        <span v-else class="svg-folder-empty"></span>
      </span>
      <span class="item-name">{{ folder.name }}</span>
      <span class="item-date">{{ formatDate(folder.deleted_at) }}</span>
      <button class="item-menu-btn" @click.stop="showFolderMenu($event)">⋯</button>
    </div>
    <div v-if="isExpanded && hasChildren" class="children-list">
      <RecycleFolderItem
        v-for="child in children"
        :key="child.id"
        :folder="child"
        :all-folders="allFolders"
        :all-notes="allNotes"
        @restore-folder="$emit('restoreFolder', child.id)"
        @delete-folder="$emit('deleteFolder', child.id)"
        @restore-note="$emit('restoreNote', $event)"
        @delete-note="$emit('deleteNote', $event)"
        @restore-attachment="$emit('restoreAttachment', $event)"
        @delete-attachment="$emit('deleteAttachment', $event)"
      />
    </div>
    <!-- 文件夹内的笔记 -->
    <div v-if="isExpanded && folderNotes.length > 0" class="children-list">
      <div
        v-for="note in folderNotes"
        :key="note.id"
        class="note-item"
        @contextmenu.prevent="showNoteMenu($event, note)"
      >
        <div class="note-row">
          <span class="item-icon svg-note-plain"></span>
          <span class="item-name">{{ note.title }}</span>
          <span class="item-date">{{ formatDate(note.deleted_at) }}</span>
          <button class="item-menu-btn" @click.stop="showNoteMenu($event, note)">⋯</button>
        </div>
      </div>
    </div>

    <!-- 文件夹右键菜单 -->
    <ContextMenu
      v-model="folderMenuVisible"
      :position="menuPosition"
      :items="folderMenuItems"
    />

    <!-- 笔记右键菜单 -->
    <ContextMenu
      v-model="noteMenuVisible"
      :position="menuPosition"
      :items="noteMenuItems"
    />

    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-text="confirmText"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ContextMenu from './ContextMenu.vue'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps<{
  folder: any
  allFolders: any[]
  allNotes: any[]
}>()

const emit = defineEmits<{
  restoreFolder: [folderId: string]
  deleteFolder: [folderId: string]
  restoreNote: [noteId: string]
  deleteNote: [noteId: string]
  restoreAttachment: [attachmentId: string]
  deleteAttachment: [attachmentId: string]
}>()

const isExpanded = ref(!props.folder.parent_id)
const folderMenuVisible = ref(false)
const noteMenuVisible = ref(false)
const menuPosition = ref({ x: 0, y: 0 })
const selectedNote = ref<any>(null)
const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmText = ref('')
const confirmAction = ref<'restore' | 'delete'>('restore')
const confirmTarget = ref<{ type: 'folder' | 'note'; id: string; name: string } | null>(null)

const children = computed(() => {
  return props.allFolders.filter(f => f.parent_id === props.folder.id)
})

const hasChildren = computed(() => children.value.length > 0)

const folderNotes = computed(() => {
  return props.allNotes.filter(n => n.folder_id === props.folder.id)
})

function handleToggle() {
  if (hasChildren.value || folderNotes.value.length > 0) {
    isExpanded.value = !isExpanded.value
  }
}

function handleDblClick() {
  // 双击切换展开/折叠
  if (hasChildren.value || folderNotes.value.length > 0) {
    isExpanded.value = !isExpanded.value
  }
}

function showFolderMenu(event: MouseEvent) {
  menuPosition.value = { x: event.clientX, y: event.clientY }
  folderMenuVisible.value = true
}

function showNoteMenu(event: MouseEvent, note: any) {
  selectedNote.value = note
  menuPosition.value = { x: event.clientX, y: event.clientY }
  noteMenuVisible.value = true
}

const folderMenuItems = [
  {
    label: '恢复',
    icon: 'svg-restore',
    action: () => showConfirm('restore', 'folder', props.folder.id, props.folder.name)
  },
  {
    label: '删除',
    icon: 'svg-delete',
    action: () => showConfirm('delete', 'folder', props.folder.id, props.folder.name)
  }
]

function showConfirm(action: 'restore' | 'delete', type: 'folder' | 'note', id: string, name: string) {
  confirmAction.value = action
  confirmTarget.value = { type, id, name }
  confirmText.value = action === 'restore' ? '恢复' : '删除'
  confirmTitle.value = `${confirmText.value}${type === 'folder' ? '文件夹' : '笔记'}`
  if (action === 'restore') {
    confirmMessage.value = `确定要恢复 ${type === 'folder' ? '文件夹' : '笔记'} "${name}" 吗？`
  } else if (type === 'note' && selectedNote.value?.is_external) {
    confirmMessage.value = `确定要删除外部笔记 "${name}" 吗？此操作仅删除笔记元信息，外部文件不会被删除。`
  } else {
    confirmMessage.value = `确定要删除 ${type === 'folder' ? '文件夹' : '笔记'} "${name}" 吗？此操作不可恢复。`
  }
  confirmVisible.value = true
}

function showDeleteFolderConfirm() {
  showConfirm('delete', 'folder', props.folder.id, props.folder.name)
}

function showRestoreFolderConfirm() {
  showConfirm('restore', 'folder', props.folder.id, props.folder.name)
}

function showDeleteNoteConfirm() {
  showConfirm('delete', 'note', selectedNote.value.id, selectedNote.value.title)
}

function showRestoreNoteConfirm() {
  showConfirm('restore', 'note', selectedNote.value.id, selectedNote.value.title)
}

function handleConfirm() {
  if (!confirmTarget.value || !confirmAction.value) return
  const { type, id } = confirmTarget.value
  const action = confirmAction.value

  if (type === 'folder') {
    if (action === 'restore') {
      emit('restoreFolder', id)
    } else {
      emit('deleteFolder', id)
    }
  } else {
    if (action === 'restore') {
      emit('restoreNote', id)
    } else {
      emit('deleteNote', id)
    }
  }
  confirmTarget.value = null
}

const noteMenuItems = [
  {
    label: '恢复',
    icon: 'svg-restore',
    action: () => showConfirm('restore', 'note', selectedNote.value.id, selectedNote.value.title)
  },
  {
    label: '删除',
    icon: 'svg-delete',
    action: () => showConfirm('delete', 'note', selectedNote.value.id, selectedNote.value.title)
  }
]

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.folder-item {
  width: 100%;
  min-width: 0;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  min-width: 0;
}

.item-row:hover {
  background: var(--bg-primary);
}

.folder-icon {
  font-size: 14px;
  flex-shrink: 0;
  width: 16px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.folder-icon .svg-folder,
.folder-icon .svg-folder-open,
.folder-icon .svg-folder-empty {
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

.folder-icon .svg-folder {
  -webkit-mask-image: url('../assets/icons/folder.svg');
  mask-image: url('../assets/icons/folder.svg');
}

.folder-icon .svg-folder-open {
  -webkit-mask-image: url('../assets/icons/folder-open.svg');
  mask-image: url('../assets/icons/folder-open.svg');
}

.folder-icon .svg-folder-empty {
  -webkit-mask-image: url('../assets/icons/folder-empty.svg');
  mask-image: url('../assets/icons/folder-empty.svg');
}

.expand-icon {
  font-size: 10px;
  flex-shrink: 0;
  width: 12px;
  cursor: pointer;
  color: var(--text-secondary);
}

.expand-icon-placeholder {
  flex-shrink: 0;
  width: 12px;
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

.item-row:hover .item-menu-btn {
  opacity: 1;
}

.children-list {
  margin-left: 16px;
  min-height: 0;
  min-width: 0;
}

.note-item {
  width: 100%;
}

.note-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  min-width: 0;
}

.note-row:hover {
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

.item-icon.svg-note-plain {
  width: 16px;
  height: 16px;
  background-color: var(--text-primary);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-image: url('../assets/icons/note-plain.svg');
  mask-image: url('../assets/icons/note-plain.svg');
}
</style>
