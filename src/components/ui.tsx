import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'

// ============ Button ============
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'bg-bg-tertiary text-text-primary hover:bg-bg-hover border border-border',
    danger: 'bg-danger/90 text-white hover:bg-danger',
    ghost: 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm'
  }
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all',
        'focus:ring-2 focus:ring-accent/30 focus:ring-offset-0',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ============ Input ============
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-text-secondary">{label}</label>}
      <input
        className={clsx(
          'w-full rounded-lg border bg-bg-tertiary px-3 py-2 text-sm text-text-primary',
          'border-border focus:border-accent focus:ring-1 focus:ring-accent/30',
          'placeholder:text-text-muted transition-colors',
          error && 'border-danger',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  )
}

// ============ Select ============
interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}

export function Select({ label, value, onChange, options, className }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-text-secondary">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary',
          'focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors cursor-pointer',
          className
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-bg-tertiary">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ============ Toggle ============
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={clsx('toggle', checked && 'active')}
        onClick={() => onChange(!checked)}
      />
      {label && <span className="text-sm text-text-secondary">{label}</span>}
    </div>
  )
}

// ============ Card ============
interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div className={clsx('card p-5', hover && 'hover:border-border-hover cursor-pointer', className)}>
      {children}
    </div>
  )
}

// ============ Badge ============
interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'accent'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-bg-tertiary text-text-secondary border-border',
    success: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
    accent: 'bg-accent/10 text-accent border-accent/30'
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

// ============ Modal ============
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, footer, width = '600px' }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="slide-up w-full rounded-xl border border-border bg-bg-secondary shadow-2xl"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}

// ============ Empty State ============
interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-tertiary text-text-muted">
        {icon}
      </div>
      <h3 className="mb-1 text-base font-semibold text-text-primary">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-text-muted">{description}</p>
      {action}
    </div>
  )
}

// ============ Stat Card ============
interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  trend?: string
  color?: 'accent' | 'success' | 'warning' | 'danger'
}

export function StatCard({ label, value, icon, trend, color = 'accent' }: StatCardProps) {
  const colors = {
    accent: 'from-accent/20 to-accent/5 text-accent',
    success: 'from-success/20 to-success/5 text-success',
    warning: 'from-warning/20 to-warning/5 text-warning',
    danger: 'from-danger/20 to-danger/5 text-danger'
  }
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
          {trend && <p className="mt-1 text-xs text-text-muted">{trend}</p>}
        </div>
        <div className={clsx('flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br', colors[color])}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// ============ Copy Button ============
interface CopyButtonProps {
  text: string
  label?: string
}

export function CopyButton({ text, label = '复制' }: CopyButtonProps) {
  const handleCopy = async () => {
    await window.extraApi.clipboardWrite(text)
  }
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="font-mono">
      {label}
    </Button>
  )
}
