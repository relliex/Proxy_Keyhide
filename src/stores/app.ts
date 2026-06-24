import { create } from 'zustand'
import type { AppData, UpstreamPlatform, ProxyConfig, AppSettings, RequestLog, ToastMessage } from '../../electron/shared/types'

interface AppState {
  data: AppData | null
  loading: boolean
  proxyRunning: boolean
  toasts: ToastMessage[]

  // 数据操作
  loadData: () => Promise<void>
  savePlatform: (platform: UpstreamPlatform) => Promise<void>
  deletePlatform: (id: string) => Promise<void>
  saveProxyConfig: (config: Partial<ProxyConfig>) => Promise<void>
  saveSettings: (settings: Partial<AppSettings>) => Promise<void>
  clearLogs: () => Promise<void>
  resetStats: () => Promise<void>
  clearAllData: () => Promise<void>

  // 服务控制
  startProxy: () => Promise<{ success: boolean; message: string }>
  stopProxy: () => Promise<{ success: boolean; message: string }>

  // 日志和状态
  addLog: (log: RequestLog) => void
  setProxyRunning: (running: boolean) => void

  // Toast
  showToast: (toast: ToastMessage) => void
  removeToast: (index: number) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  data: null,
  loading: true,
  proxyRunning: false,
  toasts: [],

  loadData: async () => {
    set({ loading: true })
    const data = await window.api.getData()
    set({ data, loading: false })
  },

  savePlatform: async (platform) => {
    await window.api.savePlatform(platform)
    const data = get().data
    if (data) {
      const idx = data.platforms.findIndex((p) => p.id === platform.id)
      if (idx >= 0) {
        data.platforms[idx] = platform
      } else {
        data.platforms.push(platform)
      }
      set({ data: { ...data } })
    }
  },

  deletePlatform: async (id) => {
    await window.api.deletePlatform(id)
    const data = get().data
    if (data) {
      data.platforms = data.platforms.filter((p) => p.id !== id)
      if (data.settings.defaultPlatformId === id) {
        data.settings.defaultPlatformId = null
      }
      set({ data: { ...data } })
    }
  },

  saveProxyConfig: async (config) => {
    const proxy = await window.api.saveProxyConfig(config)
    const data = get().data
    if (data) {
      set({ data: { ...data, proxy } })
    }
  },

  saveSettings: async (settings) => {
    const newSettings = await window.api.saveSettings(settings)
    const data = get().data
    if (data) {
      set({ data: { ...data, settings: newSettings } })
    }
  },

  clearLogs: async () => {
    await window.api.clearLogs()
    const data = get().data
    if (data) {
      set({ data: { ...data, logs: [] } })
    }
  },

  resetStats: async () => {
    await window.api.resetStats()
    await get().loadData()
  },

  clearAllData: async () => {
    await window.api.clearAllData()
    await get().loadData()
  },

  startProxy: async () => {
    const result = await window.api.startProxy()
    if (result.success) {
      set({ proxyRunning: true })
    }
    get().showToast({ type: result.success ? 'success' : 'error', message: result.message })
    return result
  },

  stopProxy: async () => {
    const result = await window.api.stopProxy()
    if (result.success) {
      set({ proxyRunning: false })
    }
    get().showToast({ type: result.success ? 'success' : 'error', message: result.message })
    return result
  },

  addLog: (log) => {
    const data = get().data
    if (data) {
      set({ data: { ...data, logs: [log, ...data.logs].slice(0, data.proxy.maxLogs) } })
    }
  },

  setProxyRunning: (running) => {
    set({ proxyRunning: running })
  },

  showToast: (toast) => {
    set((state) => ({ toasts: [...state.toasts, toast] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.slice(1) }))
    }, 3000)
  },

  removeToast: (index) => {
    set((state) => ({ toasts: state.toasts.filter((_, i) => i !== index) }))
  }
}))
