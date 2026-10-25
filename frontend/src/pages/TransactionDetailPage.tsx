import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, ArrowDownToLine, ArrowUpFromLine, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button, buttonStyles } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { DetailList } from '../components/ui/DetailList'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { PageHeader } from '../components/ui/PageHeader'
import { TBody, TD, TH, THead, TR, Table, TableScrollHint } from '../components/ui/Table'
import { api, getErrorMessage } from '../lib/api'
import { formatDate, formatDateTime, formatNumber } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import type { AssetIn, AssetOut, ResourceResponse } from '../types/api'

type Kind = 'in' | 'out'
type Transaction = AssetIn | AssetOut

const COPY = {
  in: {
    kindLabel: 'Barang masuk',
    partyLabel: 'Sumber / supplier',
    listPath: '/transaksi/masuk',
    icon: ArrowDownToLine,
    tone: 'success' as const,
  },
  out: {
    kindLabel: 'Barang keluar',
    partyLabel: 'Penerima / unit tujuan',
    listPath: '/transaksi/keluar',
    icon: ArrowUpFromLine,
    tone: 'warning' as const,
  },
}

export function TransactionDetailPage({ kind }: { kind: Kind }) {
  const { id } = useParams<{ id: string }>()
  const copy = COPY[kind]

  const detail = useQuery({
    queryKey: ['transaction', kind, id],
    queryFn: () => api<ResourceResponse<Transaction>>(`/asset-${kind}s/${id}`),
    enabled: Boolean(id),
  })

  const item = detail.data?.data
  useDocumentTitle(item?.reference ?? 'Detail Transaksi')

  if (detail.isLoading) {
    return (
      <>
        <PageHeader
          title="Detail transaksi"
          breadcrumbs={[{ label: copy.kindLabel, to: copy.listPath }, { label: 'Memuat…' }]}
        />
        <Card>
          <div className="space-y-4 p-5" aria-busy="true" aria-label="Memuat detail transaksi">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </Card>
      </>
    )
  }

  if (detail.isError || !item) {
    return (
      <>
        <PageHeader title="Detail transaksi" breadcrumbs={[{ label: copy.kindLabel, to: copy.listPath }]} />
        <Card>
          <ErrorState
            title="Detail transaksi belum dapat dimuat"
            description={getErrorMessage(detail.error)}
            onRetry={() => void detail.refetch()}
          />
        </Card>
      </>
    )
  }

  const party = kind === 'in' ? (item as AssetIn).supplier_or_source : (item as AssetOut).recipient
  const serials = item.serial_numbers ?? []
  const Icon = copy.icon

  return (
    <>
      <PageHeader
        title={item.reference}
        description={`Catatan ${copy.kindLabel.toLowerCase()} untuk ${item.asset?.name ?? 'aset'}.`}
        breadcrumbs={[
          { label: copy.kindLabel, to: copy.listPath },
          { label: item.reference },
        ]}
        meta={
          <>
            <Badge tone={copy.tone} dot>
              {copy.kindLabel}
            </Badge>
            <span className="text-xs text-slate-500">Dicatat {formatDateTime(item.created_at)}</span>
          </>
        }
        actions={
          <span className="no-print flex flex-wrap items-center gap-2">
            <Link to={copy.listPath} className={buttonStyles('secondary', 'md')}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </Link>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Cetak
            </Button>
          </span>
        }
      />

      <div className="space-y-5">
        <Card className="print-sheet">
          <CardHeader
            title="Ringkasan transaksi"
            description="Rincian transaksi yang tersimpan permanen pada ledger aset."
          />
          <CardBody className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Jumlah</p>
                <p className="text-2xl font-semibold text-slate-950 tabular-nums">
                  {formatNumber(item.qty)}{' '}
                  <span className="text-sm font-medium text-slate-500">{item.asset?.unit}</span>
                </p>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Tanggal transaksi</p>
                <p className="text-sm font-medium text-slate-900">{formatDate(item.transaction_date)}</p>
              </div>
            </div>

            <DetailList
              columns={2}
              items={[
                {
                  label: 'Aset',
                  value: item.asset ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <Link to={`/aset/${item.asset_id}`} className="font-medium text-primary-800 hover:underline">
                        {item.asset.name}
                      </Link>
                      <span className="font-mono text-xs text-slate-500">{item.asset.code}</span>
                    </span>
                  ) : (
                    '—'
                  ),
                },
                { label: copy.partyLabel, value: party },
                { label: 'Kategori', value: item.asset?.category?.name ?? '—' },
                { label: 'Dicatat oleh', value: item.creator?.name ?? '—' },
                { label: 'Waktu pencatatan', value: formatDateTime(item.created_at) },
                {
                  label: 'Serial number',
                  value: item.asset?.has_serial_number ? `${formatNumber(serials.length)} unit terhubung` : 'Tidak menggunakan serial',
                },
                { label: 'Catatan', value: item.notes ?? 'Tidak ada catatan', wide: true },
              ]}
            />
          </CardBody>
        </Card>

        {item.asset?.has_serial_number ? (
          <Card>
            <CardHeader
              title="Serial number"
              description={
                kind === 'in'
                  ? 'Serial number yang dicatat masuk dan kini tersedia untuk dikeluarkan.'
                  : 'Serial number yang dikeluarkan melalui transaksi ini.'
              }
            />
            {serials.length === 0 ? (
              <EmptyState
                title="Tidak ada serial pada transaksi ini"
                description="Data serial mungkin tidak dimuat. Muat ulang halaman untuk mencoba kembali."
              />
            ) : (
              <>
                <Table caption={`Serial number transaksi ${item.reference}`} minWidth="min-w-[560px]">
                  <THead>
                    <TR>
                      <TH>Serial number</TH>
                      <TH>Status</TH>
                      <TH>Aset</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {serials.map((serial) => (
                      <TR key={serial.id}>
                        <TD className="font-mono text-xs font-medium text-slate-900">{serial.serial_number}</TD>
                        <TD>
                          <Badge tone={serial.status === 'available' ? 'success' : 'warning'} dot>
                            {serial.status_label}
                          </Badge>
                        </TD>
                        <TD className="text-sm">
                          {item.asset?.name} <span className="font-mono text-xs text-slate-500">{item.asset?.code}</span>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <TableScrollHint />
              </>
            )}
          </Card>
        ) : null}

        <div className="no-print rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p className="flex items-start gap-2">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            Transaksi yang sudah dicatat tidak dapat diubah atau dihapus. Untuk koreksi, catat transaksi lawan
            dengan keterangan yang jelas agar jejak audit tetap dapat ditelusuri.
          </p>
        </div>
      </div>
    </>
  )
}
