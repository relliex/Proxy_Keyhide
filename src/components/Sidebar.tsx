import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Server, Network, ScrollText, Settings, Shield } from 'lucide-react'
import { useAppStore } from '../stores/app'
import clsx from 'clsx'

const navItems = [
  { path: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { path: '/platforms', label: '上游平台', icon: Network },
  { path: '/proxy', label: '代理服务', icon: Server },
  { path: '/logs', label: '请求日志', icon: ScrollText },
  { path: '/settings', label: '设置', icon: Settings }
]

export function Sidebar() {
  const proxyRunning = useAppStore((s) => s.proxyRunning)
  const data = useAppStore((s) => s.data)

  const platformCount = data?.platforms.length || 0
  const activeKeyCount = data?.platforms.reduce(
    (sum, p) => sum + p.keys.filter((k) => k.status === 'active').length,
    0
  ) || 0

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-bg-secondary">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-purple-600 glow">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-text-primary">Keyhide</h1>
          <p className="text-xs text-text-muted">AI中转服务</p>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* 底部状态 */}
      <div className="border-t border-border p-4">
        <div className="space-y-2 rounded-lg bg-bg-tertiary p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">服务状态</span>
            <div className="flex items-center gap-1.5">
              <span className={clsx('status-dot', proxyRunning ? 'active' : 'inactive')} />
              <span className="text-xs font-medium text-text-secondary">
                {proxyRunning ? '运行中' : '已停止'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">平台数</span>
            <span className="text-xs font-medium text-text-secondary">{platformCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">活跃Key</span>
            <span className="text-xs font-medium text-text-secondary">{activeKeyCount}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
