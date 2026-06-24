import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/app'
import { Card, Button, Badge, Select, EmptyState, Modal } from '../components/ui'
import { ScrollText, Search, Trash2, ChevronRight, Activity, Clock, Zap } from 'lucide-react'
import type { RequestLog } from '../../electron/shared/types'
import clsx from 'clsx'

export function Logs() {
  const data = useAppStore((s) => s.data)
  const clearLogs = useAppStore((s) => s.clearLogs)
  const showToast = useAppStore((s) => s.showToast)

  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterFormat, setFilterFormat] = useState('all')
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null)

  const filteredLogs = useMemo(() => {
    if (!data) return []
    return data.logs.filter((log) => {
      if (search && !log.model.toLowerCase().includes(search.toLowerCase()) && !log.path.includes(search)) return false
      if (filterPlatform !== 'all' && log.platformId !== filterPlatform) return false
      if (filterStatus === 'success' && !(log.statusCode >= 200 && log.statusCode < 300)) return false
      if (filterStatus === 'error' && log.statusCode < 400) return false
      if (filterFormat !== 'all' && log.format !== filterFormat) return false
      return true
    })
  }, [data, search, filterPlatform, filterStatus, filterFormat])

  if (!data) return null

  const handleClear = async () => {
    if (confirm('确定要清空所有日志吗？')) {
      await clearLogs()
      showToast({ type: 'success', message: '日志已清空' })
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      {/* 标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">请求日志</h1>
          <p className="mt-1 text-sm text-text-muted">所有经过代理的请求记录</p>
        </div>
        <Button variant="danger" onClick={handleClear} disabled={data.logs.length === 0}>
          <Trash2 className="h-4 w-4" />
          清空日志
        </Button>
      </div>

      {/* 统计 */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            <span className="text-xs text-text-muted">总请求</span>
          </div>
          <p className="mt-1 text-xl font-bold text-text-primary">{data.logs.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-success" />
            <span className="text-xs text-text-muted">成功</span>
          </div>
          <p className="mt-1 text-xl font-bold text-success">
            {data.logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length}
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-danger" />
            <span className="text-xs text-text-muted">失败</span>
          </div>
          <p className="mt-1 text-xl font-bold text-danger">
            {data.logs.filter((l) => l.statusCode >= 400).length}
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-xs text-text-muted">平均耗时</span>
          </div>
          <p className="mt-1 text-xl font-bold text-text-primary">
            {data.logs.length > 0
              ? Math.round(data.logs.reduce((sum, l) => sum + l.duration, 0) / data.logs.length)
              : 0}
            ms
          </p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="搜索模型或路径..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-tertiary py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent/30"
          />
        </div>
        <Select
          value={filterPlatform}
          onChange={setFilterPlatform}
          options={[
            { value: 'all', label: '全部平台' },
            ...data.platforms.map((p) => ({ value: p.id, label: p.name || '未命名' }))
          ]}
          className="w-40"
        />
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'success', label: '成功' },
            { value: 'error', label: '失败' }
          ]}
          className="w-32"
        />
        <Select
          value={filterFormat}
          onChange={setFilterFormat}
          options={[
            { value: 'all', label: '全部格式' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'anthropic', label: 'Anthropic' }
          ]}
          className="w-32"
        />
      </div>

      {/* 日志列表 */}
      {filteredLogs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ScrollText className="h-8 w-8" />}
            title={data.logs.length === 0 ? '暂无请求日志' : '无匹配结果'}
            description={
              data.logs.length === 0
                ? '启动代理服务后，所有经过代理的请求将自动记录在此'
                : '尝试调整筛选条件'
            }
          />
        </Card>
      ) : (
        <div className="card overflow-hidden">
          {/* 表头 */}
          <div className="grid grid-cols-12 gap-3 border-b border-border bg-bg-tertiary px-4 py-2.5 text-xs font-medium text-text-muted">
            <div className="col-span-1">状态</div>
            <div className="col-span-3">模型</div>
            <div className="col-span-2">平台</div>
            <div className="col-span-2">Key</div>
            <div className="col-span-1">格式</div>
            <div className="col-span-1">Token</div>
            <div className="col-span-1">耗时</div>
            <div className="col-span-1">时间</div>
          </div>

          {/* 日志行 */}
          <div className="max-h-[500px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="grid cursor-pointer grid-cols-12 gap-3 border-b border-border/50 px-4 py-2.5 text-sm transition-colors hover:bg-bg-tertiary"
              >
                <div className="col-span-1">
                  <span
                    className={clsx(
                      'status-dot',
                      log.statusCode >= 200 && log.statusCode < 300
                        ? 'active'
                        : 'error'
                    )}
                  />
                </div>
                <div className="col-span-3 truncate font-mono text-xs text-text-primary">
                  {log.model || log.path}
                </div>
                <div className="col-span-2 truncate text-xs text-text-secondary">
                  {log.platformName || '-'}
                </div>
                <div className="col-span-2 truncate text-xs text-text-muted">
                  {log.keyLabel || '-'}
                </div>
                <div className="col-span-1">
                  <Badge variant={log.format === 'openai' ? 'accent' : 'success'}>
                    {log.format === 'openai' ? 'OAI' : 'ANT'}
                  </Badge>
                </div>
                <div className="col-span-1 text-xs text-text-muted">
                  {log.promptTokens + log.completionTokens > 0
                    ? log.promptTokens + log.completionTokens
                    : '-'}
                </div>
                <div className="col-span-1 text-xs text-text-muted">{log.duration}ms</div>
                <div className="col-span-1 text-xs text-text-muted">
                  {formatTime(log.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日志详情 */}
      {selectedLog && (
        <Modal
          open={true}
          onClose={() => setSelectedLog(null)}
          title="请求详情"
          width="600px"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="状态码" value={String(selectedLog.statusCode)} />
              <DetailItem label="耗时" value={`${selectedLog.duration}ms`} />
              <DetailItem label="请求方法" value={selectedLog.method} />
              <DetailItem label="请求路径" value={selectedLog.path} />
              <DetailItem label="格式" value={selectedLog.format} />
              <DetailItem label="是否流式" value={selectedLog.stream ? '是' : '否'} />
              <DetailItem label="模型" value={selectedLog.model || '-'} />
              <DetailItem label="平台" value={selectedLog.platformName || '-'} />
              <DetailItem label="Key" value={selectedLog.keyLabel || '-'} />
              <DetailItem label="客户端IP" value={selectedLog.clientIp} />
              <DetailItem label="Prompt Tokens" value={String(selectedLog.promptTokens)} />
              <DetailItem label="Completion Tokens" value={String(selectedLog.completionTokens)} />
              <DetailItem
                label="时间"
                value={new Date(selectedLog.timestamp).toLocaleString('zh-CN')}
              />
            </div>
            {selectedLog.error && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                <p className="text-xs font-medium text-danger">错误信息</p>
                <p className="mt-1 text-sm text-text-secondary">{selectedLog.error}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-text-primary break-all">{value}</p>
    </div>
  )
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
