import { useQuery } from '@tanstack/react-query'
import { ChevronDown, LoaderCircle, Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { api, buildQuery, getErrorMessage } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useDebouncedValue } from '../../lib/hooks'
import { formatNumber } from '../../lib/format'
import type { Asset, Paginated } from '../../types/api'

interface AssetComboboxProps {
  selected: Asset | null
  onSelect: (asset: Asset | null) => void
  id?: string
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
  onlyActive?: boolean
}

export function AssetCombobox({
  selected,
  onSelect,
  id,
  disabled = false,
  invalid = false,
  placeholder = 'Cari kode atau nama aset…',
  onlyActive = true,
}: AssetComboboxProps) {
  const generatedId = useId()
  const inputId = id ?? `asset-picker-${generatedId}`
  const listId = `asset-listbox-${generatedId}`
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [highlight, setHighlight] = useState(0)
  const debouncedTerm = useDebouncedValue(term, 250)

  const query = useQuery({
    queryKey: ['asset-picker', debouncedTerm, onlyActive],
    queryFn: () =>
      api<Paginated<Asset>>(
        `/assets${buildQuery({
          q: debouncedTerm,
          per_page: 15,
          is_active: onlyActive ? true : undefined,
          sort: 'code',
          direction: 'asc',
        })}`,
      ),
    enabled: open,
    staleTime: 30_000,
  })

  const items = query.data?.data ?? []
  const activeIndex = items.length === 0 ? 0 : Math.min(highlight, items.length - 1)
  const inputValue = open ? term : selected ? `${selected.code} — ${selected.name}` : ''

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setTerm('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const choose = (asset: Asset) => {
    onSelect(asset)
    setOpen(false)
    setTerm('')
    inputRef.current?.focus()
  }

  const clear = () => {
    onSelect(null)
    setTerm('')
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && items[activeIndex] ? `${listId}-option-${items[activeIndex].id}` : undefined
          }
          aria-invalid={invalid || undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          value={inputValue}
          onFocus={() => {
            if (disabled) return
            setOpen(true)
            setTerm('')
            setHighlight(0)
          }}
          onChange={(event) => {
            setTerm(event.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              setTerm('')
              return
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setHighlight(Math.min(activeIndex + 1, Math.max(0, items.length - 1)))
              return
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHighlight((value) => Math.max(0, value - 1))
              return
            }

            if (event.key === 'Enter' && open && items[activeIndex]) {
              event.preventDefault()
              choose(items[activeIndex])
            }
          }}
          className={cn(
            'min-h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pr-16 pl-9 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500',
            invalid && 'border-red-600 focus:ring-red-600/20',
          )}
        />
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
          {selected && !disabled ? (
            <button
              type="button"
              onClick={clear}
              className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Kosongkan pilihan aset"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <ChevronDown className="pointer-events-none h-4 w-4 text-slate-400" aria-hidden="true" />
        </div>
      </div>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lift">
          <div id={listId} role="listbox" aria-label="Pilihan aset" className="max-h-72 overflow-y-auto py-1">
            {query.isLoading ? (
              <p className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Mencari aset…
              </p>
            ) : query.isError ? (
              <p className="px-4 py-3 text-sm text-red-700">{getErrorMessage(query.error)}</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">Tidak ada aset yang cocok.</p>
            ) : (
              items.map((asset, index) => (
                <button
                  key={asset.id}
                  id={`${listId}-option-${asset.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(asset)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left',
                    index === activeIndex ? 'bg-primary-50' : 'hover:bg-slate-50',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {asset.name}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span className="font-mono">{asset.code}</span>
                      <span aria-hidden="true">•</span>
                      <span>Stok {formatNumber(asset.stock)} {asset.unit}</span>
                      {asset.has_serial_number ? (
                        <>
                          <span aria-hidden="true">•</span>
                          <span>Ber-serial</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  {asset.is_critical ? (
                    <span className="mt-0.5 shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset">
                      Kritis
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
