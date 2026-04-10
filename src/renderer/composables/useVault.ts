import { ref, computed } from 'vue'

// 简单的事件总线，用于组件间通信
type EventCallback = () => void
const refreshListeners: {
  onRecycleBinRefresh: EventCallback[]
  onNavigationRefresh: EventCallback[]
  onAttachmentRefresh: EventCallback[]
} = {
  onRecycleBinRefresh: [],
  onNavigationRefresh: [],
  onAttachmentRefresh: []
}

export function onRecycleBinRefresh(callback: EventCallback) {
  refreshListeners.onRecycleBinRefresh.push(callback)
  return () => {
    const index = refreshListeners.onRecycleBinRefresh.indexOf(callback)
    if (index > -1) refreshListeners.onRecycleBinRefresh.splice(index, 1)
  }
}

export function onNavigationRefresh(callback: EventCallback) {
  refreshListeners.onNavigationRefresh.push(callback)
  return () => {
    const index = refreshListeners.onNavigationRefresh.indexOf(callback)
    if (index > -1) refreshListeners.onNavigationRefresh.splice(index, 1)
  }
}

export function onAttachmentRefresh(callback: EventCallback) {
  refreshListeners.onAttachmentRefresh.push(callback)
  return () => {
    const index = refreshListeners.onAttachmentRefresh.indexOf(callback)
    if (index > -1) refreshListeners.onAttachmentRefresh.splice(index, 1)
  }
}

export function emitRecycleBinRefresh() {
  refreshListeners.onRecycleBinRefresh.forEach(cb => cb())
}

export function emitNavigationRefresh() {
  refreshListeners.onNavigationRefresh.forEach(cb => cb())
}

export function emitAttachmentRefresh() {
  refreshListeners.onAttachmentRefresh.forEach(cb => cb())
}

