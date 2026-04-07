<template>
  <div class="folder-tree">
    <div class="tree-header">
      <span class="header-title">文件夹</span>
      <div class="header-actions">
        <button class="add-btn" @click="openNewFolderDialog" title="新建文件夹">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button
          class="toggle-btn"
          @click="$emit('toggle-collapse')"
          title="收起导航"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>
    </div>
    <ul class="tree-list" @contextmenu.prevent="handleBlankContextMenu">
      <li v-for="folder in rootFolders" :key="folder.id" class="tree-item">
        <FolderItem
          :folder="folder"
          :all-folders="folders"
          :current-folder-id="currentFolderId"
          :expanded-folders="expandedFolderIds"
          @select="selectFolder"
          @contextmenu="handleContextMenu"
          @toggle="toggleExpand"
          @show-menu="showContextMenu"
        />
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
      title="重命名文件夹"
      :default-value="renameDefaultValue"
      @confirm="handleRenameConfirm"
    />

    <!-- 新建文件夹对话框 -->
    <FolderDialog
      v-model="newFolderDialogVisible"
      :title="newFolderDialogTitle"
      :default-value="newFolderDefaultValue"
      @confirm="handleNewFolderConfirm"
    />

    <!-- 新建笔记对话框 -->
    <NoteDialog
      v-model="newNoteDialogVisible"
      title="新建笔记"
      :default-value="''"
      :folder-name="contextMenuFolder?.name"
      @confirm="handleNewNoteConfirm"
    />

    <!-- 确认删除对话框 -->
    <ConfirmDialog
      v-model="deleteConfirmVisible"
      :title="deleteConfirmTitle"
      :message="deleteConfirmMessage"
      confirm-text="删除"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVault, onNavigationRefresh } from '../composables/useVault'
import ContextMenu from './ContextMenu.vue'
import RenameDialog from './RenameDialog.vue'
import FolderDialog from './FolderDialog.vue'
import FolderItem from './FolderItem.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import NoteDialog from './NoteDialog.vue'

defineEmits<{ 'toggle-collapse': [] }>()

const { folders, currentFolderId, selectFolder, createFolder: create, deleteFolder: remove, renameFolder: rename, loadFolders: reloadFolders, expandedFolderIds, toggleExpandFolder: toggleExpand, createNote } = useVault()
let unsubscribe: (() => void) | null = null

