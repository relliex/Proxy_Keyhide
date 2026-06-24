import { useState } from 'react'
import { useAppStore } from '../stores/app'
import { Card, Button, Select, Toggle, Badge, Modal } from '../components/ui'
import { Settings as SettingsIcon, Download, Upload, Route, Shield, Zap, Info, Trash2, RotateCcw, AlertTriangle } from 'lucide-react'
import type { RouteMode } from '../../electron/shared/types'

export function Settings() {
  const data = useAppStore((s) => s.data)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const showToast = useAppStore((s) => s.showToast)
  const resetStats = useAppStore((s) => s.resetStats)
  const clearAllData = useAppStore((s) => s.clearAllData)

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [clearing, setClearing] = useState(false)

  if (!data) return null

  const handleExport = async () => {
    const configStr = await window.api.exportConfig()
    const result = await window.extraApi.saveFileDialog('keyhide-config.json', configStr)
    if (result.success) {
      showToast({ type: 'success', message: `配置已导出到: ${result.path}` })
    }
  }

  const handleImport = async () => {
    const result = await window.extraApi.openFileDialog()
    if (result.success && result.content) {
      const importResult = await window.api.importConfig(result.content)
      showToast({ type: importResult.success ? 'success' : 'error', message: importResult.message })
      if (importResult.success) {
        await useAppStore.getState().loadData()
      }
    }
  }

  const handleResetStats = async () => {
    setResetting(true)
    try {
      await resetStats()
      showToast({ type: 'success', message: '统计数据已重置，所有 Key 计数归零' })
    } finally {
      setResetting(false)
      setResetConfirmOpen(false)
    }
  }

  const handleClearAllData = async () => {
    setClearing(true)
    try {
      await clearAllData()
      showToast({ type: 'success', message: '所有数据已清除（保留伪装 API Key）' })
    } finally {
      setClearing(false)
      setClearConfirmOpen(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      {/* 标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">设置</h1>
        <p className="mt-1 text-sm text-text-muted">代理服务路由与全局配置</p>
      </div>

      {/* 路由配置 */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <Route className="h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold text-text-primary">路由配置</h2>
        </div>

        <div className="space-y-4">
          <Select
            label="路由模式"
            value={data.settings.routeMode}
            onChange={(value) => saveSettings({ routeMode: value as RouteMode })}
            options={[
              { value: 'auto', label: '自动（根据模型名自动匹配平台）' },
              { value: 'by-model', label: '按模型（严格根据模型名匹配）' },
              { value: 'by-path', label: '按路径（使用默认平台）' }
            ]}
          />

          {data.settings.routeMode !== 'by-path' && (
            <div className="rounded-lg bg-accent/5 p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 flex-shrink-0 text-accent mt-0.5" />
                <div className="text-xs text-text-secondary">
                  <p><strong>自动模式</strong>：优先使用默认平台，若不支持该模型则自动查找其他平台</p>
                  <p><strong>按模型</strong>：严格根据模型名查找支持该模型的平台</p>
                  <p><strong>按路径</strong>：所有请求都使用默认平台</p>
                  <p className="mt-1">你也可以在请求路径中指定平台：<code className="font-mono">/{`{platformId}`}/v1/chat/completions</code></p>
                </div>
              </div>
            </div>
          )}

          <Select
            label="默认平台"
            value={data.settings.defaultPlatformId || ''}
            onChange={(value) => saveSettings({ defaultPlatformId: value || null })}
            options={[
              { value: '', label: '无（自动选择）' },
              ...data.platforms.map((p) => ({ value: p.id, label: p.name || '未命名' }))
            ]}
          />
        </div>
      </Card>

      {/* 启动配置 */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold text-text-primary">启动配置</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">自动启动代理服务</p>
              <p className="text-xs text-text-muted">应用启动时自动开启代理服务</p>
            </div>
            <Toggle
              checked={data.settings.autoStartProxy}
              onChange={(checked) => saveSettings({ autoStartProxy: checked })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">最小化到托盘</p>
              <p className="text-xs text-text-muted">关闭窗口时最小化到系统托盘而非退出</p>
            </div>
            <Toggle
              checked={data.settings.minimizeToTray}
              onChange={(checked) => saveSettings({ minimizeToTray: checked })}
            />
          </div>
        </div>
      </Card>

      {/* 容错配置 */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold text-text-primary">容错配置</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">出错自动禁用 Key</p>
              <p className="text-xs text-text-muted">开启后，当 Key 请求超时或返回错误时立即禁用该 Key，避免后续请求继续报错</p>
            </div>
            <Toggle
              checked={data.settings.autoDisableKeyOnError}
              onChange={(checked) => saveSettings({ autoDisableKeyOnError: checked })}
            />
          </div>

          {data.settings.autoDisableKeyOnError && (
            <div className="rounded-lg bg-warning/5 p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 flex-shrink-0 text-warning mt-0.5" />
                <div className="text-xs text-text-secondary">
                  <p>开启后，以下情况会自动禁用 Key：</p>
                  <ul className="mt-1 list-inside list-disc">
                    <li>请求超时（上游无响应）</li>
                    <li>返回 5xx 服务端错误</li>
                    <li>返回 401/403 认证失败（始终禁用）</li>
                    <li>返回 429 额度耗尽（标记为耗尽）</li>
                  </ul>
                  <p className="mt-1">被禁用的 Key 可在「上游平台」页面手动重新启用。</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 配置管理 */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold text-text-primary">配置管理</h2>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-warning/5 p-3 mb-4">
          <Info className="h-4 w-4 flex-shrink-0 text-warning mt-0.5" />
          <div className="text-xs text-text-secondary">
            <p>导出的配置包含所有平台和 API Key 信息，请妥善保管。</p>
            <p>导入配置会覆盖当前的平台和代理设置（不影响日志）。</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出配置
          </Button>
          <Button variant="secondary" onClick={handleImport}>
            <Upload className="h-4 w-4" />
            导入配置
          </Button>
        </div>
      </Card>

      {/* 数据管理 */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-danger" />
          <h2 className="text-base font-semibold text-text-primary">数据管理</h2>
        </div>

        <div className="space-y-3">
          {/* 重置统计 */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">重置统计数据</p>
              <p className="text-xs text-text-muted">清除所有请求日志，并将所有 Key 的请求计数、Token 用量归零，同时恢复已禁用 Key 的状态</p>
            </div>
            <Button variant="secondary" onClick={() => setResetConfirmOpen(true)}>
              <RotateCcw className="h-4 w-4" />
              重置
            </Button>
          </div>

          {/* 清除所有数据 */}
          <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-danger">清除所有数据</p>
              <p className="text-xs text-text-muted">删除所有平台、Key、日志和设置，恢复到初始状态（仅保留伪装 API Key）</p>
            </div>
            <Button variant="danger" onClick={() => setClearConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" />
              清除
            </Button>
          </div>
        </div>
      </Card>

      {/* 关于 */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold text-text-primary">关于</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">应用名称</span>
            <span className="text-text-primary">Keyhide - AI中转代理</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">版本</span>
            <Badge variant="accent">v1.0.0</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">功能</span>
            <span className="text-text-secondary">多平台聚合 · Key轮询 · 故障转移 · 流式支持</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">支持格式</span>
            <div className="flex gap-1">
              <Badge variant="accent">OpenAI</Badge>
              <Badge variant="success">Anthropic</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* 重置统计确认弹窗 */}
      <Modal
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="确认重置统计数据"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetConfirmOpen(false)} disabled={resetting}>
              取消
            </Button>
            <Button variant="primary" onClick={handleResetStats} disabled={resetting}>
              <RotateCcw className="h-4 w-4" />
              {resetting ? '重置中...' : '确认重置'}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="text-sm text-text-secondary">
            <p className="mb-2">此操作将：</p>
            <ul className="list-inside list-disc space-y-1 text-text-muted">
              <li>清除所有请求日志记录</li>
              <li>将所有 Key 的请求次数和 Token 用量归零</li>
              <li>重置 Key 的错误计数和最后使用时间</li>
              <li>恢复已耗尽/错误状态 Key 为活跃状态</li>
            </ul>
            <p className="mt-3 text-warning">平台和 Key 配置不会被删除。</p>
          </div>
        </div>
      </Modal>

      {/* 清除所有数据确认弹窗 */}
      <Modal
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="确认清除所有数据"
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearConfirmOpen(false)} disabled={clearing}>
              取消
            </Button>
            <Button variant="danger" onClick={handleClearAllData} disabled={clearing}>
              <Trash2 className="h-4 w-4" />
              {clearing ? '清除中...' : '确认清除'}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="text-sm text-text-secondary">
            <p className="mb-2 font-medium text-danger">此操作不可撤销！</p>
            <p className="mb-2">将永久删除以下数据：</p>
            <ul className="list-inside list-disc space-y-1 text-text-muted">
              <li>所有上游平台配置</li>
              <li>所有 API Key</li>
              <li>所有请求日志和统计数据</li>
              <li>所有自定义设置</li>
            </ul>
            <p className="mt-3 text-accent">仅保留当前的伪装 API Key，无需重新生成。</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
