import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from 'electron'
import { join } from 'path'
import { createWindow, getMainWindow } from './window'
import { registerIpc } from './ipc'
import { loadData } from './database'
import { startProxy, setEmitCallbacks } from './proxy-server'

let tray: Tray | null = null

function createTray(): void {
  // 创建一个简单的图标
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        const win = getMainWindow()
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])
  tray.setToolTip('Keyhide - AI中转服务')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    const win = getMainWindow()
    if (win) {
      win.show()
      win.focus()
    }
  })
}

app.whenReady().then(() => {
  // 初始化数据
  loadData()

  // 设置事件回调
  setEmitCallbacks(
    (log) => {
      const win = getMainWindow()
      win?.webContents.send('log-added', log)
    },
    (running) => {
      const win = getMainWindow()
      win?.webContents.send('proxy-status-changed', running)
    }
  )

  // 注册 IPC
  registerIpc()

  // 创建窗口
  createWindow()

  // 创建托盘
  createTray()

  // 自动启动代理服务
  const data = loadData()
  if (data.settings.autoStartProxy) {
    startProxy().then((result) => {
      const win = getMainWindow()
      if (win) {
        win.webContents.send('toast', {
          type: result.success ? 'success' : 'error',
          message: result.message
        })
      }
    })
  }
})

app.on('window-all-closed', () => {
  const data = loadData()
  if (data.settings.minimizeToTray) {
    // 最小化到托盘，不退出
  } else {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 阻止默认菜单
Menu.setApplicationMenu(null)
