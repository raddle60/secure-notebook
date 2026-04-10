import { BrowserWindow, app, globalShortcut, session, Session } from 'electron'
import path from 'path'
import crypto from 'crypto'

export class WindowManager {
  private static mainWindow: BrowserWindow | null = null
  // 随机生成的 partition ID（仅内存，不带 persist: 前缀）
  private static partitionId: string = `partition-${crypto.randomBytes(16).toString('hex')}`
  private static partition: Session | null = null

  // 获取或创建 partition
  private static getPartition(): Session {
    if (!this.partition && this.partitionId) {
      // 使用自定义 partition，数据仅存在于内存
      this.partition = session.fromPartition(this.partitionId)
    }
    return this.partition || session.defaultSession
  }

  static createMainWindow(): BrowserWindow {
    const isDev = !app.isPackaged
    let icon_path = path.join(__dirname, '../../resources/icon.ico')
    if(!isDev){
      icon_path = path.join(__dirname, '../../../app.asar.unpacked/resources/icon.ico')
    }

    // 获取自定义 partition（用于多实例隔离）
    const partition = this.getPartition()

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      frame: true, // 使用系统标题栏
      backgroundColor: '#1e1e1e', // 暗色模式背景色
      icon: icon_path,
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        session: partition  // 使用自定义 partition
      },
      show: false
    })

    // 隐藏菜单栏（禁止按 Alt 键显示）
    this.mainWindow.setMenuBarVisibility(false)
    this.mainWindow.autoHideMenuBar = false

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.maximize()
      this.mainWindow?.show()
    })

    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173')
      // 注册 Ctrl+Shift+I 快捷键切换 DevTools
      globalShortcut.register('CommandOrControl+Shift+I', () => {
        this.mainWindow?.webContents.toggleDevTools()
      })
      // 注册 Ctrl+R 和 F5 快捷键刷新页面
      globalShortcut.register('CommandOrControl+R', () => {
        this.mainWindow?.webContents.reload()
      })
      globalShortcut.register('F5', () => {
        this.mainWindow?.webContents.reload()
      })
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })

    return this.mainWindow
  }

  static getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }
}
