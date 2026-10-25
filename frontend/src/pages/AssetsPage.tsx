import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  Barcode,
  Eye,
  PackageSearch,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button, buttonStyles } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { FilterBar, SearchField } from '../components/ui/Filters'
import { Select } from '../components/ui/Form'
import { ConfirmDialog } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { Pagination } from '../components/ui/Pagination'
import { Table, TableEmpty, TableScrollHint, TBody, TD, TH, THead, TR } from '../components/ui/Table'
import { api, buildQuery, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatNumber } from '../lib/format'
import { useDebouncedValue, useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import type { Asset, Category, Paginated } from '../types/api'

type PendingAction = { type: 'archive' | 'activate' | 'delete'; asset: Asset }

export function AssetsPage() {
  useDocumentTitle('Daftar Aset')
  const { has } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 350)
  const [categoryId, setCategoryId] = useState('')
  const [stockStatus, setStockStatus] = useState(searchParams.get('stock_status') ?? 'all')
  const [serialFilter, setSerialFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const [sort, setSort] = useState('code')
  const [direction, setDirection] = useState('asc')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const canManage = has('assets.manage')

  const categories = useQuery({
    queryKey: ['categories', 'options'],
    queryFn: () => api<Paginated<Category>>('/categories?per_page=100'),
    staleTime: 60_000,
  })

  const assets = useQuery({
    queryKey: [
      'assets',
      debouncedQuery,
      categoryId,
      stockStatus,
      serialFilter,
      activeFilter,
      sort,
      direction,
      page,
    ],
    queryFn: () =>
      api<Paginated<Asset>>(
        `/assets${buildQuery({
          q: debouncedQuery,
          category_id: categoryId,
          stock_status: stockStatus,
          has_serial_number:
            serialFilter === 'yes' ? true : serialFilter === 'no' ? false : undefined,
          is_active: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
          sort,
          direction,
          page,
          per_page: 15,
        })}`,
      ),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['assets'] })
    void queryClient.invalidateQueries({ queryKey: ['asset'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['asset-picker'] })
  }

  const statusMutation = useMutation({
    mutationFn: ({ asset, type }: { asset: Asset; type: 'archive' | 'activate' }) =>
      api(`/assets/${asset.id}/status`, {
        method: 'PATCH',
        body: { is_active: type === 'activate' },
      }),
    onSuccess: (_response, variables) => {
      toast(
        'success',
        variables.type === 'activate' ? 'Aset diaktifkan' : 'Aset dinonaktifkan',
        variables.type === 'activate'
          ? 'Aset kembali tersedia untuk transaksi baru.'
          : 'Riwayat aset tetap tersimpan dan dapat dilihat.',
      )
      setPending(null)
      invalidate()
    },
    onError: (error) => toast('error', 'Status aset belum berubah', getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (asset: Asset) => api(`/assets/${asset.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('success', 'Aset dihapus', 'Data aset tanpa riwayat transaksi telah dihapus.')
      setPending(null)
      invalidate()
    },
    onError: (error) => toast('error', 'Aset belum dapat dihapus', getErrorMessage(error)),
  })

  const resetFilters = () => {
    setQuery('')
    setCategoryId('')
    setStockStatus('all')
    setSerialFilter('all')
    setActiveFilter('all')
    setSort('code')
    setDirection('asc')
    setPage(1)
  }

  const meta = assets.data?.meta
  const rows = assets.data?.data ?? []

  const confirm = () => {
    if (!pending) return
    if (pending.type === 'delete') {
      deleteMutation.mutate(pending.asset)
    } else {
      statusMutation.mutate({ asset: pending.asset, type: pending.type })
    }
  }

  return (
    <>
      <PageHeader
        title="Daftar Aset"
        description="Master aset organisasi beserta saldo stok, penggunaan serial number, dan status keaktifan."
        actions={
          canManage ? (
            <Link to="/aset/baru" className={buttonStyles('primary', 'md')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah aset
            </Link>
          ) : null
        }
      />

      <div className="no-print mb-4">
        <FilterBar className="lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="asset-search-label" className="mb-1 block text-xs font-semibold text-slate-600">
              Pencarian
            </label>
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Cari kode atau nama aset…"
              label="Cari aset berdasarkan kode atau nama"
            />
          </div>

          <div>
            <label htmlFor="asset-category" className="mb-1 block text-xs font-semibold text-slate-600">
              Kategori
            </label>
            <Select
              id="asset-category"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value)
                setPage(1)
              }}
            >
              <option value="">Semua kategori</option>
              {categories.data?.data.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="asset-stock-status" className="mb-1 block text-xs font-semibold text-slate-600">
              Kondisi stok
            </label>
            <Select
              id="asset-stock-status"
              value={stockStatus}
              onChange={(event) => {
                setStockStatus(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">Semua stok</option>
              <option value="critical">Kritis</option>
              <option value="empty">Stok kosong</option>
              <option value="normal">Stok normal</option>
            </Select>
          </div>

          <div>
            <label htmlFor="asset-serial" className="mb-1 block text-xs font-semibold text-slate-600">
              Serial number
            </label>
            <Select
              id="asset-serial"
              value={serialFilter}
              onChange={(event) => {
                setSerialFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">Semua aset</option>
              <option value="yes">Menggunakan serial</option>
              <option value="no">Tanpa serial</option>
            </Select>
          </div>

          <div>
            <label htmlFor="asset-active" className="mb-1 block text-xs font-semibold text-slate-600">
              Status
            </label>
            <Select
              id="asset-active"
              value={activeFilter}
              onChange={(event) => {
                setActiveFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          </div>

          <div>
            <label htmlFor="asset-sort" className="mb-1 block text-xs font-semibold text-slate-600">
              Urutkan
            </label>
            <div className="flex gap-2">
              <Select
                id="asset-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="code">Kode</option>
                <option value="name">Nama</option>
                <option value="stock">Stok</option>
                <option value="updated_at">Terakhir diperbarui</option>
              </Select>
              <Select
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
                aria-label="Arah pengurutan"
              >
                <option value="asc">A–Z / kecil</option>
                <option value="desc">Z–A / besar</option>
              </Select>
            </div>
          </div>

          <div className="flex items-end">
            <Button variant="secondary" onClick={resetFilters} className="w-full">
              Reset filter
            </Button>
          </div>
        </FilterBar>
      </div>

      <Card>
        {assets.isError ? (
          <ErrorState
            title="Daftar aset belum dapat dimuat"
            description={getErrorMessage(assets.error)}
            onRetry={() => void assets.refetch()}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-600" aria-live="polite">
                {assets.isLoading
                  ? 'Memuat aset…'
                  : `${formatNumber(meta?.total ?? 0)} aset sesuai filter`}
              </p>
              {assets.isFetching && !assets.isLoading ? (
                <span className="text-xs text-slate-400">Memperbarui…</span>
              ) : null}
            </div>

            <Table caption="Daftar aset organisasi" minWidth="min-w-[980px]">
              <THead>
                <TR>
                  <TH>Kode</TH>
                  <TH>Nama aset</TH>
                  <TH>Kategori</TH>
                  <TH className="text-right">Stok</TH>
                  <TH>Serial number</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Tindakan</TH>
                </TR>
              </THead>
              <TBody>
                {assets.isLoading ? (
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
                      icon={<PackageSearch className="h-6 w-6" aria-hidden="true" />}
                      title="Tidak ada aset yang sesuai"
                      description="Ubah kata kunci atau filter. Pastikan data master aset sudah ditambahkan."
                      action={
                        canManage ? (
                          <Link to="/aset/baru" className={buttonStyles('primary', 'md')}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Tambah aset
                          </Link>
                        ) : undefined
                      }
                    />
                  </TableEmpty>
                ) : (
                  rows.map((asset) => (
                    <TR key={asset.id}>
                      <TD>
                        <Link
                          to={`/aset/${asset.id}`}
                          className="rounded font-mono text-xs font-semibold text-primary-800 hover:underline"
                        >
                          {asset.code}
                        </Link>
                      </TD>
                      <TD>
                        <Link to={`/aset/${asset.id}`} className="font-medium text-slate-900 hover:text-primary-800">
                          {asset.name}
                        </Link>
                        <span className="block text-xs text-slate-500">{asset.unit}</span>
                      </TD>
                      <TD>{asset.category?.name ?? '—'}</TD>
                      <TD className="text-right">
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {formatNumber(asset.stock)}
                        </span>{' '}
                        <span className="text-xs text-slate-500">{asset.unit}</span>
                        <span className="mt-1 block">
                          {asset.stock === 0 ? (
                            <Badge tone="danger">Stok kosong</Badge>
                          ) : asset.is_critical ? (
                            <Badge tone="warning">Stok kritis</Badge>
                          ) : (
                            <Badge tone="neutral">Normal</Badge>
                          )}
                        </span>
                      </TD>
                      <TD>
                        {asset.has_serial_number ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                            <Barcode className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                            {formatNumber(asset.available_serial_numbers_count ?? 0)} tersedia /{' '}
                            {formatNumber(asset.serial_numbers_count ?? 0)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Tidak digunakan</span>
                        )}
                      </TD>
                      <TD>
                        <Badge tone={asset.is_active ? 'success' : 'neutral'} dot>
                          {asset.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="flex justify-end gap-0.5">
                          <Link
                            to={`/aset/${asset.id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            aria-label={`Lihat detail ${asset.name}`}
                            title="Lihat detail"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Link>
                          {canManage ? (
                            <>
                              <Link
                                to={`/aset/${asset.id}/ubah`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                aria-label={`Ubah ${asset.name}`}
                                title="Ubah aset"
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Link>
                              <button
                                type="button"
                                onClick={() =>
                                  setPending({
                                    type: asset.is_active ? 'archive' : 'activate',
                                    asset,
                                  })
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                aria-label={`${asset.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${asset.name}`}
                                title={asset.is_active ? 'Nonaktifkan aset' : 'Aktifkan aset'}
                              >
                                {asset.is_active ? (
                                  <Archive className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                                )}
                              </button>
                              {!asset.serial_numbers_count ? (
                                <button
                                  type="button"
                                  onClick={() => setPending({ type: 'delete', asset })}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                                  aria-label={`Hapus ${asset.name}`}
                                  title="Hapus aset"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
            <TableScrollHint />
            {meta ? <Pagination meta={meta} onChange={setPage} itemLabel="aset" /> : null}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        loading={statusMutation.isPending || deleteMutation.isPending}
        title={
          pending?.type === 'delete'
            ? 'Hapus aset ini?'
            : pending?.type === 'activate'
              ? 'Aktifkan kembali aset?'
              : 'Nonaktifkan aset?'
        }
        description={
          pending?.type === 'delete'
            ? `Aset ${pending.asset.code} — ${pending.asset.name} akan dihapus permanen. Tindakan ini hanya diizinkan karena aset belum memiliki riwayat transaksi atau serial number.`
            : pending?.type === 'activate'
              ? `Aset ${pending.asset.code} — ${pending.asset.name} akan kembali aktif dan dapat dipilih pada transaksi baru.`
              : pending
                ? `Aset ${pending.asset.code} — ${pending.asset.name} tidak akan muncul sebagai pilihan transaksi baru. Riwayat dan stok tetap tersimpan.`
                : 'Pilih tindakan untuk melanjutkan.'
        }
        confirmLabel={
          pending?.type === 'delete' ? 'Hapus aset' : pending?.type === 'activate' ? 'Aktifkan' : 'Nonaktifkan'
        }
        tone={pending?.type === 'delete' ? 'danger' : 'primary'}
      />
    </>
  )
}
