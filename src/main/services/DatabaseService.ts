import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { writeFileSyncAtomic } from '../utils/fileUtils'

// 常量：密钥格式版本和数据格式版本
export const KEY_FORMAT_VERSION = 2
export const DATA_FORMAT_VERSION = 1

export interface Folder {
  id: string
  parent_id: string | null
  name: string
  created_at: number
  updated_at: number
  deleted_at: number | null
  order: number  // 文件夹在同级中的排序顺序
}

export interface Note {
  id: string
  folder_id: string
  title: string
  content_type: 'plain' | 'markdown' | 'richtext'
  has_attachments: number
  created_at: number
  updated_at: number
  deleted_at: number | null
  language?: string  // 文本编辑器的语法高亮语言
  order: number  // 笔记在文件夹内的排序顺序
}

export interface Attachment {
  id: string
  note_id: string
  filename: string
  mime_type: string
  size: number
  created_at: number
  deleted_at: number | null
}

interface Database {
  folders: Folder[]
  notes: Note[]
  attachments: Attachment[]
  key_format_version?: number
  data_format_version?: number
  recovery_key_gen_count?: number  // recovery.key 生成次数
}

export class DatabaseService {
  private db: Database = { folders: [], notes: [], attachments: [] }
  private dbPath: string = ''

  setVaultPath(vaultPath: string): void {
    this.dbPath = path.join(vaultPath, 'metadata.json')
  }

  getVaultPath(): string {
    return path.dirname(this.dbPath)
  }

  initialize(): void {
    if (!this.dbPath) {
      this.db = { folders: [], notes: [], attachments: [] }
      return
    }

    if (fs.existsSync(this.dbPath)) {
      const data = fs.readFileSync(this.dbPath, 'utf-8')
      this.db = JSON.parse(data)

      // 检查版本兼容性
      if (this.db.key_format_version !== undefined && this.db.key_format_version !== KEY_FORMAT_VERSION) {
        throw new Error(`密钥格式版本不兼容：当前应用支持版本 ${KEY_FORMAT_VERSION}，但数据目录版本为 ${this.db.key_format_version}`)
      }
      if (this.db.data_format_version !== undefined && this.db.data_format_version !== DATA_FORMAT_VERSION) {
        throw new Error(`数据格式版本不兼容：当前应用支持版本 ${DATA_FORMAT_VERSION}，但数据目录版本为 ${this.db.data_format_version}`)
      }
    } else {
      this.db = { folders: [], notes: [], attachments: [] }
    }
  }

  private save(): void {
    // 确保保存时包含版本信息
    if (this.db.key_format_version === undefined) {
      this.db.key_format_version = KEY_FORMAT_VERSION
    }
    if (this.db.data_format_version === undefined) {
      this.db.data_format_version = DATA_FORMAT_VERSION
    }
    writeFileSyncAtomic(this.dbPath, JSON.stringify(this.db, null, 2))
  }

  // Folder operations
  listFolders(includeDeleted = false): Folder[] {
    return includeDeleted
      ? this.db.folders
      : this.db.folders.filter(f => f.deleted_at === null)
  }

  getFolderById(id: string): Folder | undefined {
    return this.db.folders.find(f => f.id === id)
  }

