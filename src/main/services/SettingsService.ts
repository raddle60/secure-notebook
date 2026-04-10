import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { writeFileSyncAtomic } from '../utils/fileUtils'

export interface AppSettings {
  // 分割栏位置
  leftPanelWidth: number
  folderTreeHeight: number
  recycleBinHeight: number
  noteListWidth: number
  // 上次打开的笔记目录
  lastOpenedDir: string | null
  // 最近打开的目录列表
  recentDirs: string[]
  // 最后打开的笔记 ID
  lastOpenedNoteId: string | null
  // 文本编辑器设置
  plainTextEditor: {
    showLineNumbers: boolean
    showWhitespace: boolean
    highlightSelection: boolean
  }
  // Markdown 编辑器设置
  markdownEditor: {
    showLineNumbers: boolean
    showSource: boolean
    showPreview: boolean
  }
  // 主题设置
  theme: 'light' | 'dark'
  // 自动锁定时间（分钟），0 表示禁用
  autoLockMinutes: number
  // 编辑器字体设置（所有编辑器共用）
  editorFont: {
    fontFamily: string
    fontSize: number
  }
  // UI 显示设置
  uiDisplay: {
    folderTreeCollapsed: boolean      // 文件夹导航是否收起
    noteListHideDate: boolean         // 笔记列表是否隐藏日期
    editorHeaderCollapsed: boolean    // 编辑器头部是否收起
  }
  // 编辑器实例缓存数量限制
  editorInstanceCacheSize: number     // keep-alive 最大缓存数量，默认 20
}

const DEFAULT_SETTINGS: AppSettings = {
  leftPanelWidth: 250,
  folderTreeHeight: 400,
  recycleBinHeight: 200,
  noteListWidth: 250,
  lastOpenedDir: null,
  recentDirs: [],
  lastOpenedNoteId: null,
  plainTextEditor: {
    showLineNumbers: false,
    showWhitespace: false,
    highlightSelection: true
  },
  markdownEditor: {
    showLineNumbers: false,
    showSource: true,
    showPreview: true
  },
  theme: 'dark',
  autoLockMinutes: 10,
  editorFont: {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 14
  },
  uiDisplay: {
    folderTreeCollapsed: false,
    noteListHideDate: false,
    editorHeaderCollapsed: false
  },
  editorInstanceCacheSize: 20
}

export class SettingsService {
  private settings: AppSettings = { ...DEFAULT_SETTINGS }
  private settingsPath: string = ''
  private customUserDataPath: string | null = null

  // 设置自定义的 userData 路径（用于分离浏览器文件）
  setUserDataPath(path: string): void {
    this.customUserDataPath = path
  }

