import { ipcMain, dialog, nativeTheme, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import { cryptoService } from './CryptoService'
import { databaseService } from './DatabaseService'
import { vaultService } from './VaultService'
import { recycleService } from './RecycleService'
import { settingsService } from './SettingsService'
import { v4 as uuidv4 } from 'uuid'

// Encrypt a string using cryptoService
function encryptText(text: string): string {
  const encrypted = cryptoService.encryptContent(text)
  return encrypted.toString('base64')
}

// Decrypt a base64 string using cryptoService
function decryptText(encryptedBase64: string): string {
  const encrypted = Buffer.from(encryptedBase64, 'base64')
  return cryptoService.decryptContent(encrypted)
}

export function registerIPCHandlers(): void {
  // Vault handlers - 目录选择
  ipcMain.handle('vault:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择笔记目录'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // 检查目录是否已有金库
  ipcMain.handle('vault:checkExists', (_, dirPath: string) => {
    const saltPath = path.join(dirPath, 'vault.salt')
    return fs.existsSync(saltPath)
  })

  // 在指定目录创建新金库（目录不存在时自动创建）
  ipcMain.handle('vault:create', async (_, dirPath: string, password: string) => {
    try {
      // 检查并创建目录（如果不存在）
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }

      // 设置各服务路径
      cryptoService.setVaultPath(dirPath)
      vaultService.setVaultPath(dirPath)
      databaseService.setVaultPath(dirPath)

      // 创建金库
      await cryptoService.createVault(password)
      vaultService.initialize()
      databaseService.initialize()

      // 保存到设置
      settingsService.setLastOpenedDir(dirPath)

      return { success: true }
    } catch (error) {
      console.error('[Vault] Error creating vault:', error)
      return { success: false, error: String(error) }
    }
  })

  // 打开已存在的金库
  ipcMain.handle('vault:open', async (_, dirPath: string, password: string) => {
    try {
      // 设置各服务路径
      cryptoService.setVaultPath(dirPath)
      vaultService.setVaultPath(dirPath)
      databaseService.setVaultPath(dirPath)

      // 初始化服务（这里会检查版本兼容性）
      databaseService.initialize()
      // 解锁金库
      const valid = await cryptoService.unlock(password)
      if (!valid) {
        return { success: false, error: '密码错误' }
      }

      // 初始化服务（这里会创建目录）
      vaultService.initialize()
      

      // 保存到设置
      settingsService.setLastOpenedDir(dirPath)

      return { success: true }
    } catch (error) {
      console.error('[Vault] Error opening vault:', error)
      // 检查是否是版本不兼容错误
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('版本不兼容')) {
        return { success: false, error: errorMessage }
      }
      return { success: false, error: String(error) }
    }
  })

  // 获取当前金库路径
  ipcMain.handle('vault:getCurrentDir', () => {
    return cryptoService.getVaultPath()
  })

  // 获取当前金库目录名称
  ipcMain.handle('vault:getCurrentDirName', () => {
    const vaultPath = cryptoService.getVaultPath()
    return vaultPath ? path.basename(vaultPath) : ''
  })

  // 获取上次打开的目录
  ipcMain.handle('vault:getLastOpenedDir', () => {
    return settingsService.getLastOpenedDir()
  })

  // 获取最近目录列表
  ipcMain.handle('vault:getRecentDirs', () => {
    return settingsService.getRecentDirs()
  })

  // 删除最近目录
  ipcMain.handle('vault:removeRecentDir', (_, dir: string) => {
    settingsService.removeRecentDir(dir)
    return { success: true }
  })

  // 旧的 vault:unlock - 使用上次目录解锁（保持向后兼容）
  ipcMain.handle('vault:unlock', async (_, password: string) => {
    const lastDir = settingsService.getLastOpenedDir()
    if (!lastDir) {
      return { success: false, error: '请先选择记事本目录' }
    }
    // 直接调用 unlock 逻辑
    try {
      cryptoService.setVaultPath(lastDir)
      vaultService.setVaultPath(lastDir)
      databaseService.setVaultPath(lastDir)

      const valid = await cryptoService.unlock(password)
      if (!valid) {
        return { success: false, error: '密码错误' }
      }

      vaultService.initialize()
      databaseService.initialize()

      return { success: true }
    } catch (error) {
      console.error('[Vault] Error unlocking:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('版本不兼容')) {
        return { success: false, error: errorMessage }
      }
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('vault:lock', () => {
    cryptoService.lock()
    return { success: true }
  })

  // 检查是否有其他进程持有锁
  ipcMain.handle('vault:checkLock', () => {
    const otherPid = cryptoService.checkVaultLock()
    if (otherPid !== null) {
      return { locked: true, pid: otherPid }
    }
    return { locked: false }
  })

  ipcMain.handle('vault:isUnlocked', () => {
    return cryptoService.isUnlocked()
  })

  ipcMain.handle('vault:changePassword', async (_, oldPassword: string, newPassword: string) => {
    try {
      const result = await cryptoService.changePassword(oldPassword, newPassword)
      return result
    } catch (error) {
      console.error('[Vault] Error changing password:', error)
      return { success: false, error: error instanceof Error ? error.message : '密码修改失败' }
    }
  })

  // Folder handlers
  ipcMain.handle('folders:list', () => {
    const folders = databaseService.listFolders()
    // Decrypt folder names
    return folders.map(folder => ({
      ...folder,
      name: decryptText(folder.name)
    }))
  })

  ipcMain.handle('folders:create', (_, parentId: string | null, name: string) => {
    const id = uuidv4()
    const encryptedName = encryptText(name)
    return databaseService.createFolder(id, parentId, encryptedName)
  })

  ipcMain.handle('folders:update', (_, id: string, name: string) => {
    const encryptedName = encryptText(name)
    databaseService.updateFolder(id, encryptedName)
    return { success: true }
  })

  ipcMain.handle('folders:delete', (_, id: string) => {
    databaseService.softDeleteFolder(id)
    return { success: true }
  })

  ipcMain.handle('folders:moveFolder', async (_, id: string, targetId: string | null, position: 'before' | 'after' | 'inside') => {
    console.log('[IPCHandlers] moveFolder:', { id, targetId, position })
    const error = databaseService.moveFolder(id, targetId, position)
    if (error) {
      console.log('[IPCHandlers] moveFolder error:', error)
      return { success: false, error }
    }
    console.log('[IPCHandlers] moveFolder success')
    return { success: true }
  })

  // Note handlers
  ipcMain.handle('notes:list', (_, folderId: string) => {
    const notes = databaseService.listNotes(folderId)
    // Decrypt note titles
    return notes.map(note => ({
      ...note,
      title: decryptText(note.title)
    }))
  })

  ipcMain.handle('notes:get', (_, id: string) => {
    const note = databaseService.getNoteById(id)
    if (!note) return null
    let content = ''
    try {
      content = vaultService.loadContent(id)
    } catch {
      content = ''
    }
    return {
      ...note,
      title: decryptText(note.title),
      content
    }
  })

  ipcMain.handle('notes:create', (_, folderId: string, title: string, contentType: string) => {
    const id = uuidv4()
    const encryptedTitle = encryptText(title)
    const note = databaseService.createNote(id, folderId, encryptedTitle, contentType)
    return {
      ...note,
      title: decryptText(note.title)
    }
  })

  ipcMain.handle('notes:update', (_, id: string, data: { title?: string; content?: string; contentType?: string; language?: string }) => {
    if (data.title !== undefined) {
      const encryptedTitle = encryptText(data.title)
      databaseService.updateNote(id, { title: encryptedTitle, contentType: data.contentType })
    } else if (data.contentType !== undefined) {
      databaseService.updateNote(id, { contentType: data.contentType })
    } else if (data.language !== undefined) {
      databaseService.updateNote(id, { language: data.language })
    }
    if (data.content !== undefined) {
      vaultService.saveContent(id, data.content)
    }
    return { success: true }
  })

  ipcMain.handle('notes:updateOrder', (_, id: string, order: number) => {
    databaseService.updateNoteOrder(id, order)
    return { success: true }
  })

  ipcMain.handle('notes:delete', (_, id: string) => {
    databaseService.softDeleteNote(id)
    return { success: true }
  })

  ipcMain.handle('notes:moveFolder', (_, id: string, folderId: string) => {
    databaseService.moveNote(id, folderId)
    return { success: true }
  })

  // Recycle handlers
  ipcMain.handle('recycle:list', () => {
    return recycleService.listDeletedItems()
  })

  ipcMain.handle('recycle:restore', (_, ids: { folderIds: string[]; noteIds: string[]; attachmentIds: string[] }) => {
    recycleService.restore(ids)
    return { success: true }
  })

  ipcMain.handle('recycle:purge', (_, ids: { folderIds: string[]; noteIds: string[]; attachmentIds: string[] }) => {
    recycleService.purge(ids)
    return { success: true }
  })

  ipcMain.handle('recycle:empty', () => {
    recycleService.emptyAll()
    return { success: true }
  })

  // Attachment handlers
  ipcMain.handle('attachments:add', (_, noteId: string, filePath: string) => {
    return vaultService.addAttachment(noteId, filePath)
  })

  ipcMain.handle('attachments:list', (_, noteId: string) => {
    const attachments = databaseService.listAttachments(noteId)
    return attachments.map(att => ({
      ...att,
      filename: vaultService.getDecryptedFilename(att.id) || att.filename
    }))
  })

  ipcMain.handle('attachments:get', (_, id: string) => {
    const attachment = databaseService.getAttachmentById(id)
    if (!attachment) return null
    const data = vaultService.getAttachmentData(id)
    return {
      ...attachment,
      filename: vaultService.getDecryptedFilename(id) || attachment.filename,
      data: data.toString('base64')
    }
  })

  ipcMain.handle('attachments:delete', (_, id: string) => {
    databaseService.softDeleteAttachment(id)
    return { success: true }
  })

  ipcMain.handle('attachments:restore', (_, id: string) => {
    databaseService.restoreAttachment(id)
    return { success: true }
  })

  // Search handlers
  ipcMain.handle('search:title', (_, query: string) => {
    // Since titles are encrypted, we need to decrypt all notes and search
    const allNotes = databaseService.db.notes.filter(n => n.deleted_at === null)
    const results: any[] = []
    for (const note of allNotes) {
      try {
        const decryptedTitle = decryptText(note.title)
        if (decryptedTitle.toLowerCase().includes(query.toLowerCase())) {
          // Decrypt folder names for path
          const folderPath = databaseService.getNoteFolderPath(note.id).map(name => decryptText(name))
          results.push({
            ...note,
            title: decryptedTitle,
            folderPath
          })
        }
      } catch {
        // Skip notes that can't be decrypted
      }
    }
    return results
  })

  ipcMain.handle('search:content', async (_, query: string) => {
    const results = await vaultService.searchContent(query)
    // Add folder path to each result, also ensure title is decrypted
    return results.map(r => {
      const folderPath = databaseService.getNoteFolderPath(r.noteId).map(name => decryptText(name))
      // Decrypt title if it appears to be encrypted (base64)
      let title = r.title
      try {
        if (title && !title.includes('解密失败')) {
          title = decryptText(title)
        }
      } catch {
        // Keep original title if decryption fails
      }
      return { noteId: r.noteId, title, snippet: '', folderPath }
    })
  })

  // Export handlers
  ipcMain.handle('export:note', async (_, id: string, format: 'md' | 'encrypted') => {
    const note = databaseService.getNoteById(id)
    if (!note) return { success: false, error: 'Note not found' }
    const decryptedTitle = decryptText(note.title)
    const content = vaultService.loadContent(id)
    if (format === 'md') {
      return { success: true, data: `# ${decryptedTitle}\n\n${content}` }
    }
    // encrypted format would create an encrypted bundle
    return { success: true, data: Buffer.from(content).toString('base64') }
  })

  ipcMain.handle('export:vault', async (_, outputPath: string) => {
    // Export entire vault as encrypted archive
    const vaultPath = cryptoService.getVaultPath()
    if (!vaultPath) {
      return { success: false, error: 'No vault opened' }
    }

    return new Promise((resolve) => {
      const output = fs.createWriteStream(outputPath)
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      })

      output.on('close', () => {
        resolve({ success: true, path: outputPath })
      })

      archive.on('error', (err) => {
        console.error('[Export] Error:', err)
        resolve({ success: false, error: err.message })
      })

      archive.pipe(output)

      // Append all files from vault directory, excluding lock.pid
      archive.directory(vaultPath, path.basename(vaultPath), (data) => {
        if (data.name === 'lock.pid') {
          return false
        }
        return data
      })

      archive.finalize()
    })
  })

  // Export directory selection
  ipcMain.handle('export:selectDirectory', async () => {
    const now = new Date()
    const timestamp = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0')
    const defaultFilename = `secure_notebook_${timestamp}.zip`

    const result = await dialog.showSaveDialog({
      title: '选择导出文件保存位置',
      defaultPath: defaultFilename,
      filters: [
        { name: 'ZIP files', extensions: ['zip'] }
      ]
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    return result.filePath
  })

  // Utility handlers
  ipcMain.handle('getFolderPath', (_, folderId: string) => {
    const folderPath = databaseService.getFolderPath(folderId)
    // Decrypt folder names
    return folderPath.map(name => decryptText(name))
  })

  // Settings handlers
  ipcMain.handle('settings:get', () => {
    return settingsService.getSettings()
  })

  ipcMain.handle('settings:update', (_, settings: Partial<{
    leftPanelWidth: number
    folderTreeHeight: number
    recycleBinHeight: number
    noteListWidth: number
  }>) => {
    settingsService.updateSettings(settings)
    return { success: true }
  })

  // Last opened note handlers
  ipcMain.handle('settings:getLastOpenedNoteId', () => {
    return settingsService.getLastOpenedNoteId()
  })

  ipcMain.handle('settings:setLastOpenedNoteId', (_, noteId: string) => {
    settingsService.setLastOpenedNoteId(noteId)
    return { success: true }
  })

  ipcMain.handle('settings:clearLastOpenedNoteId', () => {
    settingsService.clearLastOpenedNoteId()
    return { success: true }
  })

  // Plain text editor settings
  ipcMain.handle('settings:getPlainTextEditorSettings', () => {
    return settingsService.getPlainTextEditorSettings()
  })

  ipcMain.handle('settings:updatePlainTextEditorSettings', (_, settings: Partial<{ showLineNumbers: boolean; language: string }>) => {
    settingsService.updatePlainTextEditorSettings(settings)
    return { success: true }
  })

  // Markdown editor settings
  ipcMain.handle('settings:getMarkdownEditorSettings', () => {
    return settingsService.getMarkdownEditorSettings()
  })

  ipcMain.handle('settings:updateMarkdownEditorSettings', (_, settings: Partial<{ showLineNumbers: boolean; showSource: boolean; showPreview: boolean }>) => {
    settingsService.updateMarkdownEditorSettings(settings)
    return { success: true }
  })

  // Theme handlers
  ipcMain.handle('settings:getTheme', () => {
    return settingsService.getTheme()
  })

  ipcMain.handle('settings:updateTheme', (_, theme: 'light' | 'dark') => {
    settingsService.updateTheme(theme)
    // 设置 Electron 原生主题
    nativeTheme.themeSource = theme
    return { success: true }
  })

  // Auto-lock settings
  ipcMain.handle('settings:getAutoLockMinutes', () => {
    return settingsService.getAutoLockMinutes()
  })

  ipcMain.handle('settings:updateAutoLockMinutes', (_, minutes: number) => {
    settingsService.updateAutoLockMinutes(minutes)
    return { success: true }
  })

  // 系统闲置状态查询
  ipcMain.handle('system:getIdleState', () => {
    const { powerMonitor } = require('electron')
    const idleThresholdSeconds = settingsService.getAutoLockMinutes() * 60
    if (idleThresholdSeconds <= 0) {
      return 'disabled' // 自动锁定已禁用
    }
    return powerMonitor.getSystemIdleState(idleThresholdSeconds)
  })

  // Editor font settings
  ipcMain.handle('settings:getEditorFont', () => {
    return settingsService.getEditorFont()
  })

  ipcMain.handle('settings:updateEditorFont', (_, fontFamily: string, fontSize: number) => {
    settingsService.updateEditorFont(fontFamily, fontSize)
    return { success: true }
  })

  // UI display settings handlers
  ipcMain.handle('settings:getUiDisplaySettings', () => {
    return settingsService.getUiDisplaySettings()
  })

  ipcMain.handle('settings:updateFolderTreeCollapsed', (_, collapsed: boolean) => {
    settingsService.updateFolderTreeCollapsed(collapsed)
    return { success: true }
  })

  ipcMain.handle('settings:updateNoteListHideDate', (_, hideDate: boolean) => {
    settingsService.updateNoteListHideDate(hideDate)
    return { success: true }
  })

  ipcMain.handle('settings:updateEditorHeaderCollapsed', (_, collapsed: boolean) => {
    settingsService.updateEditorHeaderCollapsed(collapsed)
    return { success: true }
  })

  // Editor instance cache size handlers
  ipcMain.handle('settings:getEditorInstanceCacheSize', () => {
    return settingsService.getEditorInstanceCacheSize()
  })

  ipcMain.handle('settings:updateEditorInstanceCacheSize', (_, size: number) => {
    settingsService.updateEditorInstanceCacheSize(size)
    return { success: true }
  })

  // Open external link in system default browser
  ipcMain.handle('app:openExternal', (_, url: string) => {
    shell.openExternal(url)
    return { success: true }
  })

  // Open folder in system file explorer
  ipcMain.handle('app:openFolder', (_, folderPath: string) => {
    shell.openPath(folderPath)
    return { success: true }
  })

  // Recovery handlers
  ipcMain.handle('recovery:getGenCount', () => {
    return databaseService.getRecoveryKeyGenCount()
  })

  ipcMain.handle('recovery:generate', async (_, saveDir: string) => {
    try {
      const { data, filename } = await cryptoService.generateRecoveryKey()
      const fullPath = path.join(saveDir, filename)
      fs.writeFileSync(fullPath, data)
      return { success: true, filename, fullPath }
    } catch (error) {
      console.error('[Recovery:generate] Error:', error)
      return { success: false, error: '生成重置密钥文件失败' }
    }
  })

  ipcMain.handle('recovery:verify', async (_, recoveryKeyPath: string, vaultDir: string) => {
    cryptoService.setVaultPath(vaultDir)
    const valid = await cryptoService.verifyRecoveryKey(recoveryKeyPath)
    return { valid }
  })

  ipcMain.handle('recovery:reset', async (_, recoveryKeyPath: string, newPassword: string, vaultDir: string) => {
    cryptoService.setVaultPath(vaultDir)
    const result = await cryptoService.resetPassword(recoveryKeyPath, newPassword)
    return result
  })

  ipcMain.handle('recovery:selectSavePath', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择重置密钥文件保存目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })
}