  createFolder(id: string, parentId: string | null, name: string): Folder {
    const now = Date.now()
    // 获取同级文件夹的最大 order 值
    const siblings = this.db.folders.filter(f => f.parent_id === parentId && f.deleted_at === null)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.order)) : 0
    const folder: Folder = {
      id,
      parent_id: parentId,
      name,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      order: maxOrder + 1000  // 使用间隔值，便于后续插入
    }
    this.db.folders.push(folder)
    this.save()
    return folder
  }

  updateFolder(id: string, name: string): void {
    const folder = this.getFolderById(id)
    if (folder) {
      folder.name = name
      folder.updated_at = Date.now()
      this.save()
    }
  }

  softDeleteFolder(id: string): void {
    const now = Date.now()
    const folder = this.getFolderById(id)
    if (folder) {
      folder.deleted_at = now
    }
    // Soft delete notes in this folder
    const notes = this.db.notes.filter(n => n.folder_id === id)
    for (const note of notes) {
      note.deleted_at = now
    }
    // Soft delete children recursively
    const children = this.db.folders.filter(f => f.parent_id === id)
    for (const child of children) {
      this.softDeleteFolder(child.id)
    }
    this.save()
  }

  restoreFolder(id: string): void {
    const folder = this.getFolderById(id)
    if (folder) {
      folder.deleted_at = null
    }
    // Restore notes in this folder
    const notes = this.db.notes.filter(n => n.folder_id === id)
    for (const note of notes) {
      note.deleted_at = null
    }
    // Restore children recursively
    const children = this.db.folders.filter(f => f.parent_id === id)
    for (const child of children) {
      this.restoreFolder(child.id)
    }
    this.save()
  }

  permanentlyDeleteFolder(id: string): void {
    // Delete children first
    const children = this.db.folders.filter(f => f.parent_id === id)
    for (const child of children) {
      this.permanentlyDeleteFolder(child.id)
    }
    // Delete notes in this folder
    const notes = this.db.notes.filter(n => n.folder_id === id)
    for (const note of notes) {
      this.permanentlyDeleteNote(note.id)
    }
    this.db.folders = this.db.folders.filter(f => f.id !== id)
    this.save()
  }

  // Note operations
  getDeletedNotes(): Note[] {
    return this.db.notes.filter(n => n.deleted_at !== null)
  }

  getDeletedFolders(): Folder[] {
    return this.db.folders.filter(f => f.deleted_at !== null)
  }

  getNoteById(id: string): Note | undefined {
    return this.db.notes.find(n => n.id === id)
  }

  createNote(id: string, folderId: string, title: string, contentType: string): Note {
    const now = Date.now()
    // 获取当前文件夹下最大的 order 值
    const folderNotes = this.db.notes.filter(n => n.folder_id === folderId && n.deleted_at === null)
    const maxOrder = folderNotes.length > 0 ? Math.max(...folderNotes.map(n => n.order)) : 0
    const note: Note = {
      id,
      folder_id: folderId,
      title,
      content_type: contentType as Note['content_type'],
      has_attachments: 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      order: maxOrder + 1000  // 使用间隔值，便于后续插入
    }
    this.db.notes.push(note)
    this.save()
    return note
  }

  updateNote(id: string, data: { title?: string; contentType?: string; hasAttachments?: number; language?: string }): void {
    const note = this.getNoteById(id)
    if (note) {
      if (data.title !== undefined) note.title = data.title
      if (data.contentType !== undefined) note.content_type = data.contentType as Note['content_type']
      if (data.hasAttachments !== undefined) note.has_attachments = data.hasAttachments
      if (data.language !== undefined) note.language = data.language
      note.updated_at = Date.now()
      this.save()
    }
  }

  updateNoteOrder(id: string, newOrder: number): void {
    const note = this.getNoteById(id)
    if (note) {
      note.order = newOrder
      note.updated_at = Date.now()
      this.save()
    }
  }

  moveNote(id: string, newFolderId: string): void {
    const note = this.getNoteById(id)
    if (note) {
      // 获取目标文件夹的最大 order 值
      const folderNotes = this.db.notes.filter(n => n.folder_id === newFolderId && n.deleted_at === null)
      const maxOrder = folderNotes.length > 0 ? Math.max(...folderNotes.map(n => n.order)) : 0
      note.folder_id = newFolderId
      note.order = maxOrder + 1000  // 设为最后一个
      note.updated_at = Date.now()
      this.save()
    }
  }

  /**
   * 检查目标文件夹是否是源文件夹的后代（防止循环依赖）
   */
  private isDescendant(targetId: string, sourceId: string): boolean {
    let current = this.getFolderById(targetId)
    while (current) {
      if (current.id === sourceId) {
        return true
      }
      current = current.parent_id ? this.getFolderById(current.parent_id) : undefined
    }
    return false
  }

  /**
   * 获取同级文件夹列表（按 order 排序）
   */
  private getSiblings(parentId: string | null): Folder[] {
    return this.db.folders
      .filter(f => f.parent_id === parentId && f.deleted_at === null)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  /**
   * 移动文件夹到另一个文件夹的前面、后面或内部（可跨父文件夹拖动）
   * @param id 源文件夹 ID
   * @param targetId 目标文件夹 ID
   * @param position 放置位置 'before' | 'after' | 'inside'
   * @returns 返回错误信息，如果移动成功则返回 null
   */
  moveFolder(id: string, targetId: string | null, position: 'before' | 'after' | 'inside'): string | null {
    const folder = this.getFolderById(id)
    if (!folder) {
      return '文件夹不存在'
    }

    // 不能将文件夹拖入自己
    if (id === targetId) {
      return '不能将文件夹拖入自身'
    }

    // 如果 targetId 为 null，表示移动到根目录的最后
    if (targetId === null) {
      const siblings = this.getSiblings(null)
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.order)) : 0
      folder.parent_id = null
      folder.order = maxOrder + 1000
      folder.updated_at = Date.now()
      this.save()
      return null
    }

    const targetFolder = this.getFolderById(targetId)
    if (!targetFolder) {
      return '目标文件夹不存在'
    }

    // 检查循环依赖：目标文件夹不能是源文件夹的后代
    if (this.isDescendant(targetId, id)) {
      return '不能将文件夹拖入其子文件夹'
    }

    // 获取新父文件夹下的所有同级文件夹
    const newParentId = targetFolder.parent_id
    const siblings = this.getSiblings(newParentId)
    const targetIndex = siblings.findIndex(f => f.id === targetId)

    if (targetIndex === -1) {
      return '目标文件夹不在同级列表中'
    }

    let newOrder: number

    if (position === 'before') {
      // 移动到目标前面
      const prevFolder = targetIndex > 0 ? siblings[targetIndex - 1] : null
      const targetOrder = targetFolder.order ?? 0

      if (!prevFolder) {
        // 目标是第一个，放到它前面
        newOrder = targetOrder - 1000
      } else if (prevFolder.id === id) {
        // 已经在目标前面，不需要移动
        return null
      } else {
        // 放到前一个和目标中间
        const prevOrder = prevFolder.order ?? 0
        newOrder = (prevOrder + targetOrder) / 2
      }
    } else if (position === 'after') {
      // 移动到目标后面
      const nextFolder = targetIndex < siblings.length - 1 ? siblings[targetIndex + 1] : null
      const targetOrder = targetFolder.order ?? 0

      if (!nextFolder) {
        // 目标是最后一个，放到它后面
        newOrder = targetOrder + 1000
      } else if (nextFolder.id === id) {
        // 已经在目标后面，不需要移动
        return null
      } else {
        // 放到目标和后一个中间
        const nextOrder = nextFolder.order ?? 0
        newOrder = (targetOrder + nextOrder) / 2
      }
    } else {
      // position === 'inside'，移动到目标内部作为子文件夹
      const newParentId = targetId
      const children = this.getSiblings(newParentId)
      const maxOrder = children.length > 0 ? Math.max(...children.map(f => f.order)) : 0
      newOrder = maxOrder + 1000
      folder.parent_id = newParentId
      folder.order = newOrder
      folder.updated_at = Date.now()
      this.save()
      return null
    }

    // 更新文件夹的 parent_id 和 order
    folder.parent_id = newParentId
    folder.order = newOrder
    folder.updated_at = Date.now()
    this.save()
    return null
  }

  // 获取文件夹内的笔记列表（按 order 排序）
  listNotes(folderId: string, includeDeleted = false): Note[] {
    const notes = includeDeleted
      ? this.db.notes.filter(n => n.folder_id === folderId)
      : this.db.notes.filter(n => n.folder_id === folderId && n.deleted_at === null)
    // 按 order 字段排序（向后兼容：undefined order 视为 0）
    return notes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  softDeleteNote(id: string): void {
    const note = this.getNoteById(id)
    if (note) {
      note.deleted_at = Date.now()
      // Soft delete all attachments of this note
      const attachments = this.db.attachments.filter(a => a.note_id === id)
      for (const att of attachments) {
        att.deleted_at = Date.now()
      }
      this.save()
    }
  }

  restoreNote(id: string): void {
    const note = this.getNoteById(id)
    if (note) {
      note.deleted_at = null
      // Restore all attachments of this note
      const attachments = this.db.attachments.filter(a => a.note_id === id)
      for (const att of attachments) {
        att.deleted_at = null
      }
      this.save()
    }
  }

  permanentlyDeleteNote(id: string): void {
    this.db.attachments = this.db.attachments.filter(a => a.note_id !== id)
    this.db.notes = this.db.notes.filter(n => n.id !== id)
    this.save()
  }

  // Attachment operations
  listAttachments(noteId: string): Attachment[] {
    return this.db.attachments.filter(a => a.note_id === noteId && a.deleted_at === null)
  }

  getDeletedAttachments(): Attachment[] {
    return this.db.attachments.filter(a => a.deleted_at !== null)
  }

  createAttachment(id: string, noteId: string, filename: string, mimeType: string, size: number): Attachment {
    const now = Date.now()
    const attachment: Attachment = { id, note_id: noteId, filename, mime_type: mimeType, size, created_at: now, deleted_at: null }
    this.db.attachments.push(attachment)
    this.save()
    return attachment
  }

  getAttachmentById(id: string): Attachment | undefined {
    return this.db.attachments.find(a => a.id === id)
  }

  softDeleteAttachment(id: string): void {
    const attachment = this.getAttachmentById(id)
    if (attachment) {
      attachment.deleted_at = Date.now()
      this.save()
    }
  }

  restoreAttachment(id: string): void {
    const attachment = this.getAttachmentById(id)
    if (attachment) {
      attachment.deleted_at = null
      this.save()
    }
  }

  permanentlyDeleteAttachment(id: string): void {
    this.db.attachments = this.db.attachments.filter(a => a.id !== id)
    this.save()
  }

  // Search operations
  searchByTitle(query: string): Note[] {
    const lowerQuery = query.toLowerCase()
    return this.db.notes.filter(n => n.deleted_at === null && n.title.toLowerCase().includes(lowerQuery))
  }

  // Get folder path (returns array of folder names from root to target folder)
  getFolderPath(folderId: string): string[] {
    const path: string[] = []
    let current = this.getFolderById(folderId)
    while (current) {
      path.unshift(current.name)
      current = current.parent_id ? this.getFolderById(current.parent_id) : undefined
    }
    return path
  }

  // Get note's folder path
  getNoteFolderPath(noteId: string): string[] {
    const note = this.getNoteById(noteId)
    if (!note) return []
    return this.getFolderPath(note.folder_id)
  }

  // Recovery key generation count
  getRecoveryKeyGenCount(): number {
    return this.db.recovery_key_gen_count ?? 0
  }

  incrementRecoveryKeyGenCount(): number {
    this.db.recovery_key_gen_count = (this.db.recovery_key_gen_count ?? 0) + 1
    this.save()
    return this.db.recovery_key_gen_count
  }

  close(): void {
    this.save()
  }
}

export const databaseService = new DatabaseService()
