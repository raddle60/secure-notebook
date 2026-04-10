import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { cryptoService } from './CryptoService'
import { databaseService } from './DatabaseService'
import { v4 as uuidv4 } from 'uuid'
import { writeFileSyncAtomic } from '../utils/fileUtils'

export class VaultService {
  private currentVaultPath: string = ''

  setVaultPath(vaultPath: string): void {
    this.currentVaultPath = vaultPath
  }

  getVaultPath(): string {
    return this.currentVaultPath
  }

  private getVaultDir(): string {
    return this.currentVaultPath
  }

  private getContentsDir(): string {
    return path.join(this.getVaultDir(), 'contents')
  }

  private getAttachmentsDir(): string {
    return path.join(this.getVaultDir(), 'attachments')
  }

  initialize(): void {
    const dirs = [this.getVaultDir(), this.getContentsDir(), this.getAttachmentsDir()]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  // Name encryption/decryption - 使用 databaseService 中的加密名称
  // metadata.json 中已经存储了加密的名称

  // Content file path: vault/contents/{尾2字符}/{note_id}.enc
  private getContentPath(noteId: string): string {
    const suffix = noteId.slice(-2)
    const dir = path.join(this.getContentsDir(), suffix)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return path.join(dir, `${noteId}.enc`)
  }

  // Attachment file path: vault/attachments/{尾2字符}/{attachment_id}.enc
  private getAttachmentPath(attachmentId: string): string {
    const suffix = attachmentId.slice(-2)
    const dir = path.join(this.getAttachmentsDir(), suffix)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return path.join(dir, `${attachmentId}.enc`)
  }

  // Content operations
  saveContent(noteId: string, content: string): void {
    const filePath = this.getContentPath(noteId)
    const encrypted = cryptoService.encryptContent(content)
    writeFileSyncAtomic(filePath, encrypted)
  }

  loadContent(noteId: string): string {
    const filePath = this.getContentPath(noteId)
    if (!fs.existsSync(filePath)) {
      throw new Error('Content file not found')
    }
    const encrypted = fs.readFileSync(filePath)
    return cryptoService.decryptContent(encrypted)
  }

  deleteContent(noteId: string): void {
    const filePath = this.getContentPath(noteId)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }

  // Attachment operations
  addAttachment(noteId: string, sourcePath: string): string {
    const attachmentId = uuidv4()
    const destPath = this.getAttachmentPath(attachmentId)
    cryptoService.encryptFile(sourcePath, destPath)

    const stats = fs.statSync(sourcePath)
    const filename = path.basename(sourcePath)
    const mimeType = this.guessMimeType(filename)

    // 加密文件名后存储到 databaseService
    const encryptedFilename = cryptoService.encryptContent(filename).toString('base64')
    databaseService.createAttachment(attachmentId, noteId, encryptedFilename, mimeType, stats.size)

    // Update note's has_attachments flag
    const note = databaseService.getNoteById(noteId)
    if (note && !note.has_attachments) {
      databaseService.updateNote(noteId, { hasAttachments: 1 })
    }

    return attachmentId
  }

  getAttachmentData(attachmentId: string): Buffer {
    const filePath = this.getAttachmentPath(attachmentId)
    return cryptoService.decryptFile(filePath)
  }

  deleteAttachmentFile(attachmentId: string, permanent = false): void {
    if (permanent) {
      const filePath = this.getAttachmentPath(attachmentId)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
    // If not permanent, just mark as deleted in database
  }

  getDecryptedFilename(attachmentId: string): string | null {
    const attachment = databaseService.getAttachmentById(attachmentId)
    if (!attachment) return null
    // 从 databaseService 中获取加密文件名并解密
    const encrypted = Buffer.from(attachment.filename, 'base64')
    return cryptoService.decryptContent(encrypted)
  }

  private guessMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip'
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  // Full-text search requires decrypting all content
  async searchContent(query: string): Promise<Array<{ noteId: string; title: string; snippet: string }>> {
    const results: Array<{ noteId: string; title: string; snippet: string }> = []

    // Get all non-deleted notes directly from db
    const allNotes = databaseService.db.notes.filter(n => n.deleted_at === null)

    for (const note of allNotes) {
      try {
        const content = this.loadContent(note.id)
        // title 在 databaseService 中已经是解密后的
        const title = note.title
        if (content.includes(query)) {
          const index = content.indexOf(query)
          const start = Math.max(0, index - 50)
          const end = Math.min(content.length, index + query.length + 50)
          const snippet = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '')
          results.push({ noteId: note.id, title, snippet })
        }
      } catch {
        // Skip notes that can't be decrypted
      }
    }
    return results
  }
}

export const vaultService = new VaultService()
