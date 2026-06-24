import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto'
import { hostname, userInfo } from 'os'
import type { AppData, UpstreamPlatform, UpstreamKey, ProxyConfig, AppSettings, RequestLog } from '../shared/types'

const DATA_FILE = 'keyhide.enc'
const SALT_FILE = 'keyhide.salt'

/** 生成唯一 ID */
function generateId(): string {
  return randomBytes(12).toString('hex')
}

/** 生成随机 API Key */
function generateMaskedKey(): string {
  return 'sk-keyhide-' + randomBytes(16).toString('hex')
}

/** 获取数据存储目录：AppData\LocalLow\Keyhide */
function getDataDir(): string {
  // Windows: C:\Users\{user}\AppData\LocalLow\Keyhide
  const localLow = join(require('os').homedir(), 'AppData', 'LocalLow', 'Keyhide')
  return localLow
}

/** 基于机器特征生成加密密钥 */
function getEncryptionKey(salt: Buffer): Buffer {
  // 使用机器名 + 用户名作为密钥种子，确保数据只能在同一台机器上解密
  const machineId = `${hostname()}-${userInfo().username}-keyhide-v1`
  return scryptSync(machineId, salt, 32)
}

/** 加密数据 */
function encryptData(data: string, key: Buffer): Buffer {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // 格式: iv(16) + authTag(16) + encrypted data
  return Buffer.concat([iv, authTag, encrypted])
}

/** 解密数据 */
function decryptData(encryptedData: Buffer, key: Buffer): string {
  const iv = encryptedData.subarray(0, 16)
  const authTag = encryptedData.subarray(16, 32)
  const encrypted = encryptedData.subarray(32)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
}

/** 获取或创建加密盐 */
function getOrCreateSalt(saltPath: string): Buffer {
  if (existsSync(saltPath)) {
    return readFileSync(saltPath)
  }
  const salt = randomBytes(32)
  writeFileSync(saltPath, salt)
  return salt
}

function getDataPath(): string {
  return join(getDataDir(), DATA_FILE)
}

function getSaltPath(): string {
  return join(getDataDir(), SALT_FILE)
}

function defaultData(): AppData {
  return {
    platforms: [],
    proxy: {
      port: 7860,
      host: '127.0.0.1',
      maskedApiKey: generateMaskedKey(),
      running: false,
      cors: true,
      timeout: 120000,
      logRequests: true,
      maxLogs: 2000
    },
    settings: {
      routeMode: 'auto',
      defaultPlatformId: null,
      autoStartProxy: false,
      minimizeToTray: false,
      autoDisableKeyOnError: false,
      theme: 'dark'
    },
    logs: []
  }
}

let cache: AppData | null = null

export function loadData(): AppData {
  if (cache) return cache
  const dataDir = getDataDir()
  const filePath = getDataPath()
  const saltPath = getSaltPath()

  try {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }

    if (existsSync(filePath)) {
      const salt = getOrCreateSalt(saltPath)
      const key = getEncryptionKey(salt)
      const encryptedData = readFileSync(filePath)
      const decrypted = decryptData(encryptedData, key)
      const parsed = JSON.parse(decrypted) as AppData
      cache = {
        ...defaultData(),
        ...parsed,
        proxy: { ...defaultData().proxy, ...parsed.proxy },
        settings: { ...defaultData().settings, ...parsed.settings }
      }
    } else {
      cache = defaultData()
      saveData(cache)
    }
  } catch (err) {
    console.error('Failed to load data, using defaults:', err)
    cache = defaultData()
    // 尝试保存默认数据
    try {
      saveData(cache)
    } catch (e) {
      console.error('Failed to save default data:', e)
    }
  }
  return cache
}

