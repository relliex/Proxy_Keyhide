import { useAppStore } from '../stores/app'
import clsx from 'clsx'

export function TitleBar() {
  const proxyRunning = useAppStore((s) => s.proxyRunning)
  const data = useAppStore((s) => s.data)

  const port = data?.proxy.port || 7860

  return (
    <div className="titlebar-drag flex h-10 items-center justify-between border-b border-border bg-bg-secondary px-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Keyhide</span>
        <span className="text-xs text-text-muted">·</span>
        <span className="text-xs text-text-muted">Keyhide v1.0.0</span>
      </div>

      <div className="titlebar-no-drag flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-full bg-bg-tertiary px-3 py-1">
          <span className={clsx('status-dot', proxyRunning ? 'active' : 'inactive')} />
          <span className="text-xs text-text-secondary">
            {proxyRunning ? `127.0.0.1:${port}` : '服务未启动'}
          </span>
        </div>
      </div>
    </div>
  )
}
