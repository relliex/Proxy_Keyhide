import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../stores/app'
import { Card, StatCard, Button, Badge, EmptyState } from '../components/ui'
import { Server, Key, Network, Activity, Zap, Play, Square, ArrowRight, Search, Copy, Check, Box } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

export function Dashboard() {
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const proxyRunning = useAppStore((s) => s.proxyRunning)
  const startProxy = useAppStore((s) => s.startProxy)
  const stopProxy = useAppStore((s) => s.stopProxy)
  const loadData = useAppStore((s) => s.loadData)

  const [searchQuery, setSearchQuery] = useState('')
  const [copiedModel, setCopiedModel] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  // 构建模型列表：模型名 + 平台归属
  const modelList = useMemo(() => {
    if (!data) return []
    const list: { model: string; platformName: string; platformType: string; platformId: string }[] = []
    for (const platform of data.platforms) {
      if (!platform.enabled) continue
      for (const model of platform.models) {
        list.push({
          model,
          platformName: platform.name || '未命名',
          platformType: platform.type,
          platformId: platform.id
        })
      }
    }
    // 去重（同一模型可能被多个平台支持，保留所有出现以显示多平台归属）
    return list.sort((a, b) => a.model.localeCompare(b.model))
  }, [data])

  // 搜索过滤
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return modelList
    const q = searchQuery.toLowerCase().trim()
    return modelList.filter(
      (item) =>
        item.model.toLowerCase().includes(q) ||
        item.platformName.toLowerCase().includes(q) ||
        item.platformType.toLowerCase().includes(q)
    )
  }, [modelList, searchQuery])

  const handleCopyModel = async (model: string) => {
    await window.extraApi.clipboardWrite(model)
    setCopiedModel(model)
    setTimeout(() => setCopiedModel(null), 1500)
  }

  if (!data) return null

  const totalPlatforms = data.platforms.length
  const enabledPlatforms = data.platforms.filter((p) => p.enabled).length
  const totalKeys = data.platforms.reduce((sum, p) => sum + p.keys.length, 0)
  const activeKeys = data.platforms.reduce(
    (sum, p) => sum + p.keys.filter((k) => k.status === 'active').length,
    0
  )
  const totalRequests = data.logs.length
  const successRequests = data.logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length
  const totalTokens = data.logs.reduce((sum, l) => sum + l.promptTokens + l.completionTokens, 0)

  const recentLogs = data.logs.slice(0, 5)

  return (
    <div className="mx-auto max-w-6xl p-8">
      {/* 标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">仪表盘</h1>
        <p className="mt-1 text-sm text-text-muted">AI中转服务总览与快速操作</p>
      </div>

      {/* 服务控制卡片 */}
      <div className="mb-8 card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={clsx(
                'flex h-14 w-14 items-center justify-center rounded-xl',
                proxyRunning
                  ? 'bg-success/15 text-success'
                  : 'bg-bg-tertiary text-text-muted'
              )}
            >
              {proxyRunning ? <Zap className="h-7 w-7" /> : <Server className="h-7 w-7" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">代理服务</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className={clsx('status-dot', proxyRunning ? 'active' : 'inactive')} />
                <span className="text-sm text-text-secondary">
                  {proxyRunning
                    ? `运行中 · http://${data.proxy.host}:${data.proxy.port}`
                    : '已停止'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {proxyRunning ? (
              <Button variant="danger" onClick={stopProxy}>
                <Square className="h-4 w-4" />
                停止服务
              </Button>
            ) : (
              <Button variant="primary" onClick={startProxy}>
                <Play className="h-4 w-4" />
                启动服务
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/proxy')}>
              详细配置
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard
          label="上游平台"
          value={`${enabledPlatforms}/${totalPlatforms}`}
          icon={<Network className="h-6 w-6" />}
          trend="启用/总计"
          color="accent"
        />
        <StatCard
          label="活跃 API Key"
          value={`${activeKeys}/${totalKeys}`}
          icon={<Key className="h-6 w-6" />}
          trend="可用/总计"
          color="success"
        />
        <StatCard
          label="请求总数"
          value={totalRequests}
          icon={<Activity className="h-6 w-6" />}
          trend={`成功率 ${totalRequests > 0 ? Math.round((successRequests / totalRequests) * 100) : 0}%`}
          color="warning"
        />
        <StatCard
          label="Token 用量"
          value={totalTokens.toLocaleString()}
          icon={<Zap className="h-6 w-6" />}
          trend="累计消耗"
          color="danger"
        />
      </div>

      {/* 最近请求 + 平台概览 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 最近请求 */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">最近请求</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/logs')}>
              查看全部
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          {recentLogs.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Activity className="h-8 w-8" />}
                title="暂无请求记录"
                description="启动代理服务后，所有经过代理的请求将显示在这里"
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-secondary px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        'status-dot',
                        log.statusCode >= 200 && log.statusCode < 300
                          ? 'active'
                          : log.statusCode >= 400 && log.statusCode < 500
                          ? 'error'
                          : 'inactive'
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{log.model || log.path}</p>
                      <p className="text-xs text-text-muted">
                        {log.platformName} · {log.keyLabel}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        log.statusCode >= 200 && log.statusCode < 300 ? 'success' : 'danger'
                      }
                    >
                      {log.statusCode}
                    </Badge>
                    <p className="mt-1 text-xs text-text-muted">{log.duration}ms</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 平台概览 */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">平台概览</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/platforms')}>
              管理平台
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          {data.platforms.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Network className="h-8 w-8" />}
                title="暂无上游平台"
                description="添加你的第一个 AI 平台，开始使用代理服务"
                action={
                  <Button onClick={() => navigate('/platforms')}>
                    <Network className="h-4 w-4" />
                    添加平台
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {data.platforms.map((platform) => {
                const activeKeys = platform.keys.filter((k) => k.status === 'active').length
                return (
                  <div
                    key={platform.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-bg-secondary px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          'flex h-8 w-8 items-center justify-center rounded-lg',
                          platform.enabled ? 'bg-accent/15 text-accent' : 'bg-bg-tertiary text-text-muted'
                        )}
                      >
                        <Network className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{platform.name || '未命名'}</p>
                        <p className="text-xs text-text-muted">
                          {platform.type} · {platform.models.length} 模型
                        </p>
                      </div>
                    </div>
                    <Badge variant={activeKeys > 0 ? 'success' : 'danger'}>
                      {activeKeys}/{platform.keys.length} Key
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 模型列表 */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-text-primary">可用模型</h2>
            <Badge variant="accent">{modelList.length}</Badge>
          </div>
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模型名或平台..."
              className="w-full rounded-lg border border-border bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
            />
          </div>
        </div>

        {modelList.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Box className="h-8 w-8" />}
              title="暂无可用模型"
              description="请先在上游平台页面获取模型列表，或检查平台是否已启用"
              action={
                <Button onClick={() => navigate('/platforms')}>
                  <Network className="h-4 w-4" />
                  配置平台
                </Button>
              }
            />
          </Card>
        ) : filteredModels.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="未找到匹配的模型"
              description={`没有与 "${searchQuery}" 匹配的模型或平台`}
            />
          </Card>
        ) : (
          <div className="card overflow-hidden">
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-bg-secondary">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">模型名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">所属平台</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">格式</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredModels.map((item, idx) => (
                    <tr
                      key={`${item.platformId}-${item.model}-${idx}`}
                      className="group transition-colors hover:bg-bg-tertiary"
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-sm text-text-primary">{item.model}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-sm text-text-secondary">{item.platformName}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={item.platformType === 'anthropic' ? 'success' : 'accent'}>
                          {item.platformType}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleCopyModel(item.model)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-hover hover:text-accent opacity-0 group-hover:opacity-100"
                          title="复制模型名称"
                        >
                          {copiedModel === item.model ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-success" />
                              <span className="text-success">已复制</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>复制</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {searchQuery && (
              <div className="border-t border-border bg-bg-tertiary px-4 py-2 text-xs text-text-muted">
                匹配 {filteredModels.length} / {modelList.length} 个模型
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
