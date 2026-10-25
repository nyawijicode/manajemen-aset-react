import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  footer,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon: LucideIcon
  tone?: 'neutral' | 'primary' | 'warning' | 'success' | 'info'
  footer?: ReactNode
}) {
  const iconTone = {
    neutral: 'bg-slate-100 text-slate-600',
    primary: 'bg-primary-50 text-primary-700',
    warning: 'bg-amber-50 text-amber-700',
    success: 'bg-emerald-50 text-emerald-700',
    info: 'bg-sky-50 text-sky-700',
  }[tone]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconTone)}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  )
}
