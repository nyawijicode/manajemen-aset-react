import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button, buttonStyles } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { FilterBar, SearchField } from '../components/ui/Filters'
import { Input, Select } from '../components/ui/Form'
import { PageHeader } from '../components/ui/PageHeader'
import { Pagination } from '../components/ui/Pagination'
import { TBody, TD, TH, THead, TR, Table, TableEmpty, TableScrollHint } from '../components/ui/Table'
import { api, buildQuery, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDate, formatDateTime, formatNumber, todayIso } from '../lib/format'
import { useDebouncedValue, useDocumentTitle } from '../lib/hooks'
import type { Paginated, StockOpname } from '../types/api'

export function StockOpnamesPage() {
  useDocumentTitle('Stock Opname')
  const { has } = useAuth()
  const [searchParams] = useSearchParams()
  const canManage = has('opname.manage')

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 350)
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const opnames = useQuery({
    queryKey: ['stock-opnames', debouncedQuery, status, dateFrom, dateTo, page],
    queryFn: () =>
      api<Paginated<StockOpname>>(
        `/stock-opnames${buildQuery({
          q: debouncedQuery,
          status,
          date_from: dateFrom,
          date_to: dateTo,
          page,
          per_page: 15,
        })}`,
      ),
  })

  const resetFilters = () => {
    setQuery('')
    setStatus('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const meta = opnames.data?.meta
  const rows = opnames.data?.data ?? []

  return (
    <>
      <PageHeader
        title="Stock Opname"
        description="Sesi penghitungan fisik aset. Hasil opname menjadi dasar koreksi melalui transaksi, bukan perubahan saldo langsung."
        actions={
          canManage ? (
            <Link to="/stock-opname/baru" className={buttonStyles('primary', 'md')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Buat sesi opname
            </Link>
          ) : null
        }
      />

      <div className="no-print mb-4">
        <FilterBar>
          <div className="sm:col-span-2">
            <label htmlFor="opname-search" className="mb-1 block text-xs font-semibold text-slate-600">
              Pencarian
            </label>
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Cari referensi atau keterangan…"
              label="Cari sesi stock opname"
            />
          </div>

          <div>
            <label htmlFor="opname-status" className="mb-1 block text-xs font-semibold text-slate-600">
              Status
            </label>
            <Select
              id="opname-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">Semua status</option>
              <option value="draft">Draf</option>
              <option value="finalized">Disahkan</option>
            </Select>
          </div>

          <div>
            <label htmlFor="opname-from" className="mb-1 block text-xs font-semibold text-slate-600">
              Dari tanggal
            </label>
            <Input
              id="opname-from"
              type="date"
              value={dateFrom}
              max={dateTo || todayIso()}
              onChange={(event) => {
                setDateFrom(event.target.value)
                setPage(1)
              }}
            />
          </div>

          <div>
            <label htmlFor="opname-to" className="mb-1 block text-xs font-semibold text-slate-600">
              Sampai tanggal
            </label>
            <Input
              id="opname-to"
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayIso()}
              onChange={(event) => {
                setDateTo(event.target.value)
                setPage(1)
              }}
            />
          </div>

          <div className="flex items-end">
            <Button variant="secondary" className="w-full" onClick={resetFilters}>
              Reset filter
            </Button>
          </div>
        </FilterBar>
      </div>

      <Card>
        {opnames.isError ? (
          <ErrorState
            title="Sesi opname belum dapat dimuat"
            description={getErrorMessage(opnames.error)}
            onRetry={() => void opnames.refetch()}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-600" aria-live="polite">
                {opnames.isLoading
                  ? 'Memuat sesi opname…'
                  : `${formatNumber(meta?.total ?? 0)} sesi sesuai filter`}
              </p>
              {opnames.isFetching && !opnames.isLoading ? (
                <span className="text-xs text-slate-400">Memperbarui…</span>
              ) : null}
            </div>

            <Table caption="Daftar sesi stock opname" minWidth="min-w-[900px]">
              <THead>
                <TR>
                  <TH>Referensi</TH>
                  <TH>Tanggal</TH>
                  <TH>Keterangan</TH>
                  <TH className="text-right">Baris aset</TH>
                  <TH>Status</TH>
                  <TH>Disahkan oleh</TH>
                  <TH className="text-right">Tindakan</TH>
                </TR>
              </THead>
              <TBody>
                {opnames.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TR key={`skeleton-${index}`}>
                      <TD colSpan={7}>
                        <span className="block h-5 animate-pulse rounded bg-slate-100" />
                      </TD>
                    </TR>
                  ))
                ) : rows.length === 0 ? (
                  <TableEmpty colSpan={7}>
                    <EmptyState
                      icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
                      title="Belum ada sesi opname"
                      description={
                        query || status !== 'all' || dateFrom || dateTo
                          ? 'Tidak ada sesi yang cocok dengan filter. Ubah kriteria pencarian.'
                          : 'Buat sesi opname untuk membandingkan stok sistem dengan hasil hitung fisik.'
                      }
                      action={
                        canManage && !query && status === 'all' && !dateFrom && !dateTo ? (
                          <Link to="/stock-opname/baru" className={buttonStyles('primary', 'md')}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Buat sesi opname
                          </Link>
                        ) : undefined
                      }
                    />
                  </TableEmpty>
                ) : (
                  rows.map((opname) => (
                    <TR key={opname.id}>
                      <TD>
                        <Link
                          to={`/stock-opname/${opname.id}`}
                          className="rounded font-mono text-xs font-semibold text-primary-800 hover:underline"
                        >
                          {opname.reference}
                        </Link>
                        <span className="mt-1 block text-xs text-slate-500">{opname.creator?.name ?? '—'}</span>
                      </TD>
                      <TD className="whitespace-nowrap">{formatDate(opname.opname_date)}</TD>
                      <TD className="max-w-[260px]">
                        <span className="block truncate">{opname.description ?? 'Tanpa keterangan'}</span>
                        <span className="block text-xs text-slate-500">
                          Dibuat {formatDateTime(opname.created_at)}
                        </span>
                      </TD>
                      <TD className="text-right tabular-nums">{formatNumber(opname.items_count ?? 0)}</TD>
                      <TD>
                        <Badge tone={opname.status === 'finalized' ? 'success' : 'warning'} dot>
                          {opname.status_label}
                        </Badge>
                      </TD>
                      <TD className="text-sm text-slate-600">{opname.approver?.name ?? '—'}</TD>
                      <TD>
                        <div className="flex justify-end">
                          <Link
                            to={`/stock-opname/${opname.id}`}
                            className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold text-primary-800 hover:bg-primary-50"
                          >
                            {opname.status === 'draft' ? 'Isi hasil' : 'Lihat hasil'}
                          </Link>
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
            <TableScrollHint />
            {meta ? <Pagination meta={meta} onChange={setPage} itemLabel="sesi" /> : null}
          </>
        )}
      </Card>
    </>
  )
}
