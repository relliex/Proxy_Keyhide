import { useState } from 'react'
import { useAppStore } from '../stores/app'
import { Card, Button, Input, Toggle, Badge, CopyButton } from '../components/ui'
import { Server, Play, Square, RefreshCw, Eye, EyeOff, Link as LinkIcon, Key, Info } from 'lucide-react'
import clsx from 'clsx'

export function ProxyPage() {
  const data = useAppStore((s) => s.data)
  const proxyRunning = useAppStore((s) => s.proxyRunning)
  const startProxy = useAppStore((s) => s.startProxy)
  const stopProxy = useAppStore((s) => s.stopProxy)
  const saveProxyConfig = useAppStore((s) => s.saveProxyConfig)

  const [showKey, setShowKey] = useState(false)
  const [port, setPort] = useState(data?.proxy.port || 7860)
  const [host, setHost] = useState(data?.proxy.host || '127.0.0.1')

  if (!data) return null

  const maskedUrl = `http://${data.proxy.host}:${data.proxy.port}`
  const openaiUrl = `${maskedUrl}/v1`
  const anthropicUrl = `${maskedUrl}/v1`

  const handleSavePort = async () => {
    await saveProxyConfig({ port, host })
  }

  const handleRegenerateKey = async () => {
    const newProxy = await window.extraApi.regenerateMaskedKey()
    // 更新 store 中的数据，使 UI 实时刷新
    await useAppStore.getState().loadData()
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      {/* 标题 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">代理服务</h1>
          <p className="mt-1 text-sm text-text-muted">伪装 URL 与 API Key 配置，用于对接你的开发项目</p>
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
        </div>
      </div>

      {/* 服务状态 */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <div
            className={clsx(
              'flex h-12 w-12 items-center justify-center rounded-xl',
              proxyRunning ? 'bg-success/15 text-success' : 'bg-bg-tertiary text-text-muted'
            )}
          >
            <Server className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text-primary">服务状态</h2>
              <Badge variant={proxyRunning ? 'success' : 'default'}>
                {proxyRunning ? '运行中' : '已停止'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {proxyRunning
                ? `代理服务正在监听 ${maskedUrl}`
                : '服务未启动，请点击上方按钮启动'}
            </p>
          </div>
        </div>
      </Card>

      {/* 伪装 API Key */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-text-primary">伪装 API Key</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showKey ? '隐藏' : '显示'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRegenerateKey}>
              <RefreshCw className="h-4 w-4" />
              重新生成
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-bg-tertiary p-4">
          <code className="block break-all font-mono text-sm text-text-primary">
            {showKey ? data.proxy.maskedApiKey : 'sk-keyhide-••••••••••••••••••••••••••••••••'}
          </code>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <CopyButton text={data.proxy.maskedApiKey} label="复制 Key" />
          <p className="text-xs text-text-muted">
            在你的项目中使用此 Key 替代原始 API Key
          </p>
        </div>
      </Card>

      {/* 接入地址 */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <LinkIcon className="h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold text-text-primary">接入地址</h2>
        </div>

        <div className="space-y-4">
          {/* OpenAI 格式 */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="accent">OpenAI 格式</Badge>
              <span className="text-xs text-text-muted">/v1/chat/completions, /v1/models, /v1/embeddings</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-tertiary p-3">
              <code className="flex-1 break-all font-mono text-sm text-text-primary">{openaiUrl}</code>
              <CopyButton text={openaiUrl} />
            </div>
          </div>

          {/* Anthropic 格式 */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="success">Anthropic 格式</Badge>
              <span className="text-xs text-text-muted">/v1/messages, /v1/complete</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-tertiary p-3">
              <code className="flex-1 break-all font-mono text-sm text-text-primary">{anthropicUrl}</code>
              <CopyButton text={anthropicUrl} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-accent/5 p-3">
          <Info className="h-4 w-4 flex-shrink-0 text-accent mt-0.5" />
          <div className="text-xs text-text-secondary">
            <p className="font-medium text-text-primary">使用示例</p>
            <pre className="mt-1 font-mono text-text-muted">{`# OpenAI Python SDK
from openai import OpenAI
client = OpenAI(
    base_url="${openaiUrl}",
    api_key="${showKey ? data.proxy.maskedApiKey : '你的伪装API Key'}"
)

# Anthropic Python SDK
from anthropic import Anthropic
client = Anthropic(
    base_url="${anthropicUrl}",
    api_key="${showKey ? data.proxy.maskedApiKey : '你的伪装API Key'}"
)`}</pre>
          </div>
        </div>
      </Card>

      {/* 服务配置 */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-text-primary">服务配置</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="监听端口"
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            hint="默认 7860，修改后需重启服务"
          />
          <Input
            label="监听地址"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            hint="127.0.0.1 仅本机访问，0.0.0.0 允许局域网"
          />
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">允许跨域 (CORS)</p>
              <p className="text-xs text-text-muted">允许浏览器端直接调用代理服务</p>
            </div>
            <Toggle
              checked={data.proxy.cors}
              onChange={(checked) => saveProxyConfig({ cors: checked })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">记录请求日志</p>
              <p className="text-xs text-text-muted">记录所有经过代理的请求用于审计</p>
            </div>
            <Toggle
              checked={data.proxy.logRequests}
              onChange={(checked) => saveProxyConfig({ logRequests: checked })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">请求超时</p>
              <p className="text-xs text-text-muted">上游请求的超时时间（秒）</p>
            </div>
            <Input
              type="number"
              value={Math.floor(data.proxy.timeout / 1000)}
              onChange={(e) => saveProxyConfig({ timeout: Number(e.target.value) * 1000 })}
              className="w-24"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSavePort}>
            保存配置
          </Button>
        </div>
      </Card>
    </div>
  )
}
