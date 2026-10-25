import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface DetailItem {
  label: string
  value: ReactNode
  wide?: boolean
}

export function DetailList({
  items,
  className,
  columns = 2,
}: {
  items: DetailItem[]
  className?: string
  columns?: 1 | 2 | 3
}) {
  const grid =
    columns === 1
      ? 'grid-cols-1'
      : columns === 3
        ? 'sm:grid-cols-3'
        : 'sm:grid-cols-2'

  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', grid, className)}>
      {items.map((item) => (
        <div key={item.label} className={cn('min-w-0', item.wide && 'sm:col-span-full')}>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{item.label}</dt>
          <dd className="mt-1 text-sm leading-6 break-words text-slate-900">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
