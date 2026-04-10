import { contextBridge, ipcRenderer } from 'electron'

const api = {
  vault: {
    selectDirectory: () => ipcRenderer.invoke('vault:selectDirectory'),
    checkExists: (dirPath: string) => ipcRenderer.invoke('vault:checkExists', dirPath),
    create: (dirPath: string, password: string) => ipcRenderer.invoke('vault:create', dirPath, password),
    open: (dirPath: string, password: string) => ipcRenderer.invoke('vault:open', dirPath, password),
    getCurrentDir: () => ipcRenderer.invoke('vault:getCurrentDir'),
    getLastOpenedDir: () => ipcRenderer.invoke('vault:getLastOpenedDir'),
    getRecentDirs: () => ipcRenderer.invoke('vault:getRecentDirs'),
    removeRecentDir: (dir: string) => ipcRenderer.invoke('vault:removeRecentDir', dir),
    unlock: (password: string) => ipcRenderer.invoke('vault:unlock', password),
    lock: () => ipcRenderer.invoke('vault:lock'),
    isUnlocked: () => ipcRenderer.invoke('vault:isUnlocked'),
    checkLock: () => ipcRenderer.invoke('vault:checkLock'),
    changePassword: (oldPassword: string, newPassword: string) => ipcRenderer.invoke('vault:changePassword', oldPassword, newPassword),
    KEY_FORMAT_VERSION: 2,
    DATA_FORMAT_VERSION: 1
  },
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    create: (parentId: string | null, name: string) => ipcRenderer.invoke('folders:create', parentId, name),
    update: (id: string, name: string) => ipcRenderer.invoke('folders:update', id, name),
    delete: (id: string) => ipcRenderer.invoke('folders:delete', id),
    moveFolder: (id: string, targetId: string | null, position: 'before' | 'after' | 'inside') => ipcRenderer.invoke('folders:moveFolder', id, targetId, position)
  },
  notes: {
    list: (folderId: string) => ipcRenderer.invoke('notes:list', folderId),
    get: (id: string) => ipcRenderer.invoke('notes:get', id),
    create: (folderId: string, title: string, contentType: string) => ipcRenderer.invoke('notes:create', folderId, title, contentType),
    update: (id: string, data: { title?: string; content?: string; contentType?: string }) => ipcRenderer.invoke('notes:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('notes:delete', id),
    updateOrder: (id: string, order: number) => ipcRenderer.invoke('notes:updateOrder', id, order),
    moveFolder: (id: string, folderId: string) => ipcRenderer.invoke('notes:moveFolder', id, folderId)
  },
  recycle: {
    list: () => ipcRenderer.invoke('recycle:list'),
    restore: (ids: { folderIds: string[]; noteIds: string[]; attachmentIds: string[] }) => ipcRenderer.invoke('recycle:restore', ids),
    purge: (ids: { folderIds: string[]; noteIds: string[]; attachmentIds: string[] }) => ipcRenderer.invoke('recycle:purge', ids),
    empty: () => ipcRenderer.invoke('recycle:empty')
  },
  attachments: {
    add: (noteId: string, filePath: string) => ipcRenderer.invoke('attachments:add', noteId, filePath),
    list: (noteId: string) => ipcRenderer.invoke('attachments:list', noteId),
    get: (id: string) => ipcRenderer.invoke('attachments:get', id),
    delete: (id: string) => ipcRenderer.invoke('attachments:delete', id),
    restore: (id: string) => ipcRenderer.invoke('attachments:restore', id)
  },
  search: {
    title: (query: string) => ipcRenderer.invoke('search:title', query),
    content: (query: string) => ipcRenderer.invoke('search:content', query)
  },
  export: {
    note: (id: string, format: 'md' | 'encrypted') => ipcRenderer.invoke('export:note', id, format),
    vault: (outputPath: string) => ipcRenderer.invoke('export:vault', outputPath),
    selectExportDirectory: () => ipcRenderer.invoke('export:selectDirectory')
  },
  getFolderPath: (folderId: string) => ipcRenderer.invoke('getFolderPath', folderId),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings: { leftPanelWidth?: number; folderTreeHeight?: number; recycleBinHeight?: number; noteListWidth?: number }) => ipcRenderer.invoke('settings:update', settings),
    getLastOpenedNoteId: () => ipcRenderer.invoke('settings:getLastOpenedNoteId'),
    setLastOpenedNoteId: (noteId: string) => ipcRenderer.invoke('settings:setLastOpenedNoteId', noteId),
    clearLastOpenedNoteId: () => ipcRenderer.invoke('settings:clearLastOpenedNoteId'),
    getPlainTextEditorSettings: () => ipcRenderer.invoke('settings:getPlainTextEditorSettings'),
    updatePlainTextEditorSettings: (settings: { showLineNumbers?: boolean }) => ipcRenderer.invoke('settings:updatePlainTextEditorSettings', settings),
    getMarkdownEditorSettings: () => ipcRenderer.invoke('settings:getMarkdownEditorSettings'),
    updateMarkdownEditorSettings: (settings: { showLineNumbers?: boolean; showSource?: boolean; showPreview?: boolean }) => ipcRenderer.invoke('settings:updateMarkdownEditorSettings', settings),
    getTheme: () => ipcRenderer.invoke('settings:getTheme'),
    updateTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke('settings:updateTheme', theme),
    getAutoLockMinutes: () => ipcRenderer.invoke('settings:getAutoLockMinutes'),
    updateAutoLockMinutes: (minutes: number) => ipcRenderer.invoke('settings:updateAutoLockMinutes', minutes),
    getEditorFont: () => ipcRenderer.invoke('settings:getEditorFont'),
    updateEditorFont: (fontFamily: string, fontSize: number) => ipcRenderer.invoke('settings:updateEditorFont', fontFamily, fontSize),
    getUiDisplaySettings: () => ipcRenderer.invoke('settings:getUiDisplaySettings'),
    updateFolderTreeCollapsed: (collapsed: boolean) => ipcRenderer.invoke('settings:updateFolderTreeCollapsed', collapsed),
    updateNoteListHideDate: (hideDate: boolean) => ipcRenderer.invoke('settings:updateNoteListHideDate', hideDate),
    updateEditorHeaderCollapsed: (collapsed: boolean) => ipcRenderer.invoke('settings:updateEditorHeaderCollapsed', collapsed),
    getEditorInstanceCacheSize: () => ipcRenderer.invoke('settings:getEditorInstanceCacheSize'),
    updateEditorInstanceCacheSize: (size: number) => ipcRenderer.invoke('settings:updateEditorInstanceCacheSize', size)
  },
  system: {
    getIdleState: () => ipcRenderer.invoke('system:getIdleState')
  },
  app: {
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
    openFolder: (folderPath: string) => ipcRenderer.invoke('app:openFolder', folderPath)
  },
  recovery: {
    getGenCount: () => ipcRenderer.invoke('recovery:getGenCount'),
    generate: (saveDir: string) => ipcRenderer.invoke('recovery:generate', saveDir),
    verify: (recoveryKeyPath: string, vaultDir: string) => ipcRenderer.invoke('recovery:verify', recoveryKeyPath, vaultDir),
    reset: (recoveryKeyPath: string, newPassword: string, vaultDir: string) => ipcRenderer.invoke('recovery:reset', recoveryKeyPath, newPassword, vaultDir),
    selectSaveDir: () => ipcRenderer.invoke('recovery:selectSavePath')
  },
  onVaultLocked: (callback: () => void) => {
    ipcRenderer.on('vault:locked', callback)
    return () => ipcRenderer.removeListener('vault:locked', callback)
  }
}

contextBridge.exposeInMainWorld('vaultAPI', api)
