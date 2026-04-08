<template>
  <div id="app">
    <!-- 解锁屏幕：使用 v-show 仅隐藏而非销毁，保持主界面组件始终存活；key 基于当前目录，目录变化时强制重建组件 -->
    <UnlockScreen v-show="!isUnlocked && !isLoading" :key="currentVaultDir" class="unlock-overlay" />
    <div v-if="isLoading" class="loading">
      <p>加载中...</p>
    </div>
    <div v-show="!isLoading" class="main-layout">
      <div class="top-bar">
        <SearchBar />
        <div class="top-actions">
          <button class="action-btn" @click="showSettings = true">设置</button>
          <button class="action-btn" @click="handleLock">锁定</button>
        </div>
      </div>
      <div class="main-content">
        <div class="left-panel" :class="{ collapsed: isLeftPanelCollapsed }" :style="{ width: isLeftPanelCollapsed ? 0 : leftPanelWidth + 'px' }">
          <div class="folder-tree-container" :style="{ height: folderTreeHeight + 'px' }">
            <FolderTree @toggle-collapse="toggleLeftPanelCollapse" />
          </div>
          <div class="panel-resizer" @mousedown="startResize"></div>
          <div class="recycle-bin-container" :style="isResizing ? { height: recycleBinHeight + 'px' } : {}">
            <RecycleBinPanel />
          </div>
        </div>
        <!-- 悬浮展开按钮，始终显示 -->
        <button class="expand-panel-btn" :class="{ visible: isLeftPanelCollapsed }" @click="toggleLeftPanelCollapse" title="展开导航">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div class="vertical-resizer" v-show="!isLeftPanelCollapsed" @mousedown="startLeftPanelResize"></div>
        <div class="note-list-container" :style="{ width: noteListWidth + 'px' }">
          <NoteList />
        </div>
        <div class="vertical-resizer" @mousedown="startNoteListResize"></div>
        <Editor />
      </div>
    </div>

    <SettingsDialog v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useVault } from './composables/useVault'
import { useAutoLock } from './composables/useAutoLock'
import UnlockScreen from './components/UnlockScreen.vue'
import SearchBar from './components/SearchBar.vue'
import FolderTree from './components/FolderTree.vue'
import NoteList from './components/NoteList.vue'
import Editor from './components/Editor.vue'
import RecycleBinPanel from './components/RecycleBinPanel.vue'
import SettingsDialog from './components/SettingsDialog.vue'

const { isUnlocked, isLoading, checkUnlocked, lock } = useVault()
const showSettings = ref(false)
const api = window.vaultAPI

// 当前金库目录路径，用于控制 UnlockScreen 组件的 key
// 目录变化时，key 变化，Vue 会强制销毁并重建组件
const currentVaultDir = ref<string>('')

// 更新当前目录
async function updateCurrentVaultDir() {
  try {
    currentVaultDir.value = await api.vault.getCurrentDir()
  } catch (e) {
    currentVaultDir.value = ''
  }
}

// 监听解锁状态，当解锁成功后更新当前目录
watch(isUnlocked, async (unlocked) => {
  if (unlocked) {
    await updateCurrentVaultDir()
  }
})

// 自动锁定
const { autoLockMinutes, updateAutoLockMinutes } = useAutoLock(() => {
  // 自动锁定回调
  lock()
})

// 左侧面板高度分配
const folderTreeHeight = ref(400)
const recycleBinHeight = ref(200)
const isResizing = ref(false)
const startY = ref(0)
const startFolderHeight = ref(0)
const startRecycleHeight = ref(0)

// 导航区宽度分配
const leftPanelWidth = ref(250)
const isLeftPanelResizing = ref(false)
const startX = ref(0)
const startLeftPanelWidth = ref(0)

// 左侧面板折叠状态
const isLeftPanelCollapsed = ref(false)

// 笔记列表宽度分配
const noteListWidth = ref(250)
const isNoteListResizing = ref(false)
const startNoteListWidth = ref(0)

// 切换左侧面板折叠状态
async function toggleLeftPanelCollapse() {
  isLeftPanelCollapsed.value = !isLeftPanelCollapsed.value
  try {
    await api.settings.updateFolderTreeCollapsed(isLeftPanelCollapsed.value)
  } catch (e) {
    console.error('[App] Error saving UI settings:', e)
  }
}

