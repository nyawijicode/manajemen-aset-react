import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Barcode,
  Pencil,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button, buttonStyles } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { DetailList } from '../components/ui/DetailList'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { ConfirmDialog } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { TBody, TD, TH, THead, TR, Table, TableScrollHint } from '../components/ui/Table'
import { api, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDate, formatDateTime, formatNumber } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import type { AssetDetail, Paginated, SerialNumber } from '../types/api'

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { has } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [statusOpen, setStatusOpen] = useState(false)
  const [showAllSerials, setShowAllSerials] = useState(false)

  const detail = useQuery({
    queryKey: ['asset', id],
    queryFn: () => api<{ data: AssetDetail }>(`/assets/${id}`),
    enabled: Boolean(id),
  })

  const asset = detail.data?.data
  useDocumentTitle(asset ? asset.name : 'Detail Aset')

  const serials = useQuery({
    queryKey: ['asset-serials', id, showAllSerials],
    queryFn: () =>
      api<Paginated<SerialNumber>>(
        `/assets/${id}/serial-numbers?per_page=${showAllSerials ? 100 : 10}&status=available`,
      ),
    enabled: Boolean(asset?.has_serial_number && asset?.id),
  })

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      api(`/assets/${id}/status`, { method: 'PATCH', body: { is_active: isActive } }),
    onSuccess: (_response, isActive) => {
      toast(
        'success',
        isActive ? 'Aset diaktifkan' : 'Aset dinonaktifkan',
        isActive
          ? 'Aset kembali dapat dipilih pada transaksi baru.'
          : 'Riwayat dan stok aset tetap tersimpan.',
      )
      setStatusOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['asset', id] })
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['asset-picker'] })
    },
    onError: (error) => toast('error', 'Status belum berubah', getErrorMessage(error)),
  })

  if (detail.isLoading) {
    return (
      <>
        <PageHeader title="Detail aset" breadcrumbs={[{ label: 'Daftar Aset', to: '/aset' }]} />
        <Card>
          <div className="space-y-4 p-5" aria-busy="true" aria-label="Memuat detail aset">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </Card>
      </>
    )
  }

  if (detail.isError || !asset) {
    return (
      <>
        <PageHeader title="Detail aset" breadcrumbs={[{ label: 'Daftar Aset', to: '/aset' }]} />
        <Card>
          <ErrorState
            title="Detail aset belum dapat dimuat"
            description={getErrorMessage(detail.error)}
            onRetry={() => void detail.refetch()}
          />
        </Card>
      </>
    )
  }

  const canManage = has('assets.manage')
  const canTransact = has('transactions.create') && asset.is_active

  return (
    <>
      <PageHeader
        title={asset.name}
        description={asset.description ?? 'Tidak ada keterangan tambahan untuk aset ini.'}
        breadcrumbs={[{ label: 'Daftar Aset', to: '/aset' }, { label: asset.code }]}
        meta={
          <>
            <Badge tone={asset.is_active ? 'success' : 'neutral'} dot>
              {asset.is_active ? 'Aktif' : 'Nonaktif'}
            </Badge>
            <Badge tone="primary">{asset.category?.name ?? 'Tanpa kategori'}</Badge>
            {asset.stock === 0 ? (
              <Badge tone="danger">Stok kosong</Badge>
            ) : asset.is_critical ? (
              <Badge tone="warning">Stok kritis</Badge>
            ) : (
              <Badge tone="neutral">Stok normal</Badge>
            )}
            <span className="font-mono text-xs text-slate-500">{asset.code}</span>
          </>
        }
        actions={
          <>
            <Link to="/aset" className={buttonStyles('secondary', 'md')}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </Link>
            {canTransact ? (
              <>
                <Link to={`/transaksi/masuk/baru?asset_id=${asset.id}`} className={buttonStyles('secondary', 'md')}>
                  <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                  Barang masuk
                </Link>
                <Link to={`/transaksi/keluar/baru?asset_id=${asset.id}`} className={buttonStyles('secondary', 'md')}>
                  <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
                  Barang keluar
                </Link>
              </>
            ) : null}
            {canManage ? (
              <>
                <Link to={`/aset/${asset.id}/ubah`} className={buttonStyles('primary', 'md')}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Ubah
                </Link>
                <Button variant="ghost" onClick={() => setStatusOpen(true)}>
                  {asset.is_active ? (
                    <Archive className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                  )}
                  {asset.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Ringkasan aset" description="Data master dan posisi stok saat ini." />
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Stok tersedia</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950 tabular-nums">
                    {formatNumber(asset.stock)}{' '}
                    <span className="text-sm font-medium text-slate-500">{asset.unit}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Minimum {formatNumber(asset.minimum_stock)} {asset.unit}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Serial tersedia</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950 tabular-nums">
                    {asset.has_serial_number ? formatNumber(asset.serial_summary.available) : '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {asset.has_serial_number
                      ? `${formatNumber(asset.serial_summary.out)} unit berstatus keluar`
                      : 'Aset tidak menggunakan serial number'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Transaksi terakhir</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950 tabular-nums">
                    {formatNumber(asset.recent_transactions.length)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Maksimal delapan transaksi terbaru ditampilkan</p>
                </div>
              </div>

              <DetailList
                columns={2}
                items={[
                  { label: 'Kode aset', value: <span className="font-mono">{asset.code}</span> },
                  { label: 'Kategori', value: asset.category?.name ?? '—' },
                  { label: 'Satuan', value: asset.unit },
                  {
                    label: 'Pelacakan serial',
                    value: asset.has_serial_number ? `Ya · ${formatNumber(asset.serial_numbers_count ?? 0)} serial terdaftar` : 'Tidak',
                  },
                  { label: 'Stok minimum', value: `${formatNumber(asset.minimum_stock)} ${asset.unit}` },
                  { label: 'Terakhir diperbarui', value: formatDateTime(asset.updated_at) },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Transaksi terbaru"
              description="Riwayat pergerakan aset ini. Catatan transaksi tidak dapat diubah."
              actions={
                asset.recent_transactions.length > 0 ? (
                  <Link to="/transaksi/masuk" className="text-sm font-semibold text-primary-800 hover:underline">
                    Riwayat lengkap
                  </Link>
                ) : null
              }
            />
            {asset.recent_transactions.length === 0 ? (
              <EmptyState
                title="Belum ada transaksi"
                description="Transaksi masuk dan keluar untuk aset ini akan tampil di sini."
                action={
                  canTransact ? (
                    <Link to={`/transaksi/masuk/baru?asset_id=${asset.id}`} className={buttonStyles('primary', 'md')}>
                      <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                      Catat barang masuk
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <>
                <Table caption={`Transaksi terbaru aset ${asset.name}`} minWidth="min-w-[640px]">
                  <THead>
                    <TR>
                      <TH>Tanggal</TH>
                      <TH>Referensi</TH>
                      <TH>Jenis</TH>
                      <TH className="text-right">Jumlah</TH>
                      <TH>Pihak</TH>
                      <TH>Dicatat oleh</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {asset.recent_transactions.map((item) => (
                      <TR key={`${item.type}-${item.id}`}>
                        <TD className="whitespace-nowrap">{formatDate(item.date)}</TD>
                        <TD>
                          <Link
                            to={`/transaksi/${item.type === 'in' ? 'masuk' : 'keluar'}/${item.id}`}
                            className="rounded font-mono text-xs font-semibold text-primary-800 hover:underline"
                          >
                            {item.reference}
                          </Link>
                        </TD>
                        <TD>
                          <Badge tone={item.type === 'in' ? 'success' : 'warning'}>
                            {item.type === 'in' ? 'Masuk' : 'Keluar'}
                          </Badge>
                        </TD>
                        <TD className="text-right tabular-nums">
                          {formatNumber(item.qty)} {asset.unit}
                        </TD>
                        <TD className="max-w-[200px] truncate">{item.party}</TD>
                        <TD className="text-sm text-slate-500">{item.creator ?? '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <TableScrollHint />
              </>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          {asset.has_serial_number ? (
            <Card>
              <CardHeader
                title="Serial tersedia"
                description="Sepuluh nomor pertama yang masih tersedia."
                actions={
                  <Link
                    to={`/serial-number?asset_id=${asset.id}`}
                    className="text-sm font-semibold text-primary-800 hover:underline"
                  >
                    Semua
                  </Link>
                }
              />
              {serials.isLoading ? (
                <div className="space-y-2 p-4" aria-busy="true">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-8 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              ) : serials.isError ? (
                <div className="p-4">
                  <ErrorState
                    title="Serial belum dapat dimuat"
                    description={getErrorMessage(serials.error)}
                    onRetry={() => void serials.refetch()}
                  />
                </div>
              ) : (serials.data?.data.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<Barcode className="h-6 w-6" aria-hidden="true" />}
                  title="Tidak ada serial tersedia"
                  description="Seluruh serial aset ini sedang keluar atau belum pernah dicatat masuk."
                />
              ) : (
                <>
                  <ul className="divide-y divide-slate-100">
                    {serials.data?.data.map((serial) => (
                      <li key={serial.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                        <span className="font-mono text-xs text-slate-700">{serial.serial_number}</span>
                        <Badge tone="success" dot>
                          Tersedia
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  {(serials.data?.meta.total ?? 0) > 10 || showAllSerials ? null : (
                    <div className="border-t border-slate-100 p-3">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllSerials(true)}>
                        Tampilkan lebih banyak
                      </Button>
                    </div>
                  )}
                  {showAllSerials ? (
                    <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                      Menampilkan maksimal 100 serial. Buka halaman serial number untuk daftar lengkap.
                    </p>
                  ) : null}
                </>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Catatan pengelolaan" />
            <CardBody className="space-y-3 text-xs leading-5 text-slate-500">
              <p>Stok berubah hanya melalui transaksi masuk dan keluar yang tercatat.</p>
              <p>Penyesuaian hasil stock opname dilakukan melalui transaksi koreksi, bukan mengubah saldo langsung.</p>
              <p>Aset dengan riwayat transaksi tidak dapat dihapus. Gunakan status nonaktif agar histori tetap utuh.</p>
            </CardBody>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={() => statusMutation.mutate(!asset.is_active)}
        loading={statusMutation.isPending}
        title={asset.is_active ? 'Nonaktifkan aset ini?' : 'Aktifkan kembali aset ini?'}
        description={
          asset.is_active
            ? `${asset.code} — ${asset.name} tidak akan muncul sebagai pilihan transaksi baru. Riwayat dan stok tetap tersimpan.`
            : `${asset.code} — ${asset.name} akan kembali aktif dan dapat dipilih pada transaksi baru.`
        }
        confirmLabel={asset.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        tone={asset.is_active ? 'danger' : 'primary'}
      />
    </>
  )
}