  initialize(): void {
    const userDataPath = this.customUserDataPath || app.getPath('userData')
    this.settingsPath = path.join(userDataPath, 'settings.json')
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8')
        const loaded = JSON.parse(data)
        this.settings = { ...DEFAULT_SETTINGS, ...loaded }
      }
    } catch (e) {
      console.error('[Settings] Error loading settings:', e)
      this.settings = { ...DEFAULT_SETTINGS }
    }
  }

  private save(): void {
    try {
      writeFileSyncAtomic(this.settingsPath, JSON.stringify(this.settings, null, 2))
    } catch (e) {
      console.error('[Settings] Error saving settings:', e)
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings }
  }

  updateSettings(partial: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...partial }
    this.save()
  }

  updateLeftPanelWidth(width: number): void {
    this.settings.leftPanelWidth = width
    this.save()
  }

  updateFolderTreeHeight(height: number): void {
    this.settings.folderTreeHeight = height
    this.save()
  }

  updateRecycleBinHeight(height: number): void {
    this.settings.recycleBinHeight = height
    this.save()
  }

  updateNoteListWidth(width: number): void {
    this.settings.noteListWidth = width
    this.save()
  }

  getLastOpenedDir(): string | null {
    return this.settings.lastOpenedDir
  }

  setLastOpenedDir(dir: string): void {
    // 更新最近目录列表
    const recent = this.settings.recentDirs.filter(d => d !== dir)
    recent.unshift(dir)
    this.settings.recentDirs = recent.slice(0, 5)
    this.settings.lastOpenedDir = dir
    this.save()
  }

  getRecentDirs(): string[] {
    return this.settings.recentDirs
  }

  removeRecentDir(dir: string): void {
    this.settings.recentDirs = this.settings.recentDirs.filter(d => d !== dir)
    this.save()
  }

  getLastOpenedNoteId(): string | null {
    return this.settings.lastOpenedNoteId
  }

  setLastOpenedNoteId(noteId: string): void {
    this.settings.lastOpenedNoteId = noteId
    this.save()
  }

  clearLastOpenedNoteId(): void {
    this.settings.lastOpenedNoteId = null
    this.save()
  }

  getPlainTextEditorSettings(): { showLineNumbers: boolean; showWhitespace: boolean; highlightSelection: boolean } {
    return {
      showLineNumbers: this.settings.plainTextEditor.showLineNumbers,
      showWhitespace: this.settings.plainTextEditor.showWhitespace ?? false,
      highlightSelection: this.settings.plainTextEditor.highlightSelection ?? true
    }
  }

  updatePlainTextEditorSettings(settings: Partial<{ showLineNumbers: boolean; showWhitespace: boolean; highlightSelection: boolean }>): void {
    this.settings.plainTextEditor = { ...this.settings.plainTextEditor, ...settings }
    this.save()
  }

  getMarkdownEditorSettings(): { showLineNumbers: boolean; showSource: boolean; showPreview: boolean; highlightSelection?: boolean; showWhitespace?: boolean; sourcePaneWidth?: number } {
    return { ...this.settings.markdownEditor }
  }

  updateMarkdownEditorSettings(settings: Partial<{ showLineNumbers: boolean; showSource: boolean; showPreview: boolean; highlightSelection?: boolean; showWhitespace?: boolean; sourcePaneWidth?: number }>): void {
    this.settings.markdownEditor = { ...this.settings.markdownEditor, ...settings }
    this.save()
  }

  getTheme(): 'light' | 'dark' {
    return this.settings.theme
  }

  updateTheme(theme: 'light' | 'dark'): void {
    this.settings.theme = theme
    this.save()
  }

  getAutoLockMinutes(): number {
    return this.settings.autoLockMinutes
  }

  updateAutoLockMinutes(minutes: number): void {
    this.settings.autoLockMinutes = minutes
    this.save()
  }

  getEditorFont(): { fontFamily: string; fontSize: number } {
    // 返回默认值，避免返回 undefined
    return this.settings.editorFont || DEFAULT_SETTINGS.editorFont
  }

  updateEditorFont(fontFamily: string, fontSize: number): void {
    this.settings.editorFont = { fontFamily, fontSize }
    this.save()
  }

  getUiDisplaySettings(): { folderTreeCollapsed: boolean; noteListHideDate: boolean; editorHeaderCollapsed: boolean } {
    return this.settings.uiDisplay || DEFAULT_SETTINGS.uiDisplay
  }

  updateFolderTreeCollapsed(collapsed: boolean): void {
    this.settings.uiDisplay = { ...this.settings.uiDisplay, folderTreeCollapsed: collapsed }
    this.save()
  }

  updateNoteListHideDate(hideDate: boolean): void {
    this.settings.uiDisplay = { ...this.settings.uiDisplay, noteListHideDate: hideDate }
    this.save()
  }

  updateEditorHeaderCollapsed(collapsed: boolean): void {
    this.settings.uiDisplay = { ...this.settings.uiDisplay, editorHeaderCollapsed: collapsed }
    this.save()
  }

  getEditorInstanceCacheSize(): number {
    return this.settings.editorInstanceCacheSize || DEFAULT_SETTINGS.editorInstanceCacheSize
  }

  updateEditorInstanceCacheSize(size: number): void {
    this.settings.editorInstanceCacheSize = size
    this.save()
  }
}

export const settingsService = new SettingsService()
