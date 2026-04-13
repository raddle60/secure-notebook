import { app } from 'electron'

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  console.log('[SingleInstance] Another instance is running, exiting immediately')
  app.exit(0)
  process.exit(0) // 再加一层保险
}
console.log('init app')
// 只有主实例才会继续执行下面的代码

import {BrowserWindow, Menu, MenuItem, nativeTheme, powerMonitor } from 'electron'
import path from 'path'
import fs from 'fs'
import { WindowManager } from './WindowManager'
import { registerIPCHandlers } from './services/IPCHandlers'
import { settingsService } from './services/SettingsService'
import { cryptoService } from './services/CryptoService'

// 保存 userData 路径供后续使用
let savedUserDataPath: string

// 解析命令行参数，获取外部文件路径
function getExternalFilePathFromArgs(args: string[]): string | null {
  // 命令行格式: app.exe "C:\path\to\file.txt"
  // args[0] 是 app path, args[2] 是文件路径
  if (args.length < 2) {
    return null
  }
  let filePath = args[2]?.trim()
  if (!filePath) {
    return null
  }
  console.log("externalFile: "+filePath)
  // 检查是否是有效的文件路径（不是 URL 或其他参数）
  if (filePath.startsWith('-') || filePath.startsWith('--')) {
    return null
  }
  // 转换成绝对路径
  return path.resolve(filePath)
}

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

  // 注册 second-instance 监听器（仅主实例）
  app.on('second-instance', (event, commandLine) => {
    console.log('[SingleInstance] Second instance detected')
    console.log('[SingleInstance] Command line:', commandLine)
    const externalFilePath = getExternalFilePathFromArgs(commandLine)
    console.log('[SingleInstance] External file path:', externalFilePath)
    if (externalFilePath) {
      // 通知渲染进程打开外部文件，让渲染器决定创建到哪个文件夹
      const mainWindow = WindowManager.getMainWindow()
      console.log('[SingleInstance] Main window:', mainWindow ? 'exists' : 'null')
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[SingleInstance] Sending note:openExternalFile event')
        mainWindow.webContents.send('note:openExternalFile', externalFilePath)
        // 将窗口带到前台
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        mainWindow.focus()
        console.log('[SingleInstance] Window focused')
      }
    }
  })
  
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
