import { ipcMain, dialog, clipboard } from 'electron'
import { randomBytes } from 'crypto'
import { writeFileSync, readFileSync } from 'fs'
import {
  getData,
  savePlatform,
  deletePlatform,
  saveProxyConfig,
  saveSettings,
  clearLogs,
  createNewPlatform,
  createNewKey,
  loadData,
  saveData,
  resetStats,
  clearAllData
} from './database'
import { startProxy, stopProxy, isProxyRunning, fetchUpstreamModels, testConnection } from './proxy-server'
import type { UpstreamPlatform, ProxyConfig, AppSettings } from '../shared/types'

/** 生成随机 API Key */
function generateMaskedKey(): string {
  return 'sk-keyhide-' + randomBytes(16).toString('hex')
}

export function registerIpc(): void {
  // 获取完整数据
  ipcMain.handle('get-data', async () => {
    return getData()
  })

  // 保存平台
  ipcMain.handle('save-platform', async (_, platform: UpstreamPlatform) => {
    return savePlatform(platform)
  })

  // 删除平台
  ipcMain.handle('delete-platform', async (_, id: string) => {
    deletePlatform(id)
  })

  // 保存代理配置
  ipcMain.handle('save-proxy-config', async (_, config: Partial<ProxyConfig>) => {
    return saveProxyConfig(config)
  })

  // 保存设置
  ipcMain.handle('save-settings', async (_, settings: Partial<AppSettings>) => {
    return saveSettings(settings)
  })

  // 清空日志
  ipcMain.handle('clear-logs', async () => {
    clearLogs()
  })

  // 重置统计数据（清除日志 + 重置Key使用计数）
  ipcMain.handle('reset-stats', async () => {
    resetStats()
  })

  // 清除所有数据（恢复初始状态，保留伪装Key）
  ipcMain.handle('clear-all-data', async () => {
    clearAllData()
  })

  // 启动代理
  ipcMain.handle('start-proxy', async () => {
    return startProxy()
  })

  // 停止代理
  ipcMain.handle('stop-proxy', async () => {
    return stopProxy()
  })

  // 获取代理状态
  ipcMain.handle('proxy-status', async () => {
    return isProxyRunning()
  })

  // 获取上游模型
  ipcMain.handle('fetch-models', async (_, platformId: string) => {
    return fetchUpstreamModels(platformId)
  })

  // 测试连接
  ipcMain.handle('test-connection', async (_, platformId: string) => {
    return testConnection(platformId)
  })

  // 创建新平台
  ipcMain.handle('create-platform', async () => {
    return createNewPlatform()
  })

  // 创建新 Key
  ipcMain.handle('create-key', async (_, keyValue: string, label: string) => {
    return createNewKey(keyValue, label)
  })

  // 重新生成伪装 API Key
  ipcMain.handle('regenerate-masked-key', async () => {
    const newKey = generateMaskedKey()
    return saveProxyConfig({ maskedApiKey: newKey })
  })

  // 导出配置
  ipcMain.handle('export-config', async () => {
    const data = loadData()
    // 导出时清除日志
    const exportData = { ...data, logs: [] }
    return JSON.stringify(exportData, null, 2)
  })

  // 导入配置
  ipcMain.handle('import-config', async (_, dataStr: string) => {
    try {
      const imported = JSON.parse(dataStr)
      const data = loadData()
      if (imported.platforms) data.platforms = imported.platforms
      if (imported.proxy) data.proxy = { ...data.proxy, ...imported.proxy }
      if (imported.settings) data.settings = { ...data.settings, ...imported.settings }
      saveData(data)
      return { success: true, message: '配置导入成功' }
    } catch (err: any) {
      return { success: false, message: `导入失败: ${err.message}` }
    }
  })

  // 复制到剪贴板
  ipcMain.handle('clipboard-write', async (_, text: string) => {
    clipboard.writeText(text)
  })

  // 选择文件保存
  ipcMain.handle('save-file-dialog', async (_, defaultName: string, content: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, content, 'utf-8')
      return { success: true, path: result.filePath }
    }
    return { success: false, path: '' }
  })

  // 选择文件打开
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const content = readFileSync(result.filePaths[0], 'utf-8')
      return { success: true, content }
    }
    return { success: false, content: '' }
  })
}
