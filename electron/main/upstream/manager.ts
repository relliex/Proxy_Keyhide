import type { UpstreamPlatform, UpstreamKey, RouteMode } from '../../shared/types'
import { loadData, updateKeyStatus } from '../database'

/** 选择结果 */
export interface SelectionResult {
  platform: UpstreamPlatform
  key: UpstreamKey
}

/** 轮询索引缓存：platformId -> 下一个索引 */
const roundRobinIndex: Map<string, number> = new Map()

/**
 * 根据模型名找到支持该模型的平台
 */
export function findPlatformsByModel(model: string): UpstreamPlatform[] {
  const data = loadData()
  return data.platforms.filter(
    (p) => p.enabled && (p.models.length === 0 || p.models.includes(model))
  )
}

/**
 * 根据路由模式选择上游平台和Key
 */
export function selectUpstream(
  model: string,
  routeMode: RouteMode,
  defaultPlatformId: string | null,
  preferredPlatformId?: string
): SelectionResult | null {
  const data = loadData()

  // 如果指定了优先平台，先尝试
  if (preferredPlatformId) {
    const platform = data.platforms.find((p) => p.id === preferredPlatformId && p.enabled)
    if (platform) {
      const key = selectKey(platform)
      if (key) return { platform, key }
    }
  }

  // by-model 模式：根据模型找平台
  if (routeMode === 'by-model' || routeMode === 'auto') {
    const candidates = findPlatformsByModel(model)
    // auto 模式下，如果有默认平台且支持该模型，优先使用
    if (routeMode === 'auto' && defaultPlatformId) {
      const defaultPlatform = candidates.find((p) => p.id === defaultPlatformId)
      if (defaultPlatform) {
        const key = selectKey(defaultPlatform)
        if (key) return { platform: defaultPlatform, key }
      }
    }
    // 遍历候选平台
    for (const platform of candidates) {
      const key = selectKey(platform)
      if (key) return { platform, key }
    }
  }

  // by-path 模式或兜底：使用默认平台
  if (defaultPlatformId) {
    const platform = data.platforms.find((p) => p.id === defaultPlatformId && p.enabled)
    if (platform) {
      const key = selectKey(platform)
      if (key) return { platform, key }
    }
  }

  // 最终兜底：遍历所有启用的平台
  for (const platform of data.platforms) {
    if (!platform.enabled) continue
    const key = selectKey(platform)
    if (key) return { platform, key }
  }

  return null
}

/**
 * 根据负载均衡策略选择一个可用的 Key
 */
export function selectKey(platform: UpstreamPlatform): UpstreamKey | null {
  const availableKeys = platform.keys.filter((k) => k.status === 'active' || k.status === 'error')
  if (availableKeys.length === 0) return null

  // 过滤掉连续错误次数过多的 key（>=5 次跳过）
  const healthyKeys = availableKeys.filter((k) => k.errorStreak < 5)
  const pool = healthyKeys.length > 0 ? healthyKeys : availableKeys

  switch (platform.strategy) {
    case 'round-robin': {
      const idx = roundRobinIndex.get(platform.id) ?? 0
      const selected = pool[idx % pool.length]
      roundRobinIndex.set(platform.id, (idx + 1) % pool.length)
      return selected
    }
    case 'priority': {
      return [...pool].sort((a, b) => a.priority - b.priority)[0]
    }
    case 'weighted': {
      const totalWeight = pool.reduce((sum, k) => sum + Math.max(k.weight, 1), 0)
      let r = Math.random() * totalWeight
      for (const k of pool) {
        r -= Math.max(k.weight, 1)
        if (r <= 0) return k
      }
      return pool[0]
    }
    case 'random': {
      return pool[Math.floor(Math.random() * pool.length)]
    }
    default:
      return pool[0]
  }
}

/**
 * 标记 Key 使用成功
 */
export function markKeySuccess(platformId: string, keyId: string, tokens: number): void {
  const data = loadData()
  const platform = data.platforms.find((p) => p.id === platformId)
  const key = platform?.keys.find((k) => k.id === keyId)
  if (key) {
    key.requestCount++
    key.quotaUsed += tokens
    key.errorStreak = 0
    key.lastError = null
    key.lastUsedAt = Date.now()
    if (key.quotaLimit > 0 && key.quotaUsed >= key.quotaLimit) {
      key.status = 'exhausted'
    } else {
      key.status = 'active'
    }
    updateKeyStatus(platformId, keyId, {
      requestCount: key.requestCount,
      quotaUsed: key.quotaUsed,
      errorStreak: key.errorStreak,
      lastError: key.lastError,
      lastUsedAt: key.lastUsedAt,
      status: key.status
    })
  }
}

/**
 * 标记 Key 使用失败
 */
export function markKeyError(
  platformId: string,
  keyId: string,
  error: string,
  statusCode: number
): void {
  const data = loadData()
  const platform = data.platforms.find((p) => p.id === platformId)
  const key = platform?.keys.find((k) => k.id === keyId)
  if (!key) return

  key.errorStreak++
  key.lastError = error
  key.lastUsedAt = Date.now()

  // 401/403 -> key 失效
  // 429 -> 额度耗尽
  // 5xx -> 服务端错误，不立即禁用
  if (statusCode === 401 || statusCode === 403) {
    key.status = 'disabled'
  } else if (statusCode === 429) {
    key.status = 'exhausted'
  }

  // 自动禁用开关：任何错误（超时/错误响应）都立即禁用该 Key
  if (data.settings.autoDisableKeyOnError && key.status === 'active') {
    key.status = 'disabled'
  }

  updateKeyStatus(platformId, keyId, {
    errorStreak: key.errorStreak,
    lastError: key.lastError,
    lastUsedAt: key.lastUsedAt,
    status: key.status
  })
}

/**
 * 获取所有可用模型（去重）
 */
export function getAllAvailableModels(): string[] {
  const data = loadData()
  const models = new Set<string>()
  for (const platform of data.platforms) {
    if (!platform.enabled) continue
    for (const model of platform.models) {
      models.add(model)
    }
  }
  return Array.from(models).sort()
}
