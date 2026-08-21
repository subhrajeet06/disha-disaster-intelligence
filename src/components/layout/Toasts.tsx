import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { Toast } from '../../types'

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warn: AlertTriangle,
  neutral: Info,
}

const COLORS = {
  success: 'text-[#13735f]',
  info: 'text-[#2e7d9e]',
  warn: 'text-[#d9822b]',
  neutral: 'text-[#5c6b66]',
}

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts)
  const dismiss = useAppStore((s) => s.dismissToast)

  return (
    <div className="fixed bottom-24 lg:bottom-6 right-4 left-4 lg:left-auto lg:w-[380px] z-[70] space-y-2.5 pointer-events-none">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastRow({ toast, onDismiss, duration = 2000 }: { toast: Toast; onDismiss: () => void; duration?: number }) {
  const Icon = ICONS[toast.tone]
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [exiting, setExitting] = useState(false)
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const startTimer = useCallback(() => {
    clearTimeout(timerRef.current!)
    timerRef.current = setTimeout(() => {
      if (reducedMotion) {
        onDismiss()
        return
      }
      setExitting(true)
      setTimeout(onDismiss, 300)
    }, duration)
  }, [duration, reducedMotion, onDismiss])

  useEffect(() => {
    startTimer()
    return () => clearTimeout(timerRef.current!)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={[
        'pointer-events-auto flex items-start gap-3 rounded-[24px] bg-panel shadow-xl border border-edge px-4 py-3.5',
        'animate-toast-in',
        exiting ? 'animate-toast-out' : '',
      ].join(' ')}
      style={{ animation: 'toast-in 220ms ease-in-out' }}
      onMouseEnter={() => clearTimeout(timerRef.current!)}
      onMouseLeave={startTimer}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${COLORS[toast.tone]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-ink leading-snug">{toast.title}</p>
        {toast.detail && <p className="text-xs text-ink-soft mt-0.5">{toast.detail}</p>}
      </div>
      <button onClick={onDismiss} className="text-ink-faint hover:text-ink transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
