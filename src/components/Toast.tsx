import { useAppStore } from '../stores/app'
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react'
import clsx from 'clsx'

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info
}

const colors = {
  success: 'text-success border-success/30 bg-success/10',
  error: 'text-danger border-danger/30 bg-danger/10',
  warning: 'text-warning border-warning/30 bg-warning/10',
  info: 'text-accent border-accent/30 bg-accent/10'
}

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts)
  const removeToast = useAppStore((s) => s.removeToast)

  return (
    <div className="fixed bottom-6 right-6 z-[100] space-y-2">
      {toasts.map((toast, index) => {
        const Icon = icons[toast.type]
        return (
          <div
            key={index}
            className={clsx(
              'toast-enter flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm',
              'min-w-[280px] max-w-[400px]',
              colors[toast.type]
            )}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 text-sm text-text-primary">{toast.message}</span>
            <button
              onClick={() => removeToast(index)}
              className="text-text-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
