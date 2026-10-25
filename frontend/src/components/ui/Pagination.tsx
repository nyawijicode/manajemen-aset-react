import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatNumber } from '../../lib/format'
import type { PaginationMeta } from '../../types/api'

function pageNumbers(current: number, last: number): Array<number | 'gap'> {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1)

  const pages = new Set<number>([1, last, current - 1, current, current + 1])
  const filtered = [...pages].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b)
  const result: Array<number | 'gap'> = []

  filtered.forEach((page, index) => {
    if (index > 0 && page - filtered[index - 1] > 1) result.push('gap')
    result.push(page)
  })

  return result
}

export function Pagination({
  meta,
  onChange,
  itemLabel = 'data',
}: {
  meta: PaginationMeta
  onChange: (page: number) => void
  itemLabel?: string
}) {
  if (meta.total === 0) return null

  const pages = pageNumbers(meta.current_page, meta.last_page)

  return (
    <nav
      aria-label="Navigasi halaman"
      className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-slate-500">
        Menampilkan {formatNumber(meta.from)}–{formatNumber(meta.to)} dari{' '}
        <span className="font-semibold text-slate-700">{formatNumber(meta.total)}</span> {itemLabel}
      </p>

      {meta.last_page > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(meta.current_page - 1)}
            disabled={meta.current_page <= 1}
            className={cn(
              'inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40',
            )}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>

          <div className="hidden items-center gap-1 sm:flex">
            {pages.map((page, index) =>
              page === 'gap' ? (
                <span key={`gap-${index}`} className="px-1 text-xs text-slate-400" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={page}
                  type="button"
                  onClick={() => onChange(page)}
                  aria-current={page === meta.current_page ? 'page' : undefined}
                  aria-label={`Halaman ${page}`}
                  className={cn(
                    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold',
                    page === meta.current_page
                      ? 'bg-primary-700 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {page}
                </button>
              ),
            )}
          </div>

          <span className="px-1 text-xs text-slate-600 sm:hidden">
            {meta.current_page} / {meta.last_page}
          </span>

          <button
            type="button"
            onClick={() => onChange(meta.current_page + 1)}
            disabled={meta.current_page >= meta.last_page}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
            aria-label="Halaman berikutnya"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </nav>
  )
}
