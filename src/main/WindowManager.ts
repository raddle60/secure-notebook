import { BrowserWindow, app, globalShortcut } from 'electron'
import path from 'path'

export class WindowManager {
  private static mainWindow: BrowserWindow | null = null

  static createMainWindow(): BrowserWindow {
    const isDev = !app.isPackaged
    let icon_path = path.join(__dirname, '../../resources/icon.ico')
    if(!isDev){
      icon_path = path.join(__dirname, '../../../app.asar.unpacked/resources/icon.ico')
    }

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
        sandbox: false
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
