import { useState } from 'react'
import { useAppStore } from '../stores/app'
import { Card, Button, Input, Select, Toggle, Badge, Modal, EmptyState, CopyButton } from '../components/ui'
import {
  Network,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Zap,
  Key as KeyIcon,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import type { UpstreamPlatform, UpstreamKey, PlatformType, LoadBalanceStrategy } from '../../electron/shared/types'
import clsx from 'clsx'

export function Platforms() {
  const data = useAppStore((s) => s.data)
  const savePlatform = useAppStore((s) => s.savePlatform)
  const deletePlatform = useAppStore((s) => s.deletePlatform)
  const showToast = useAppStore((s) => s.showToast)

  const [editingPlatform, setEditingPlatform] = useState<UpstreamPlatform | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!data) return null

  const handleAdd = async () => {
    const newPlatform = await window.extraApi.createPlatform()
    setEditingPlatform(newPlatform)
  }

  const handleSave = async () => {
    if (!editingPlatform) return
    if (!editingPlatform.name.trim()) {
      showToast({ type: 'error', message: '请输入平台名称' })
      return
    }
    await savePlatform(editingPlatform)
    setEditingPlatform(null)
    showToast({ type: 'success', message: '平台保存成功' })
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`确定要删除平台 "${name}" 吗？`)) {
      await deletePlatform(id)
      showToast({ type: 'success', message: '平台已删除' })
    }
  }

  const handleFetchModels = async (platformId: string) => {
    showToast({ type: 'info', message: '正在获取模型列表...' })
    try {
      const models = await window.api.fetchModels(platformId)
      showToast({ type: 'success', message: `成功获取 ${models.length} 个模型` })
      await useAppStore.getState().loadData()
    } catch (err: any) {
      showToast({ type: 'error', message: `获取失败: ${err.message}` })
    }
  }

  const handleTestConnection = async (platformId: string) => {
    showToast({ type: 'info', message: '正在测试连接...' })
    const result = await window.api.testConnection(platformId)
    showToast({ type: result.success ? 'success' : 'error', message: result.message })
    if (result.success) {
      await useAppStore.getState().loadData()
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      {/* 标题 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">上游平台</h1>
          <p className="mt-1 text-sm text-text-muted">管理 AI 平台配置与 API Key</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          添加平台
        </Button>
      </div>

      {/* 平台列表 */}
      {data.platforms.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Network className="h-8 w-8" />}
            title="暂无上游平台"
            description="添加你的第一个 AI 平台（OpenAI、Anthropic 或自定义），配置 API Key 后即可通过代理服务访问"
            action={
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4" />
                添加第一个平台
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {data.platforms.map((platform) => {
            const activeKeys = platform.keys.filter((k) => k.status === 'active').length
            const isExpanded = expandedId === platform.id
            return (
              <div key={platform.id} className="card overflow-hidden">
                {/* 平台头部 */}
                <div
                  className="flex items-center justify-between p-5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : platform.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        platform.enabled ? 'bg-accent/15 text-accent' : 'bg-bg-tertiary text-text-muted'
                      )}
                    >
                      <Network className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-text-primary">
                          {platform.name || '未命名平台'}
                        </h3>
                        <Badge variant={platform.type === 'openai' ? 'accent' : 'success'}>
                          {platform.type}
                        </Badge>
                        {!platform.enabled && <Badge variant="danger">已禁用</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted font-mono">{platform.baseUrl}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge variant={activeKeys > 0 ? 'success' : 'danger'}>
                          {activeKeys}/{platform.keys.length} Key
                        </Badge>
                        <Badge variant="default">{platform.models.length} 模型</Badge>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-text-muted" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-text-muted" />
                    )}
                  </div>
                </div>

                {/* 展开内容 */}
                {isExpanded && (
                  <div className="border-t border-border p-5 slide-up">
                    {/* 操作按钮 */}
                    <div className="mb-4 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditingPlatform(platform)}>
                        <Edit2 className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleFetchModels(platform.id)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        获取模型
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleTestConnection(platform.id)}>
                        <Zap className="h-3.5 w-3.5" />
                        测试连接
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => savePlatform({ ...platform, enabled: !platform.enabled })}
                      >
                        {platform.enabled ? '禁用' : '启用'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(platform.id, platform.name)}
                        className="text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </div>

                    {/* Key 列表 */}
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase text-text-muted">API Keys</h4>
                        {platform.keys.length > 0 && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updatedKeys = platform.keys.map((k) => ({ ...k, status: 'active' as const }))
                                savePlatform({ ...platform, keys: updatedKeys })
                                showToast({ type: 'success', message: `已启用全部 ${platform.keys.length} 个 Key` })
                              }}
                              className="text-success hover:bg-success/10"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              全部启用
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updatedKeys = platform.keys.map((k) => ({ ...k, status: 'disabled' as const }))
                                savePlatform({ ...platform, keys: updatedKeys })
                                showToast({ type: 'info', message: `已禁用全部 ${platform.keys.length} 个 Key` })
                              }}
                              className="text-danger hover:bg-danger/10"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              全部禁用
                            </Button>
                          </div>
                        )}
                      </div>
                      {platform.keys.length === 0 ? (
                        <p className="text-sm text-text-muted py-2">暂无 API Key，点击编辑添加</p>
                      ) : (
                        <div className="space-y-2">
                          {platform.keys.map((key) => (
                            <KeyRow key={key.id} platformId={platform.id} keyData={key} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 模型列表 */}
                    {platform.models.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase text-text-muted">
                          支持的模型 ({platform.models.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {platform.models.map((model) => (
                            <span
                              key={model}
                              className="rounded-md bg-bg-tertiary px-2 py-1 text-xs font-mono text-text-secondary"
                            >
                              {model}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 编辑模态框 */}
      {editingPlatform && (
        <PlatformEditor
          platform={editingPlatform}
          onChange={setEditingPlatform}
          onSave={handleSave}
          onClose={() => setEditingPlatform(null)}
        />
      )}
    </div>
  )
}

// ============ Key 行组件 ============
function KeyRow({ platformId, keyData }: { platformId: string; keyData: UpstreamKey }) {
  const [showKey, setShowKey] = useState(false)
  const savePlatform = useAppStore((s) => s.savePlatform)
  const data = useAppStore((s) => s.data)

  const handleToggleStatus = async () => {
    if (!data) return
    const platform = data.platforms.find((p) => p.id === platformId)
    if (!platform) return
    const updatedKeys = platform.keys.map((k) =>
      k.id === keyData.id
        ? { ...k, status: k.status === 'disabled' ? 'active' as const : 'disabled' as const }
        : k
    )
    await savePlatform({ ...platform, keys: updatedKeys })
  }

  const handleDelete = async () => {
    if (!data) return
    const platform = data.platforms.find((p) => p.id === platformId)
    if (!platform) return
    if (confirm(`确定要删除 Key "${keyData.label}" 吗？`)) {
      const updatedKeys = platform.keys.filter((k) => k.id !== keyData.id)
      await savePlatform({ ...platform, keys: updatedKeys })
    }
  }

  const statusConfig = {
    active: { variant: 'success' as const, icon: CheckCircle2, label: '正常' },
    exhausted: { variant: 'warning' as const, icon: AlertTriangle, label: '额度耗尽' },
    error: { variant: 'danger' as const, icon: XCircle, label: '错误' },
    disabled: { variant: 'default' as const, icon: XCircle, label: '已禁用' }
  }
  const status = statusConfig[keyData.status]
  const StatusIcon = status.icon

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-2.5">
      <div className="flex items-center gap-3">
        <KeyIcon className="h-4 w-4 text-text-muted" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{keyData.label}</span>
            <Badge variant={status.variant}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
          </div>
          <code className="text-xs font-mono text-text-muted">
            {showKey ? keyData.key : `${keyData.key.slice(0, 8)}••••••••••••`}
          </code>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">{keyData.requestCount} 次</span>
        <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}>
          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <CopyButton text={keyData.key} label="" />
        <Button variant="ghost" size="sm" onClick={handleToggleStatus}>
          {keyData.status === 'disabled' ? '启用' : '禁用'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-danger hover:bg-danger/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ============ 平台编辑器 ============
interface PlatformEditorProps {
  platform: UpstreamPlatform
  onChange: (platform: UpstreamPlatform) => void
  onSave: () => void
  onClose: () => void
}

function PlatformEditor({ platform, onChange, onSave, onClose }: PlatformEditorProps) {
  const [newKeyValue, setNewKeyValue] = useState('')
  const [newKeyLabel, setNewKeyLabel] = useState('')

  const handleAddKey = async () => {
    if (!newKeyValue.trim()) return
    const newKey = await window.extraApi.createKey(newKeyValue.trim(), newKeyLabel.trim() || `Key-${platform.keys.length + 1}`)
    onChange({ ...platform, keys: [...platform.keys, newKey] })
    setNewKeyValue('')
    setNewKeyLabel('')
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="编辑平台"
      width="640px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={onSave}>保存</Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* 基本信息 */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="平台名称"
            value={platform.name}
            onChange={(e) => onChange({ ...platform, name: e.target.value })}
            placeholder="例如：OpenAI 官方"
          />
          <Select
            label="平台类型"
            value={platform.type}
            onChange={(value) => onChange({ ...platform, type: value as PlatformType })}
            options={[
              { value: 'openai', label: 'OpenAI 格式' },
              { value: 'anthropic', label: 'Anthropic 格式' },
              { value: 'custom', label: '自定义' }
            ]}
          />
        </div>

        <Input
          label="Base URL"
          value={platform.baseUrl}
          onChange={(e) => onChange({ ...platform, baseUrl: e.target.value })}
          placeholder="https://api.openai.com"
          hint="上游 API 的基础地址，不需要包含 /v1 路径"
        />

        <Select
          label="负载均衡策略"
          value={platform.strategy}
          onChange={(value) => onChange({ ...platform, strategy: value as LoadBalanceStrategy })}
          options={[
            { value: 'round-robin', label: '轮询 (Round Robin)' },
            { value: 'priority', label: '优先级 (Priority)' },
            { value: 'weighted', label: '加权 (Weighted)' },
            { value: 'random', label: '随机 (Random)' }
          ]}
        />

        <div className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
          <div>
            <p className="text-sm font-medium text-text-primary">启用平台</p>
            <p className="text-xs text-text-muted">禁用后该平台不会被用于代理请求</p>
          </div>
          <Toggle
            checked={platform.enabled}
            onChange={(checked) => onChange({ ...platform, enabled: checked })}
          />
        </div>

        {/* API Key 管理 */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              API Keys ({platform.keys.length})
            </h3>
          </div>

          {/* 添加新 Key */}
          <div className="mb-3 space-y-2 rounded-lg border border-border bg-bg-tertiary p-3">
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Key 标签（可选）"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="API Key"
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                className="col-span-2 text-sm font-mono"
              />
            </div>
            <Button size="sm" onClick={handleAddKey} disabled={!newKeyValue.trim()}>
              <Plus className="h-3.5 w-3.5" />
              添加 Key
            </Button>
          </div>

          {/* 已有 Key 列表 */}
          {platform.keys.length > 0 && (
            <div className="space-y-2">
              {platform.keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <KeyIcon className="h-4 w-4 text-text-muted" />
                    <span className="text-sm text-text-primary">{key.label}</span>
                    <code className="text-xs font-mono text-text-muted">
                      {key.key.slice(0, 12)}••••
                    </code>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger/10"
                    onClick={() =>
                      onChange({
                        ...platform,
                        keys: platform.keys.filter((k) => k.id !== key.id)
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
