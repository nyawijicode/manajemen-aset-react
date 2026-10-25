import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, Plus, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AssetCombobox } from '../components/ui/AssetCombobox'
import { Badge } from '../components/ui/Badge'
import { Button, buttonStyles } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { FilterBar, SearchField } from '../components/ui/Filters'
import { Input } from '../components/ui/Form'
import { PageHeader } from '../components/ui/PageHeader'
import { Pagination } from '../components/ui/Pagination'
import { TBody, TD, TH, THead, TR, Table, TableEmpty, TableScrollHint } from '../components/ui/Table'
import { api, buildQuery, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDate, formatNumber, todayIso } from '../lib/format'
import { useDebouncedValue, useDocumentTitle } from '../lib/hooks'
import type { Asset, AssetIn, AssetOut, Paginated } from '../types/api'

type Kind = 'in' | 'out'
type Transaction = AssetIn | AssetOut

const COPY = {
  in: {
    title: 'Barang Masuk',
    description:
      'Catatan penerimaan aset dari pengadaan, supplier, atau sumber lain. Setiap transaksi menambah saldo stok secara terkendali.',
    addLabel: 'Catat barang masuk',
    party: 'Sumber / supplier',
    caption: 'Daftar transaksi barang masuk',
    emptyTitle: 'Belum ada barang masuk',
    emptyDescription: 'Transaksi penerimaan aset akan tampil di sini setelah dicatat.',
    path: 'masuk',
    icon: ArrowDownToLine,
  },
  out: {
    title: 'Barang Keluar',
    description:
      'Catatan pengeluaran aset untuk unit kerja atau penerima. Stok berkurang hanya melalui transaksi yang tercatat.',
    addLabel: 'Catat barang keluar',
    party: 'Penerima / unit tujuan',
    caption: 'Daftar transaksi barang keluar',
    emptyTitle: 'Belum ada barang keluar',
    emptyDescription: 'Transaksi pengeluaran aset akan tampil di sini setelah dicatat.',
    path: 'keluar',
    icon: ArrowUpFromLine,
  },
} as const