// 加载设置
async function loadSettings() {
  try {
    const settings = await api.settings.get()
    if (settings.leftPanelWidth) leftPanelWidth.value = settings.leftPanelWidth
    if (settings.folderTreeHeight) folderTreeHeight.value = settings.folderTreeHeight
    if (settings.recycleBinHeight) recycleBinHeight.value = settings.recycleBinHeight
    if (settings.noteListWidth) noteListWidth.value = settings.noteListWidth

    // 加载 UI 显示设置
    const uiSettings = await api.settings.getUiDisplaySettings()
    if (uiSettings.folderTreeCollapsed !== undefined) {
      isLeftPanelCollapsed.value = uiSettings.folderTreeCollapsed
    }

    // 加载主题
    const theme = settings.theme || 'dark'
    document.documentElement.setAttribute('data-theme', theme)

    // 加载编辑器字体设置
    const font = await api.settings.getEditorFont()
    if (font?.fontFamily) {
      document.documentElement.style.setProperty('--editor-font-family', font.fontFamily)
    }
    if (font?.fontSize) {
      document.documentElement.style.setProperty('--editor-font-size', `${font.fontSize}px`)
    }
  } catch (e) {
    console.error('[App] Error loading settings:', e)
  }
}

// 保存设置
async function saveSettings() {
  try {
    await api.settings.update({
      leftPanelWidth: leftPanelWidth.value,
      folderTreeHeight: folderTreeHeight.value,
      recycleBinHeight: recycleBinHeight.value,
      noteListWidth: noteListWidth.value
    })
  } catch (e) {
    console.error('[App] Error saving settings:', e)
  }
}

function startResize(e: MouseEvent) {
  isResizing.value = true
  startY.value = e.clientY
  startFolderHeight.value = folderTreeHeight.value
  // 获取回收站容器的实际高度
  const recycleContainer = document.querySelector('.recycle-bin-container') as HTMLElement
  if (recycleContainer) {
    startRecycleHeight.value = recycleContainer.offsetHeight
  } else {
    startRecycleHeight.value = recycleBinHeight.value
  }
  // 添加 resizing-vertical 类，禁用内容区域的 pointer-events 并设置 cursor
  document.querySelector('.main-content')?.classList.add('resizing-vertical')
  // 直接在 body 上设置 cursor，确保全局生效
  document.body.style.cursor = 'row-resize'
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  const delta = startFolderHeight.value - (startY.value - e.clientY)
  const newFolderHeight = delta
  const newRecycleHeight = startRecycleHeight.value + (startY.value - e.clientY)
  if (newFolderHeight >= 150 && newRecycleHeight >= 100) {
    folderTreeHeight.value = newFolderHeight
    recycleBinHeight.value = newRecycleHeight
  }
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  // 移除 resizing-vertical 类，恢复内容区域的 pointer-events
  document.querySelector('.main-content')?.classList.remove('resizing-vertical')
  // 恢复 cursor
  document.body.style.cursor = ''
  saveSettings()
}

function startLeftPanelResize(e: MouseEvent) {
  isLeftPanelResizing.value = true
  startX.value = e.clientX
  startLeftPanelWidth.value = leftPanelWidth.value
  // 移除 transition，避免拖动延迟
  // 添加 resizing-horizontal 类，禁用内容区域的 pointer-events
  document.querySelector('.main-content')?.classList.add('resizing-horizontal')
  document.querySelector('.left-panel')?.classList.add('no-transition')
  // 直接在 body 上设置 cursor，确保全局生效
  document.body.style.cursor = 'col-resize'
  document.addEventListener('mousemove', onLeftPanelResize)
  document.addEventListener('mouseup', stopLeftPanelResize)
}

function onLeftPanelResize(e: MouseEvent) {
  const delta = e.clientX - startX.value
  const newWidth = startLeftPanelWidth.value + delta
  if (newWidth >= 150 && newWidth <= 400) {
    leftPanelWidth.value = newWidth
  }
}

function stopLeftPanelResize() {
  isLeftPanelResizing.value = false
  document.removeEventListener('mousemove', onLeftPanelResize)
  document.removeEventListener('mouseup', stopLeftPanelResize)
  // 移除 resizing-horizontal 类，恢复内容区域的 pointer-events
  document.querySelector('.main-content')?.classList.remove('resizing-horizontal')
  // 恢复 cursor
  document.body.style.cursor = ''
  // 恢复 transition，让折叠动画正常显示
  setTimeout(() => {
    document.querySelector('.left-panel')?.classList.remove('no-transition')
  }, 0)
  saveSettings()
}

