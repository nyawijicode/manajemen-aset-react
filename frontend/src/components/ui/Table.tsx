import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Table({
  children,
  caption,
  minWidth = 'min-w-[760px]',
  className,
}: {
  children: ReactNode
  caption: string
  minWidth?: string
  className?: string
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-left text-sm', minWidth, className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50/80">
      {children}
    </thead>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}

export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('transition-colors hover:bg-slate-50/70', className)}>{children}</tr>
}

export function TH({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-600 uppercase',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function TD({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 align-middle text-slate-700', className)} {...props}>
      {children}
    </td>
  )
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  )
}

export function TableScrollHint({ children }: { children?: ReactNode }) {
  return (
    <p className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 lg:hidden">
      {children ?? 'Geser tabel ke samping untuk melihat seluruh kolom.'}
    </p>
  )
}