declare global {
  interface Window {
    vaultAPI: {
      vault: {
        selectDirectory: () => Promise<string | null>
        checkExists: (dirPath: string) => Promise<boolean>
        create: (dirPath: string, password: string) => Promise<{ success: boolean; error?: string }>
        open: (dirPath: string, password: string) => Promise<{ success: boolean; error?: string }>
        getCurrentDir: () => Promise<string>
        getLastOpenedDir: () => Promise<string | null>
        getRecentDirs: () => Promise<string[]>
        unlock: (password: string) => Promise<{ success: boolean; created?: boolean }>
        lock: () => Promise<{ success: boolean }>
        isUnlocked: () => Promise<boolean>
        checkLock: () => Promise<{ locked: boolean; pid?: number }>
        changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
      }
      folders: {
        list: () => Promise<any[]>
        create: (parentId: string | null, name: string) => Promise<any>
        update: (id: string, name: string) => Promise<{ success: boolean }>
        delete: (id: string) => Promise<{ success: boolean }>
        moveFolder: (id: string, targetId: string | null, position: 'before' | 'after' | 'inside') => Promise<{ success: boolean; error?: string }>
      }
      notes: {
        list: (folderId: string) => Promise<any[]>
        get: (id: string) => Promise<any>
        create: (folderId: string, title: string, contentType: string) => Promise<any>
        update: (id: string, data: { title?: string; content?: string; contentType?: string; language?: string }) => Promise<{ success: boolean }>
        delete: (id: string) => Promise<{ success: boolean }>
        updateOrder: (id: string, order: number) => Promise<{ success: boolean }>
        moveFolder: (id: string, folderId: string) => Promise<{ success: boolean }>
      }
      recycle: {
        list: () => Promise<{ folders: any[]; notes: any[]; attachments: any[] }>
        restore: (ids: { folderIds: string[]; noteIds: string[]; attachmentIds: string[] }) => Promise<{ success: boolean }>
        purge: (ids: { folderIds: string[]; noteIds: string[]; attachmentIds: string[] }) => Promise<{ success: boolean }>
        empty: () => Promise<{ success: boolean }>
      }
      attachments: {
        add: (noteId: string, filePath: string) => Promise<string>
        list: (noteId: string) => Promise<any[]>
        get: (id: string) => Promise<any>
        delete: (id: string) => Promise<{ success: boolean }>
        restore: (id: string) => Promise<{ success: boolean }>
      }
      search: {
        title: (query: string) => Promise<any[]>
        content: (query: string) => Promise<any[]>
      }
      // Utility
      getFolderPath: (folderId: string) => Promise<string[]>
      export: {
        note: (id: string, format: 'md' | 'encrypted') => Promise<{ success: boolean; data?: any; error?: string }>
        vault: (outputPath: string) => Promise<{ success: boolean; path?: string }>
      }
      settings: {
        get: () => Promise<{
          leftPanelWidth: number
          folderTreeHeight: number
          recycleBinHeight: number
          noteListWidth: number
          theme?: 'light' | 'dark'
          autoLockMinutes?: number
          editorFont?: { fontFamily: string; fontSize: number }
        }>
        update: (settings: {
          leftPanelWidth?: number
          folderTreeHeight?: number
          recycleBinHeight?: number
          noteListWidth?: number
        }) => Promise<{ success: boolean }>
        getLastOpenedNoteId: () => Promise<string | null>
        setLastOpenedNoteId: (noteId: string) => Promise<{ success: boolean }>
        clearLastOpenedNoteId: () => Promise<{ success: boolean }>
        getPlainTextEditorSettings: () => Promise<{ showLineNumbers: boolean }>
        updatePlainTextEditorSettings: (settings: { showLineNumbers?: boolean; language?: string }) => Promise<{ success: boolean }>
        getMarkdownEditorSettings: () => Promise<{ showLineNumbers: boolean; showSource: boolean; showPreview: boolean; highlightSelection?: boolean; showWhitespace?: boolean; sourcePaneWidth?: number }>
        updateMarkdownEditorSettings: (settings: { showLineNumbers?: boolean; showSource?: boolean; showPreview?: boolean; highlightSelection?: boolean; showWhitespace?: boolean; sourcePaneWidth?: number }) => Promise<{ success: boolean }>
        getTheme: () => Promise<'light' | 'dark'>
        updateTheme: (theme: 'light' | 'dark') => Promise<{ success: boolean }>
        getAutoLockMinutes: () => Promise<number>
        updateAutoLockMinutes: (minutes: number) => Promise<{ success: boolean }>
        getEditorFont: () => Promise<{ fontFamily: string; fontSize: number }>
        updateEditorFont: (fontFamily: string, fontSize: number) => Promise<{ success: boolean }>
      }
      recovery: {
        getGenCount: () => Promise<number>
        generate: (saveDir: string) => Promise<{ success: boolean; filename?: string; error?: string }>
        verify: (recoveryKeyPath: string) => Promise<{ valid: boolean }>
        reset: (recoveryKeyPath: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
        selectSaveDir: () => Promise<string | null>
      }
      onVaultLocked: (callback: () => void) => () => void
    }
  }
}

const isUnlocked = ref(false)
const isLoading = ref(true)
const currentFolderId = ref<string | null>(null)
const currentNoteId = ref<string | null>(null)
const folders = ref<any[]>([])
const notes = ref<any[]>([])
const currentNote = ref<any | null>(null)
const searchQuery = ref('')
const searchScope = ref<'title' | 'content'>('title')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const expandedFolderIds = ref<Set<string>>(new Set())

export function useVault() {
  const api = window.vaultAPI

  async function checkUnlocked() {
    isLoading.value = true
    try {
      isUnlocked.value = await api.vault.isUnlocked()
      if (isUnlocked.value) {
        await loadFolders()
        // 检测到已解锁状态后，恢复上一次打开的笔记
        await restoreLastOpenedNote()
        // 设置窗口标题为当前目录
        updateWindowTitle()
      }
    } catch (e) {
      console.error('[useVault] checkUnlocked error:', e)
    } finally {
      isLoading.value = false
    }
  }

  // 更新窗口标题为当前目录
  async function updateWindowTitle() {
    try {
      const currentDir = await api.vault.getCurrentDir()
      if (currentDir) {
        // 使用完整路径
        const title = `${currentDir} - 安全记事本`
        // 修改 HTML document.title（窗口标题显示这个）
        document.title = title
      }
    } catch (e) {
      console.error('[updateWindowTitle] Error:', e)
    }
  }

  // 清空当前状态（用于切换目录时）
  function clearState() {
    folders.value = []
    notes.value = []
    currentFolderId.value = null
    currentNoteId.value = null
    currentNote.value = null
    expandedFolderIds.value.clear()
  }

  async function unlock(password: string): Promise<boolean> {
    // 获取当前目录，用于判断是否切换了目录
    const oldDir = await api.vault.getCurrentDir().catch(() => '')

    const result = await api.vault.unlock(password)
    if (result.success) {
      isUnlocked.value = true
      // 获取新目录
      const newDir = await api.vault.getCurrentDir()

      // 只有目录变化时才清空状态
      if (oldDir && newDir !== oldDir) {
        clearState()
      }

      // 加载新目录数据
      await loadFolders()
      // 解锁成功后，恢复上一次打开的笔记
      await restoreLastOpenedNote()
      // 设置窗口标题为当前目录
      updateWindowTitle()
      // 触发刷新事件，更新回收站等组件
      emitRecycleBinRefresh()
      emitNavigationRefresh()
      emitAttachmentRefresh()
    }
    return result.success
  }

  async function openVault(dirPath: string, password: string): Promise<{ success: boolean; error?: string }> {
    // 获取当前目录，用于判断是否切换了目录
    const oldDir = await api.vault.getCurrentDir().catch(() => '')

    const result = await api.vault.open(dirPath, password)
    if (result.success) {
      isUnlocked.value = true
      // 获取新目录
      const newDir = await api.vault.getCurrentDir()

      // 只有目录变化时才清空状态
      if (oldDir && newDir !== oldDir) {
        clearState()
      }

      // 加载新目录数据
      await loadFolders()
      // 等待 folders 加载完成后再恢复上一次打开的笔记
      await restoreLastOpenedNote()
      // 设置窗口标题为当前目录
      updateWindowTitle()
      // 触发刷新事件，更新回收站等组件
      emitRecycleBinRefresh()
      emitNavigationRefresh()
      emitAttachmentRefresh()
    }
    return result
  }

  async function restoreLastOpenedNote() {
    // 确保 folders 已经加载
    if (folders.value.length === 0) {
      await loadFolders()
    }
    const lastNoteId = await api.settings.getLastOpenedNoteId()
    if (lastNoteId) {
      try {
        const note = await api.notes.get(lastNoteId)
        if (note && !note.deleted_at) {
          currentFolderId.value = note.folder_id
          notes.value = await api.notes.list(note.folder_id)
          currentNoteId.value = lastNoteId
          currentNote.value = note
          expandToFolder(note.folder_id)
        } else {
          await api.settings.clearLastOpenedNoteId()
        }
      } catch (e) {
        console.error('[restoreLastOpenedNote] Error:', e)
        await api.settings.clearLastOpenedNoteId()
      }
    }
  }

  async function createVault(dirPath: string, password: string): Promise<{ success: boolean; error?: string }> {
    // 获取当前目录，用于判断是否切换了目录
    const oldDir = await api.vault.getCurrentDir().catch(() => '')

    const result = await api.vault.create(dirPath, password)
    if (result.success) {
      isUnlocked.value = true
      // 获取新目录
      const newDir = await api.vault.getCurrentDir()

      // 只有目录变化时才清空状态
      if (oldDir && newDir !== oldDir) {
        clearState()
      }

      // 加载新目录数据
      await loadFolders()
      // 设置窗口标题为当前目录
      updateWindowTitle()
      // 触发刷新事件，更新回收站等组件
      emitRecycleBinRefresh()
      emitNavigationRefresh()
      emitAttachmentRefresh()
    }
    return result
  }

  async function lock() {
    await api.vault.lock()
    isUnlocked.value = false
    // 不清空 folders/notes/currentNote 等状态，保持 Vue 组件缓存
    // 锁定时界面会被 UnlockScreen 覆盖，用户无法交互，数据也不会泄露
    // 恢复原标题
    document.title = 'Secure Notebook'
  }

  async function changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    return await api.vault.changePassword(oldPassword, newPassword)
  }

  async function getRecoveryKeyGenCount(): Promise<number> {
    return await api.recovery.getGenCount()
  }

  async function generateRecoveryKey(savePath: string): Promise<{ success: boolean; filename?: string; error?: string }> {
    return await api.recovery.generate(savePath)
  }

  async function verifyRecoveryKey(recoveryKeyPath: string): Promise<{ valid: boolean }> {
    return await api.recovery.verify(recoveryKeyPath)
  }

  async function resetPassword(recoveryKeyPath: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    return await api.recovery.reset(recoveryKeyPath, newPassword)
  }

  async function selectRecoveryKeySaveDir(): Promise<string | null> {
    return await api.recovery.selectSaveDir()
  }

  async function loadFolders() {
    folders.value = await api.folders.list()
  }

  async function refreshNotes() {
    if (currentFolderId.value) {
      notes.value = await api.notes.list(currentFolderId.value)
    }
  }

  async function createFolder(parentId: string | null, name: string) {
    const folder = await api.folders.create(parentId, name)
    await loadFolders()
    return folder
  }

  async function renameFolder(id: string, name: string) {
    await api.folders.update(id, name)
    await loadFolders()
  }

  async function renameNote(id: string, title: string) {
    await api.notes.update(id, { title })
    // 刷新当前文件夹的笔记列表以更新显示
    if (currentFolderId.value) {
      notes.value = await api.notes.list(currentFolderId.value)
    }
  }

  async function deleteFolder(id: string) {
    await api.folders.delete(id)
    await loadFolders()
    if (currentFolderId.value === id) {
      currentFolderId.value = null
      notes.value = []
    }
    // 通知回收站刷新
    emitRecycleBinRefresh()
  }

  async function selectFolder(id: string) {
    currentFolderId.value = id
    currentNoteId.value = null
    currentNote.value = null
    notes.value = await api.notes.list(id)
  }

  async function selectNote(id: string) {
    const note = await api.notes.get(id)
    if (note) {
      // 设置文件夹并加载该文件夹下的笔记列表
      currentFolderId.value = note.folder_id
      notes.value = await api.notes.list(note.folder_id)
      currentNoteId.value = id
      currentNote.value = note
      // 展开文件夹路径
      expandToFolder(note.folder_id)
      // 保存最后打开的笔记 ID
      await api.settings.setLastOpenedNoteId(id)
    }
  }

  function toggleExpandFolder(id: string) {
    if (expandedFolderIds.value.has(id)) {
      expandedFolderIds.value.delete(id)
    } else {
      expandedFolderIds.value.add(id)
    }
  }

  function expandToFolder(folderId: string) {
    // 找到文件夹的完整路径并展开所有祖先文件夹
    const folderMap = new Map<string, any>()
    for (const f of folders.value) {
      folderMap.set(f.id, f)
    }
    const path: string[] = []
    let current = folderMap.get(folderId)
    while (current) {
      path.unshift(current.id)
      current = current.parent_id ? folderMap.get(current.parent_id) : undefined
    }
    // 展开路径上的所有文件夹
    for (const id of path) {
      expandedFolderIds.value.add(id)
    }
  }

  async function createNote(title: string, contentType: string = 'plain') {
    if (!currentFolderId.value) return null
    const note = await api.notes.create(currentFolderId.value, title, contentType)
    await selectFolder(currentFolderId.value)
    // 自动选中新创建的笔记
    if (note) {
      await selectNote(note.id)
    }
    return note
  }

  async function updateNote(data: { title?: string; content?: string; contentType?: string }) {
    if (!currentNoteId.value) return
    await api.notes.update(currentNoteId.value, data)
    if (data.title !== undefined && currentNote.value) {
      currentNote.value.title = data.title
    }
    if (data.content !== undefined && currentNote.value) {
      currentNote.value.content = data.content
    }
  }

  async function deleteNote(id: string) {
    await api.notes.delete(id)
    if (currentFolderId.value) {
      await selectFolder(currentFolderId.value)
    }
    if (currentNoteId.value === id) {
      currentNoteId.value = null
      currentNote.value = null
    }
    // 通知回收站刷新
    emitRecycleBinRefresh()
  }

  async function updateNoteOrder(id: string, order: number) {
    await api.notes.updateOrder(id, order)
    // 刷新当前文件夹的笔记列表以更新顺序
    if (currentFolderId.value) {
      notes.value = await api.notes.list(currentFolderId.value)
    }
  }

  async function moveNote(noteId: string, folderId: string) {
    await api.notes.moveFolder(noteId, folderId)
    // 刷新当前文件夹的笔记列表
    if (currentFolderId.value) {
      notes.value = await api.notes.list(currentFolderId.value)
    }
  }

  async function moveFolder(id: string, targetId: string | null, position: 'before' | 'after' | 'inside') {
    const result = await api.folders.moveFolder(id, targetId, position)
    if (result.success) {
      await loadFolders()
      // 刷新导航视图
      emitNavigationRefresh()
    }
    return result
  }

  async function search(query: string, scope: 'title' | 'content') {
    if (!query.trim()) {
      searchResults.value = []
      isSearching.value = false
      return
    }
    isSearching.value = true
    searchQuery.value = query
    searchScope.value = scope
    if (scope === 'title') {
      searchResults.value = await api.search.title(query)
    } else {
      searchResults.value = await api.search.content(query)
    }
    isSearching.value = false
  }

  function clearSearch() {
    searchQuery.value = ''
    searchResults.value = []
    isSearching.value = false
  }

  return {
    isUnlocked: computed(() => isUnlocked.value),
    isLoading: computed(() => isLoading.value),
    currentFolderId: computed(() => currentFolderId.value),
    currentNoteId: computed(() => currentNoteId.value),
    folders: computed(() => folders.value),
    notes: computed(() => notes.value),
    currentNote: computed(() => currentNote.value),
    searchQuery: computed(() => searchQuery.value),
    searchScope: computed(() => searchScope.value),
    searchResults: computed(() => searchResults.value),
    isSearching: computed(() => isSearching.value),
    expandedFolderIds,
    checkUnlocked,
    unlock,
    lock,
    changePassword,
    getRecoveryKeyGenCount,
    generateRecoveryKey,
    verifyRecoveryKey,
    resetPassword,
    selectRecoveryKeySaveDir,
    loadFolders,
    refreshNotes,
    createFolder,
    renameFolder,
    renameNote,
    deleteFolder,
    selectFolder,
    selectNote,
    createNote,
    updateNote,
    deleteNote,
    updateNoteOrder,
    moveNote,
    moveFolder,
    search,
    clearSearch,
    toggleExpandFolder,
    expandToFolder,
    openVault,
    createVault,
    restoreLastOpenedNote,
    updateWindowTitle
  }
}