// 加载设置
onMounted(async () => {
  unsubscribe = onNavigationRefresh(async () => {
    // 保存当前展开状态
    const savedExpanded = new Set(expandedFolderIds.value)
    // 刷新文件夹列表
    await reloadFolders()
    // 过滤掉已经不存在的文件夹ID
    const currentFolderIds = new Set(folders.value.map((f: any) => f.id))
    for (const id of savedExpanded) {
      if (!currentFolderIds.has(id)) {
        savedExpanded.delete(id)
      }
    }
    expandedFolderIds.value = savedExpanded
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
const contextMenuFolder = ref<any>(null)
const contextMenuAnchor = ref<HTMLElement | null>(null)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const isBlankContext = ref(false) // 是否是空白区域右键

// 重命名对话框
const renameDialogVisible = ref(false)
const renameDefaultValue = ref('')
const renamingFolder = ref<any>(null)

// 新建文件夹对话框
const newFolderDialogVisible = ref(false)
const newFolderDialogTitle = ref('新建文件夹')
const newFolderDefaultValue = ref('')
const newFolderParentId = ref<string | null>(null)

// 新建笔记对话框
const newNoteDialogVisible = ref(false)

// 确认删除对话框
const deleteConfirmVisible = ref(false)
const deleteConfirmTitle = ref('')
const deleteConfirmMessage = ref('')
const folderToDelete = ref<any>(null)

function openNewFolderDialog() {
  newFolderParentId.value = null
  newFolderDialogTitle.value = '新建文件夹(ROOT)'
  newFolderDefaultValue.value = ''
  newFolderDialogVisible.value = true
}

function openNewSubFolderDialog(parentFolder: any) {
  newFolderParentId.value = parentFolder.id
  newFolderDialogTitle.value = `新建子文件夹 (${parentFolder.name})`
  newFolderDefaultValue.value = ''
  newFolderDialogVisible.value = true
}

function handleNewFolderConfirm(name: string) {
  create(newFolderParentId.value, name)
}

function handleNewNoteConfirm(data: { title: string; format: string }) {
  if (!contextMenuFolder.value) return
  selectFolder(contextMenuFolder.value.id).then(() => {
    createNote(data.title, data.format)
  })
}

function showContextMenu(event: Event, folder: any) {
  contextMenuFolder.value = folder
  contextMenuAnchor.value = event.target as HTMLElement
  contextMenuVisible.value = true
}

function handleContextMenu(event: MouseEvent, folder: any) {
  event.preventDefault()
  contextMenuFolder.value = folder
  contextMenuAnchor.value = null
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  isBlankContext.value = false
  contextMenuVisible.value = true
}

function handleBlankContextMenu(event: MouseEvent) {
  // 空白区域右键，只显示新建文件夹
  event.preventDefault()
  contextMenuFolder.value = null
  contextMenuAnchor.value = null
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  isBlankContext.value = true
  contextMenuVisible.value = true
}

function handleRenameConfirm(newName: string) {
  if (!renamingFolder.value || !newName) return
  rename(renamingFolder.value.id, newName)
}

function showDeleteConfirm(folder: any) {
  folderToDelete.value = folder
  deleteConfirmTitle.value = '删除文件夹'
  deleteConfirmMessage.value = `确定要删除文件夹 "${folder.name}" 吗？其内容将移入回收站。`
  deleteConfirmVisible.value = true
}

async function handleConfirmDelete() {
  if (folderToDelete.value) {
    await remove(folderToDelete.value.id)
    folderToDelete.value = null
  }
}

const contextMenuItems = computed(() => {
  if (isBlankContext.value) {
    // 空白区域右键，只显示新建文件夹
    return [
      {
        label: '新建文件夹',
        icon: 'svg-folder',
        action: () => {
          openNewFolderDialog()
        }
      }
    ]
  }
  // 文件夹上右键，显示完整菜单
  return [
    {
      label: '新建笔记',
      icon: 'svg-note-plain',
      action: () => {
        newNoteDialogVisible.value = true
      }
    },
    {
      label: '新建子文件夹',
      icon: 'svg-folder',
      action: () => {
        if (!contextMenuFolder.value) return
        openNewSubFolderDialog(contextMenuFolder.value)
      }
    },
    {
      label: '重命名',
      icon: 'svg-rename',
      action: () => {
        if (!contextMenuFolder.value) return
        renamingFolder.value = contextMenuFolder.value
        renameDefaultValue.value = contextMenuFolder.value.name
        renameDialogVisible.value = true
      }
    },
    {
      label: '删除',
      icon: 'svg-delete',
      action: () => {
        if (!contextMenuFolder.value) return
        showDeleteConfirm(contextMenuFolder.value)
      }
    }
  ]
})

const rootFolders = computed(() => {
  return folders.value
    .filter(f => !f.parent_id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})
</script>

<style scoped>
.folder-tree {
  width: 100%;
  height: 100%;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  overflow: hidden;
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  font-size: 13px;
}

.header-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.add-btn,
.toggle-btn {
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
.toggle-btn:hover {
  background: var(--bg-primary);
  color: var(--accent-color);
}

/* 暗色主题下使用不同的颜色 */
:root[data-theme='dark'] .add-btn:hover,
:root[data-theme='dark'] .toggle-btn:hover {
  color: var(--text-primary);
}

.tree-list {
  list-style: none;
  flex: 1;
  overflow-y: auto;
  padding: 0;
  margin: 0;
}

.tree-item {
  list-style: none;
}
</style>
