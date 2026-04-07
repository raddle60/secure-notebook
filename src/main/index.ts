import { app, BrowserWindow, Menu, MenuItem, nativeTheme, powerMonitor } from 'electron'
import path from 'path'
import { WindowManager } from './WindowManager'
import { registerIPCHandlers } from './services/IPCHandlers'
import { settingsService } from './services/SettingsService'
import { cryptoService } from './services/CryptoService'

// 保存 userData 路径供后续使用
let savedUserDataPath: string

// 在 app ready 时立即设置 cache 路径（在创建任何窗口之前）
app.on('ready', () => {
  savedUserDataPath = app.getPath('userData')
  const browserHomePath = path.join(savedUserDataPath, 'browser_home')
  // 设置所有浏览器相关的路径
  app.setPath('cache', browserHomePath)
  // 如果 Electron 版本支持，设置 sessionData 路径
  try {
    app.setPath('sessionData', browserHomePath)
  } catch (e) {
    // 某些 Electron 版本不支持 sessionData
  }
}, { once: true })

function lockVault() {
  if (cryptoService.isUnlocked()) {
    cryptoService.lock()
    // 通知渲染进程锁定屏幕
    const mainWindow = WindowManager.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('vault:locked')
    }
  }
}

/**
 * 清理锁文件并锁定金库
 */
function cleanupAndLockVault() {
  console.log('[System] Cleaning up vault lock before exit')
  cryptoService.lock()
}

function registerSystemEvents() {
  // 监听系统锁定事件
  powerMonitor.on('lock-screen', () => {
    console.log('[System] Screen locked')
    lockVault()
  })

  // 监听系统解锁事件（可选：可以在解锁后提示用户）
  powerMonitor.on('unlock-screen', () => {
    console.log('[System] Screen unlocked')
  })

  // 监听会话结束（用户注销或系统关机）
  app.on('before-quit', () => {
    console.log('[System] App quitting, locking vault')
    cleanupAndLockVault()
  })

  // 进程退出前清理锁文件（确保清理）
  process.on('exit', () => {
    cryptoService.lock()
  })

  // macOS 下的快速用户切换
  app.on('login-item-changed', () => {
    console.log('[System] Login item changed')
  })

  // Windows 下的会话切换
  powerMonitor.on('suspend', () => {
    console.log('[System] System suspending, locking vault')
    lockVault()
  })
}

function createAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: '锁定',
          click: () => {
            cryptoService.lock()
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          click: () => {
            app.quit()
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  // 设置 settingsService 使用原始 userData 路径
  settingsService.setUserDataPath(savedUserDataPath)

  // 初始化设置服务
  settingsService.initialize()

  // 根据设置初始化主题
  const theme = settingsService.getTheme()
  nativeTheme.themeSource = theme

  registerIPCHandlers()
  WindowManager.createMainWindow()
  createAppMenu()

  // 注册系统事件（锁定、注销、关机等）
  registerSystemEvents()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    WindowManager.createMainWindow()
  }
})