function startNoteListResize(e: MouseEvent) {
  isNoteListResizing.value = true
  startX.value = e.clientX
  startNoteListWidth.value = noteListWidth.value
  // 移除 transition，避免拖动延迟
  // 添加 resizing-horizontal 类，禁用内容区域的 pointer-events
  document.querySelector('.main-content')?.classList.add('resizing-horizontal')
  document.querySelector('.note-list-container')?.classList.add('no-transition')
  // 直接在 body 上设置 cursor，确保全局生效
  document.body.style.cursor = 'col-resize'
  document.addEventListener('mousemove', onNoteListResize)
  document.addEventListener('mouseup', stopNoteListResize)
}

function onNoteListResize(e: MouseEvent) {
  const delta = e.clientX - startX.value
  const newWidth = startNoteListWidth.value + delta
  if (newWidth >= 150 && newWidth <= 500) {
    noteListWidth.value = newWidth
  }
}

function stopNoteListResize() {
  isNoteListResizing.value = false
  document.removeEventListener('mousemove', onNoteListResize)
  document.removeEventListener('mouseup', stopNoteListResize)
  // 移除 resizing-horizontal 类，恢复内容区域的 pointer-events
  document.querySelector('.main-content')?.classList.remove('resizing-horizontal')
  // 恢复 cursor
  document.body.style.cursor = ''
  // 恢复 transition
  setTimeout(() => {
    document.querySelector('.note-list-container')?.classList.remove('no-transition')
  }, 0)
  saveSettings()
}

onMounted(() => {
  loadSettings()
  checkUnlocked()
})

async function handleLock() {
  await lock()
  // 锁定后不需要清空目录，保持 currentVaultDir 为当前目录
  // 这样同目录锁定时，key 不变，组件不会重建
  // 只有当用户在解锁页面切换到不同目录并解锁成功后，currentVaultDir 才会变化
}
</script>

<style scoped>
#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 解锁屏幕覆盖层：定位在最上层，覆盖主界面但保持主界面组件存活 */
.unlock-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.top-bar > :first-child {
  flex: 1;
}

.top-actions {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}

.action-btn:hover {
  background: var(--bg-hover);
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 拖动时禁用内容区域的 pointer-events，确保 mouseup 能被正确捕获 */
.main-content.resizing {
  pointer-events: none;
}

/* 垂直拖动（上下）- 回收站分割栏 */
.main-content.resizing-vertical {
  pointer-events: none;
  cursor: row-resize !important;
}
.main-content.resizing-vertical .editor-body,
.main-content.resizing-vertical .note-list-container,
.main-content.resizing-vertical .folder-tree-container,
.main-content.resizing-vertical .recycle-bin-container {
  pointer-events: none;
  cursor: row-resize !important;
}

/* 水平拖动（左右）- 导航区和笔记列表分割栏 */
.main-content.resizing-horizontal {
  pointer-events: none;
  cursor: col-resize !important;
}
.main-content.resizing-horizontal .editor-body,
.main-content.resizing-horizontal .note-list-container,
.main-content.resizing-horizontal .left-panel,
.main-content.resizing-horizontal .folder-tree-container {
  pointer-events: none;
  cursor: col-resize !important;
}

.left-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  min-width: 0;
  max-width: 400px;
  transition: width 0.2s ease;
}

/* 拖动时移除 transition，避免延迟 */
.left-panel.no-transition {
  transition: none !important;
}

.left-panel.collapsed {
  min-width: 0;
  width: 0 !important;
}

.left-panel.collapsed .folder-tree-container,
.left-panel.collapsed .panel-resizer,
.left-panel.collapsed .recycle-bin-container {
  visibility: hidden;
}

/* 悬浮展开按钮 - 始终显示，折叠时可见 */
.expand-panel-btn {
  position: fixed;
  left: 0;
  top: 59px;
  width: 12px;
  height: 28px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-left: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  transition: all 0.2s ease;
  opacity: 0;
  pointer-events: none;
}

.expand-panel-btn.visible {
  opacity: 1;
  pointer-events: auto;
}

.expand-panel-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-color);
  width: 16px;
}

.folder-tree-container {
  overflow: hidden;
  flex-shrink: 0;
  min-height: 100px;
}

.recycle-bin-container {
  overflow: hidden;
  flex: 1;
  min-height: 100px;
}

.panel-resizer {
  height: 8px;
  cursor: row-resize;
  background: var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.panel-resizer:hover {
  background: var(--accent-color);
}

.note-list-container {
  overflow: hidden;
  flex-shrink: 0;
  min-width: 150px;
  max-width: 500px;
  transition: width 0.2s ease;
}

/* 拖动时移除 transition，避免延迟 */
.note-list-container.no-transition {
  transition: none !important;
}

.vertical-resizer {
  width: 8px;
  cursor: col-resize;
  background: var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.vertical-resizer:hover {
  background: var(--accent-color);
}
</style>
