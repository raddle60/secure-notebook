<template>
  <div class="folder-item">
    <div
      class="folder-row"
      :class="{
        active: folder.id === currentFolderId,
        'dragging-source': isDraggingSource,
        'drag-over-before': !isDraggingNote && dragOverFolderId === folder.id && dragPosition === 'before',
        'drag-over-after': !isDraggingNote && dragOverFolderId === folder.id && dragPosition === 'after',
        'drag-over-inside': dragOverFolderId === folder.id && (dragPosition === 'inside' || isDraggingNote)
      }"
      draggable="true"
      @dragstart="handleDragStart"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @dragend="handleDragEnd"
      @click="handleClick"
      @dblclick.stop="handleDblClick"
      @contextmenu.stop="onContextMenu"
    >
      <span v-if="hasChildren" class="expand-icon" @click.stop="handleToggle">
        {{ isExpanded ? '▼' : '▶' }}
      </span>
      <span v-else class="expand-icon-placeholder"></span>
      <span class="folder-icon" @click.stop="handleToggle">
        <span v-if="hasChildren && isExpanded" class="svg-icon svg-folder-open"></span>
        <span v-else-if="hasChildren" class="svg-icon svg-folder"></span>
        <span v-else class="svg-icon svg-folder-empty"></span>
      </span>
      <span class="folder-name">{{ folder.name }}</span>
      <button class="item-btn" @click.stop="handleShowMenu">⋯</button>
    </div>
    <ul v-if="isExpanded && hasChildren" class="tree-list nested">
      <FolderItem
        v-for="child in children"
        :key="child.id"
        :folder="child"
        :all-folders="allFolders"
        :current-folder-id="currentFolderId"
        :expanded-folders="expandedFolders"
        @select="$emit('select', $event)"
        @contextmenu="forwardContextMenu"
        @toggle="$emit('toggle', $event)"
        @show-menu="forwardShowMenu"
      />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVault } from '../composables/useVault'

const props = defineProps<{
  folder: any
  allFolders: any[]
  currentFolderId: string | null
  expandedFolders: Set<string>
}>()

const emit = defineEmits<{
  select: [id: string]
  contextmenu: [event: MouseEvent, folder: any]
  toggle: [id: string]
  'show-menu': [event: Event, folder: any]
}>()

const isDragOver = ref(false)
const isDraggingSource = ref(false)
const dragOverFolderId = ref<string | null>(null)
const dragPosition = ref<'before' | 'after' | 'inside' | null>(null)
const isDraggingNote = ref(false)  // 当前拖拽的是否为笔记

// 判断拖拽类型（文件夹/笔记）
function getDragType(event: DragEvent): 'folder' | 'note' | null {
  const types = event.dataTransfer?.types || []
  if (types.includes('application/x-folder-id')) {
    return 'folder'
  }
  if (types.includes('text/plain')) {
    return 'note'
  }
  return null
}

// 判断放置位置（前面/后面/内部）
function getDragPosition(event: DragEvent, element: HTMLElement): 'before' | 'after' | 'inside' {
  const row = element.closest('.folder-row') as HTMLElement
  if (!row) return 'inside'
  const rect = row.getBoundingClientRect()
  const y = event.clientY - rect.top
  const threshold = rect.height * 0.3  // 上下各 30% 为 before/after，中间 40% 为 inside

  if (y < rect.height * 0.3) return 'before'
  if (y > rect.height * 0.7) return 'after'
  return 'inside'
}

// 处理作为拖拽源的情况（文件夹被拖拽）
function handleDragStart(event: DragEvent) {
  // 标记拖拽类型为 folder
  event.dataTransfer?.setData('text/plain', props.folder.id)
  event.dataTransfer?.setData('application/x-folder-id', props.folder.id)
  event.dataTransfer!.effectAllowed = 'move'
  isDraggingSource.value = true

  // 设置自定义拖拽图像
  const dragImage = document.createElement('div')
  dragImage.textContent = props.folder.name
  dragImage.style.padding = '8px 12px'
  dragImage.style.background = 'var(--bg-primary)'
  dragImage.style.border = '1px solid var(--border-color)'
  dragImage.style.borderRadius = '4px'
  document.body.appendChild(dragImage)
  event.dataTransfer?.setDragImage(dragImage, 0, 0)
  setTimeout(() => document.body.removeChild(dragImage), 0)
}

function handleDragEnd() {
  isDraggingSource.value = false
  dragOverFolderId.value = null
  dragPosition.value = null
  isDragOver.value = false
}

