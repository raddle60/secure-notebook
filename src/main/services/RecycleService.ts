import { databaseService } from './DatabaseService'
import { vaultService } from './VaultService'
import { cryptoService } from './CryptoService'

export class RecycleService {
  listDeletedItems(): { folders: any[]; notes: any[]; attachments: any[] } {
    const folders = databaseService.getDeletedFolders()
    const notes = databaseService.getDeletedNotes()
    const attachments = databaseService.getDeletedAttachments()

    // 解密文件夹名称（数据库存储的是 base64 加密字符串）
    const decryptedFolders = folders.map(folder => {
      try {
        const encrypted = Buffer.from(folder.name, 'base64')
        const decryptedName = cryptoService.decryptContent(encrypted)
        return {
          ...folder,
          name: decryptedName
        }
      } catch {
        // 解密失败时返回原始值
        return { ...folder, name: folder.name }
      }
    })

    // 解密笔记标题（数据库存储的是 base64 加密字符串）
    const decryptedNotes = notes.map(note => {
      try {
        const encrypted = Buffer.from(note.title, 'base64')
        const decryptedTitle = cryptoService.decryptContent(encrypted)
        return {
          ...note,
          title: decryptedTitle
        }
      } catch {
        // 解密失败时返回原始值
        return { ...note, title: note.title }
      }
    })

    // 解密附件文件名（数据库存储的是 base64 加密字符串）
    // 并检查附件是否需要显示：笔记是否在回收站中，以及附件是否可恢复
    const deletedNoteIds = new Set(notes.map(n => n.id))
    const decryptedAttachments = attachments.map(att => {
      try {
        const encrypted = Buffer.from(att.filename, 'base64')
        const decryptedFilename = cryptoService.decryptContent(encrypted)
        // 笔记是否在回收站中（会随笔记恢复而恢复，不单独显示）
        const noteInRecycleBin = deletedNoteIds.has(att.note_id)
        // 笔记是否还存在（getNoteById 返回 undefined 表示已被永久删除）
        const noteExists = databaseService.getNoteById(att.note_id) !== undefined
        return {
          ...att,
          filename: decryptedFilename,
          noteInRecycleBin,
          canRestore: noteExists && !noteInRecycleBin
        }
      } catch {
        // 解密失败时返回原始值
        const noteInRecycleBin = deletedNoteIds.has(att.note_id)
        const noteExists = databaseService.getNoteById(att.note_id) !== undefined
        return { ...att, filename: att.filename, noteInRecycleBin, canRestore: noteExists && !noteInRecycleBin }
      }
    })

    return {
      folders: decryptedFolders,
      notes: decryptedNotes,
      attachments: decryptedAttachments
    }
  }

  restore(ids: { folderIds: string[]; noteIds: string[]; attachmentIds: string[] }): void {
    for (const id of ids.folderIds) {
      databaseService.restoreFolder(id)
    }
    for (const id of ids.noteIds) {
      databaseService.restoreNote(id)
    }
    for (const id of ids.attachmentIds) {
      databaseService.restoreAttachment(id)
    }
  }

  purge(ids: { folderIds: string[]; noteIds: string[]; attachmentIds: string[] }): void {
    for (const id of ids.folderIds) {
      // Permanently delete folder (includes content files via DatabaseService)
      databaseService.permanentlyDeleteFolder(id)
    }
    for (const id of ids.noteIds) {
      // Delete content file
      vaultService.deleteContent(id)
      // Permanently delete attachments
      const attachments = databaseService.listAttachments(id).concat(databaseService.getDeletedAttachments().filter(a => a.note_id === id))
      for (const att of attachments) {
        vaultService.deleteAttachmentFile(att.id, true)
        databaseService.permanentlyDeleteAttachment(att.id)
      }
      // Permanently delete from database (includes attachments)
      databaseService.permanentlyDeleteNote(id)
    }
    for (const id of ids.attachmentIds) {
      vaultService.deleteAttachmentFile(id, true)
      databaseService.permanentlyDeleteAttachment(id)
    }
  }

  emptyAll(): void {
    const deletedItems = this.listDeletedItems()
    const deletedAttachments = databaseService.getDeletedAttachments()
    this.purge({
      folderIds: deletedItems.folders.map(f => f.id),
      noteIds: deletedItems.notes.map(n => n.id),
      attachmentIds: deletedAttachments.map(a => a.id)
    })
  }
}

export const recycleService = new RecycleService()