export function TransactionListPage({ kind }: { kind: Kind }) {
  const copy = COPY[kind]
  useDocumentTitle(copy.title)
  const { has } = useAuth()
  const [searchParams] = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const debouncedQuery = useDebouncedValue(query, 350)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const canCreate = has('transactions.create')
  const Icon = copy.icon

  const transactions = useQuery({
    queryKey: ['transactions', kind, debouncedQuery, asset?.id ?? null, dateFrom, dateTo, page],
    queryFn: () =>
      api<Paginated<Transaction>>(
        `/asset-${kind}s${buildQuery({
          q: debouncedQuery,
          asset_id: asset?.id,
          date_from: dateFrom,
          date_to: dateTo,
          page,
          per_page: 15,
        })}`,
      ),
  })

  const resetFilters = () => {
    setQuery('')
    setAsset(null)
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const meta = transactions.data?.meta
  const rows = transactions.data?.data ?? []

  const partyOf = (row: Transaction) =>
    kind === 'in' ? (row as AssetIn).supplier_or_source : (row as AssetOut).recipient

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          canCreate ? (
            <Link to={`/transaksi/${copy.path}/baru`} className={buttonStyles('primary', 'md')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {copy.addLabel}
            </Link>
          ) : null
        }
      />

      <div className="no-print mb-4">
        <FilterBar>
          <div className="sm:col-span-2">
            <label htmlFor={`tx-${kind}-search`} className="mb-1 block text-xs font-semibold text-slate-600">
              Pencarian
            </label>
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder={`Cari referensi atau ${kind === 'in' ? 'supplier' : 'penerima'}…`}
              label={`Cari transaksi barang ${kind === 'in' ? 'masuk' : 'keluar'}`}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor={`tx-${kind}-asset`} className="mb-1 block text-xs font-semibold text-slate-600">
              Aset
            </label>
            <AssetCombobox
              id={`tx-${kind}-asset`}
              selected={asset}
              onSelect={(value) => {
                setAsset(value)
                setPage(1)
              }}
              onlyActive={false}
              placeholder="Semua aset"
            />
          </div>

          <div>
            <label htmlFor={`tx-${kind}-from`} className="mb-1 block text-xs font-semibold text-slate-600">
              Dari tanggal
            </label>
            <Input
              id={`tx-${kind}-from`}
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
            <label htmlFor={`tx-${kind}-to`} className="mb-1 block text-xs font-semibold text-slate-600">
              Sampai tanggal
            </label>
            <Input
              id={`tx-${kind}-to`}
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

          <div className="flex items-end sm:col-span-2">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={resetFilters}>
              Reset filter
            </Button>
          </div>
        </FilterBar>
      </div>

      <Card>
        {transactions.isError ? (
          <ErrorState
            title={`${copy.title} belum dapat dimuat`}
            description={getErrorMessage(transactions.error)}
            onRetry={() => void transactions.refetch()}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-600" aria-live="polite">
                {transactions.isLoading
                  ? `Memuat ${copy.title.toLowerCase()}…`
                  : `${formatNumber(meta?.total ?? 0)} transaksi sesuai filter`}
              </p>
              {transactions.isFetching && !transactions.isLoading ? (
                <span className="text-xs text-slate-400">Memperbarui…</span>
              ) : null}
            </div>

            <Table caption={copy.caption} minWidth="min-w-[980px]">
              <THead>
                <TR>
                  <TH>Referensi</TH>
                  <TH>Aset</TH>
                  <TH className="text-right">Jumlah</TH>
                  <TH>{copy.party}</TH>
                  <TH className="text-right">Serial</TH>
                  <TH>Dicatat oleh</TH>
                  <TH className="text-right">Tindakan</TH>
                </TR>
              </THead>
              <TBody>
                {transactions.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TR key={`skeleton-${index}`}>
                      <TD colSpan={7}>
                        <span className="block h-5 animate-pulse rounded bg-slate-100" />
                      </TD>
                    </TR>
                  ))
                ) : rows.length === 0 ? (
                  <TableEmpty colSpan={7}>
                    <EmptyState
                      icon={<ReceiptText className="h-6 w-6" aria-hidden="true" />}
                      title={copy.emptyTitle}
                      description={
                        query || asset || dateFrom || dateTo
                          ? 'Tidak ada transaksi yang cocok dengan filter. Ubah kata kunci atau rentang tanggal.'
                          : copy.emptyDescription
                      }
                      action={
                        canCreate && !query && !asset && !dateFrom && !dateTo ? (
                          <Link to={`/transaksi/${copy.path}/baru`} className={buttonStyles('primary', 'md')}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            {copy.addLabel}
                          </Link>
                        ) : undefined
                      }
                    />
                  </TableEmpty>
                ) : (
                  rows.map((row) => (
                    <TR key={row.id}>
                      <TD>
                        <Link
                          to={`/transaksi/${copy.path}/${row.id}`}
                          className="rounded font-mono text-xs font-semibold text-primary-800 hover:underline"
                        >
                          {row.reference}
                        </Link>
                        <span className="mt-1 block text-xs whitespace-nowrap text-slate-500">
                          {formatDate(row.transaction_date)}
                        </span>
                      </TD>
                      <TD>
                        <span className="block max-w-[220px] truncate font-medium text-slate-900">
                          {row.asset?.name ?? '—'}
                        </span>
                        <span className="block font-mono text-xs text-slate-500">{row.asset?.code ?? '—'}</span>
                      </TD>
                      <TD className="text-right">
                        <Badge tone={kind === 'in' ? 'success' : 'warning'}>
                          {formatNumber(row.qty)} {row.asset?.unit ?? ''}
                        </Badge>
                      </TD>
                      <TD className="max-w-[200px] truncate">{partyOf(row)}</TD>
                      <TD className="text-right">
                        {row.asset?.has_serial_number ? (
                          <span className="text-xs text-slate-600">
                            {formatNumber(row.serial_numbers_count ?? 0)} unit
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TD>
                      <TD className="text-sm text-slate-500">{row.creator?.name ?? '—'}</TD>
                      <TD>
                        <div className="flex justify-end">
                          <Link
                            to={`/transaksi/${copy.path}/${row.id}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-primary-800 hover:bg-primary-50"
                          >
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            Detail
                          </Link>
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
            <TableScrollHint />
            {meta ? <Pagination meta={meta} onChange={setPage} itemLabel="transaksi" /> : null}
          </>
        )}
      </Card>
    </>
  )
}