export function saveData(data?: AppData): void {
  const d = data || cache
  if (!d) return
  cache = d
  const dataDir = getDataDir()
  const filePath = getDataPath()
  const saltPath = getSaltPath()

  try {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }
    const salt = getOrCreateSalt(saltPath)
    const key = getEncryptionKey(salt)
    const jsonStr = JSON.stringify(d, null, 2)
    const encrypted = encryptData(jsonStr, key)
    writeFileSync(filePath, encrypted)
  } catch (err) {
    console.error('Failed to save data:', err)
  }
}

export function getData(): AppData {
  return loadData()
}

export function savePlatform(platform: UpstreamPlatform): UpstreamPlatform {
  const data = loadData()
  const idx = data.platforms.findIndex((p) => p.id === platform.id)
  platform.updatedAt = Date.now()
  if (idx >= 0) {
    data.platforms[idx] = platform
  } else {
    data.platforms.push(platform)
  }
  saveData(data)
  return platform
}

export function deletePlatform(id: string): void {
  const data = loadData()
  data.platforms = data.platforms.filter((p) => p.id !== id)
  if (data.settings.defaultPlatformId === id) {
    data.settings.defaultPlatformId = null
  }
  saveData(data)
}

export function saveProxyConfig(config: Partial<ProxyConfig>): ProxyConfig {
  const data = loadData()
  data.proxy = { ...data.proxy, ...config }
  saveData(data)
  return data.proxy
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const data = loadData()
  data.settings = { ...data.settings, ...settings }
  saveData(data)
  return data.settings
}

export function addLog(log: RequestLog): void {
  const data = loadData()
  data.logs.unshift(log)
  if (data.logs.length > data.proxy.maxLogs) {
    data.logs = data.logs.slice(0, data.proxy.maxLogs)
  }
  saveData(data)
}

export function clearLogs(): void {
  const data = loadData()
  data.logs = []
  saveData(data)
}

/** 重置所有统计数据：清除日志、重置Key使用计数 */
export function resetStats(): void {
  const data = loadData()
  data.logs = []
  for (const platform of data.platforms) {
    for (const key of platform.keys) {
      key.requestCount = 0
      key.quotaUsed = 0
      key.errorStreak = 0
      key.lastError = null
      key.lastUsedAt = null
      if (key.status === 'exhausted' || key.status === 'error') {
        key.status = 'active'
      }
    }
  }
  saveData(data)
}

/** 清除所有数据：恢复到初始状态 */
export function clearAllData(): void {
  const data = loadData()
  const oldProxyKey = data.proxy.maskedApiKey
  cache = defaultData()
  // 保留伪装 API Key
  cache.proxy.maskedApiKey = oldProxyKey
  saveData(cache)
}

export function updatePlatformModels(platformId: string, models: string[]): void {
  const data = loadData()
  const platform = data.platforms.find((p) => p.id === platformId)
  if (platform) {
    platform.models = models
    platform.updatedAt = Date.now()
    saveData(data)
  }
}

export function updateKeyStatus(
  platformId: string,
  keyId: string,
  update: Partial<UpstreamKey>
): void {
  const data = loadData()
  const platform = data.platforms.find((p) => p.id === platformId)
  if (platform) {
    const key = platform.keys.find((k) => k.id === keyId)
    if (key) {
      Object.assign(key, update)
      saveData(data)
    }
  }
}

export function createNewPlatform(): UpstreamPlatform {
  return {
    id: generateId(),
    name: '',
    type: 'openai',
    baseUrl: 'https://api.openai.com',
    models: [],
    keys: [],
    strategy: 'round-robin',
    enabled: true,
    customHeaders: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

export function createNewKey(keyValue: string, label = ''): UpstreamKey {
  return {
    id: generateId(),
    key: keyValue,
    label: label || `Key-${Date.now().toString(36)}`,
    status: 'active',
    requestCount: 0,
    lastUsedAt: null,
    lastError: null,
    errorStreak: 0,
    weight: 1,
    priority: 0,
    quotaLimit: 0,
    quotaUsed: 0,
    createdAt: Date.now()
  }
}