// 处理作为拖拽目标的情况（接收拖拽）
async function handleDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()

  const folderId = event.dataTransfer?.getData('application/x-folder-id')
  const noteId = event.dataTransfer?.getData('text/plain')

  // 保存放置位置，因为后面会清空
  const position = dragPosition.value

  const { moveNote, moveFolder } = useVault()

  // 清理状态
  isDragOver.value = false
  dragOverFolderId.value = null
  dragPosition.value = null

  // 如果是文件夹拖拽
  if (folderId) {
    // 不能拖到自己身上
    if (folderId === props.folder.id) {
      return
    }
    // 根据放置位置调用 moveFolder
    if (position) {
      const result = await moveFolder(folderId, props.folder.id, position)
      if (!result.success) {
        console.error('移动文件夹失败:', result.error)
      }
    }
    return
  }

  // 如果是笔记拖拽
  if (noteId) {
    await moveNote(noteId, props.folder.id)
  }
}

function handleDragEnter(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()

  // 检测拖拽的是笔记还是文件夹
  const dragType = getDragType(event)
  const isNote = dragType === 'note'
  isDraggingNote.value = isNote

  // 判断放置位置
  const row = (event.target as HTMLElement).closest('.folder-row')
  if (row) {
    const position = getDragPosition(event, row)
    dragOverFolderId.value = props.folder.id
    // 如果是笔记拖拽，只显示 inside 高亮
    if (isNote) {
      dragPosition.value = 'inside'
    } else {
      dragPosition.value = position
    }
  } else {
    dragOverFolderId.value = props.folder.id
  }
  isDragOver.value = true
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  // 保持高亮状态，并更新放置位置
  event.dataTransfer!.dropEffect = 'move'

  // 检测拖拽的是笔记还是文件夹
  const dragType = getDragType(event)
  const isNote = dragType === 'note'
  isDraggingNote.value = isNote

  const row = (event.target as HTMLElement).closest('.folder-row')
  if (row) {
    const position = getDragPosition(event, row)
    dragOverFolderId.value = props.folder.id
    // 如果是笔记拖拽，只显示 inside 高亮
    if (isNote) {
      dragPosition.value = 'inside'
    } else if (dragPosition.value !== position) {
      dragPosition.value = position
    }
  }
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  // 检查是否真的离开了文件夹区域（而不是进入子元素）
  const relatedTarget = event.relatedTarget as HTMLElement
  const folderRow = (event.target as HTMLElement).closest('.folder-row')
  if (!folderRow || !folderRow.contains(relatedTarget)) {
    isDragOver.value = false
    dragOverFolderId.value = null
    dragPosition.value = null
  }
}

const isExpanded = computed(() => props.expandedFolders.has(props.folder.id))

const children = computed(() => {
  return props.allFolders
    .filter(f => f.parent_id === props.folder.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})

const hasChildren = computed(() => {
  return props.allFolders.some(f => f.parent_id === props.folder.id)
})

function handleClick() {
  // 只选中文件夹，不展开/折叠
  emit('select', props.folder.id)
}

function handleDblClick() {
  // 双击切换展开/折叠
  if (hasChildren.value) {
    emit('toggle', props.folder.id)
  }
}

function onContextMenu(event: MouseEvent) {
  // 阻止事件冒泡到父组件的 DOM 元素
  event.stopPropagation()
  // emit 事件给父组件
  emit('contextmenu', event, props.folder)
}

function handleToggle() {
  emit('toggle', props.folder.id)
}

function handleShowMenu(event: Event) {
  event.stopPropagation()
  emit('show-menu', event, props.folder)
}

function forwardContextMenu(event: MouseEvent, child: any) {
  emit('contextmenu', event, child)
}

function forwardShowMenu(event: Event, child: any) {
  emit('show-menu', event, child)
}
</script>

<style scoped>
.folder-item {
  width: 100%;
}

.tree-list.nested {
  margin-left: 16px;
  list-style: none;
  padding: 0;
}

.folder-row {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  gap: 4px;
  box-sizing: border-box;
}

.folder-row:hover {
  background: var(--bg-primary);
}

.folder-row.active {
  background: var(--bg-selected);
  color: var(--text-primary);
}

.folder-row.drag-over-before {
  border-top: 2px solid var(--drag-over-border-color);
  padding-top: 6px;
}

.folder-row.drag-over-after {
  border-bottom: 2px solid var(--drag-over-border-color);
  padding-bottom: 6px;
}

.folder-row.drag-over-inside {
  background: var(--drag-over-bg-color) !important;
  color: var(--text-primary);
}

.folder-row.dragging-source {
  opacity: 0.5;
}

.folder-icon {
  font-size: 14px;
  width: 16px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.folder-icon .svg-icon {
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

.folder-icon .svg-folder-open {
  -webkit-mask-image: url('../assets/icons/folder-open.svg');
  mask-image: url('../assets/icons/folder-open.svg');
}

.folder-icon .svg-folder {
  -webkit-mask-image: url('../assets/icons/folder.svg');
  mask-image: url('../assets/icons/folder.svg');
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

.folder-row.active .expand-icon {
  color: var(--text-primary);
}

.expand-icon-placeholder {
  flex-shrink: 0;
  width: 12px;
}

.folder-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.item-btn {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0;
  font-size: 14px;
}

.folder-row:hover .item-btn {
  opacity: 1;
}
</style>
