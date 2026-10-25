import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Barcode,
  Boxes,
  ClipboardCheck,
  FileBarChart,
  Layers,
  Package,
  RefreshCw,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '../components/ui/Badge'
import { buttonStyles } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { TBody, TD, TH, THead, TR, Table } from '../components/ui/Table'
import { api, buildQuery, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { auditActionLabel, formatDate, formatDateTime, formatNumber, monthStartIso, todayIso } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import type { DashboardData, ResourceResponse } from '../types/api'

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat dashboard" className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>
  )
}

export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user, has } = useAuth()
  const [from, setFrom] = useState(monthStartIso())
  const [to, setTo] = useState(todayIso())
  const [period, setPeriod] = useState({ from: monthStartIso(), to: todayIso() })
  const [periodError, setPeriodError] = useState<string | null>(null)

  const dashboard = useQuery({
    queryKey: ['dashboard', period.from, period.to],
    queryFn: () =>
      api<ResourceResponse<DashboardData>>(
        `/dashboard${buildQuery({ from: period.from, to: period.to })}`,
      ),
  })

  const data = dashboard.data?.data

  const applyPeriod = () => {
    if (from && to && from > to) {
      setPeriodError('Tanggal awal tidak boleh melewati tanggal akhir.')
      return
    }
    setPeriodError(null)
    setPeriod({ from, to })
  }

  const chartData = (data?.trend ?? []).map((row) => ({
    ...row,
    axisLabel: row.label.split(' ')[0],
  }))

  return (
    <>
      <PageHeader
        title={`Selamat datang, ${user?.name.split(' ')[0] ?? 'Pengguna'}`}
        description="Ringkasan kondisi aset, pergerakan transaksi, dan pekerjaan yang perlu ditindaklanjuti."
        meta={
          data ? (
            <Badge tone="primary">
              Periode {formatDate(data.period.from)} – {formatDate(data.period.to)}
            </Badge>
          ) : null
        }
        actions={
          <>
            {has('transactions.create') ? (
              <>
                <Link to="/transaksi/masuk/baru" className={buttonStyles('secondary', 'md')}>
                  <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                  Barang masuk
                </Link>
                <Link to="/transaksi/keluar/baru" className={buttonStyles('primary', 'md')}>
                  <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
                  Barang keluar
                </Link>
              </>
            ) : null}
          </>
        }
      />

      <div className="no-print mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:max-w-[180px]">
            <label htmlFor="dashboard-from" className="mb-1 block text-xs font-semibold text-slate-600">
              Dari tanggal
            </label>
            <input
              id="dashboard-from"
              type="date"
              value={from}
              max={to || todayIso()}
              onChange={(event) => setFrom(event.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 focus:outline-none"
            />
          </div>
          <div className="sm:max-w-[180px]">
            <label htmlFor="dashboard-to" className="mb-1 block text-xs font-semibold text-slate-600">
              Sampai tanggal
            </label>
            <input
              id="dashboard-to"
              type="date"
              value={to}
              max={todayIso()}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={applyPeriod}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Terapkan periode
          </button>
          {periodError ? (
            <p role="alert" className="text-xs font-medium text-red-700">
              {periodError}
            </p>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Periode memengaruhi ringkasan transaksi masuk dan keluar. Total master aset dihitung dari seluruh data.
        </p>
      </div>

      {dashboard.isLoading ? (
        <DashboardSkeleton />
      ) : dashboard.isError ? (
        <Card>
          <ErrorState
            title="Dashboard belum dapat dimuat"
            description={getErrorMessage(dashboard.error)}
            onRetry={() => void dashboard.refetch()}
          />
        </Card>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total aset"
              value={formatNumber(data.totals.assets)}
              hint={`${formatNumber(data.totals.active_assets)} aset aktif · ${formatNumber(data.totals.categories)} kategori`}
              icon={Boxes}
              tone="primary"
            />
            <StatCard
              label="Total unit stok"
              value={formatNumber(data.totals.stock_units)}
              hint="Saldo stok dari transaksi yang tercatat"
              icon={Package}
              tone="info"
            />
            <StatCard
              label="Aset masuk"
              value={formatNumber(data.totals.incoming_qty)}
              hint={`${formatNumber(data.totals.incoming_count)} transaksi pada periode ini`}
              icon={ArrowDownToLine}
              tone="success"
            />
            <StatCard
              label="Aset keluar"
              value={formatNumber(data.totals.outgoing_qty)}
              hint={`${formatNumber(data.totals.outgoing_count)} transaksi pada periode ini`}
              icon={ArrowUpFromLine}
              tone="neutral"
            />
            <Link to="/aset?stock_status=critical" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700">
              <StatCard
                label="Stok kritis"
                value={formatNumber(data.totals.critical_assets)}
                hint="Aset aktif pada atau di bawah stok minimum"
                icon={AlertTriangle}
                tone="warning"
              />
            </Link>
            <StatCard
              label="Serial tersedia"
              value={formatNumber(data.totals.serial_available)}
              hint={`${formatNumber(data.totals.serial_out)} unit berstatus keluar`}
              icon={Barcode}
              tone="primary"
            />
            <StatCard
              label="Opname menunggu"
              value={formatNumber(data.totals.pending_opnames)}
              hint="Sesi draf yang belum disahkan"
              icon={ClipboardCheck}
              tone={data.totals.pending_opnames > 0 ? 'warning' : 'neutral'}
            />
            <StatCard
              label="Kategori aset"
              value={formatNumber(data.totals.categories)}
              hint="Klasifikasi master aset"
              icon={Layers}
              tone="info"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Tren transaksi"
                description="Enam bulan terakhir berdasarkan tanggal transaksi."
              />
              <CardBody>
                {chartData.length === 0 ? (
                  <EmptyState title="Belum ada data tren" description="Transaksi masuk dan keluar akan tampil di sini." />
                ) : (
                  <figure>
                    <figcaption className="sr-only">
                      Grafik batang jumlah unit aset masuk dan keluar per bulan selama enam bulan terakhir.
                    </figcaption>
                    <div className="h-72 w-full" aria-hidden="true">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis
                            dataKey="axisLabel"
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            axisLine={{ stroke: '#cbd5e1' }}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: '#f1f5f9' }}
                            contentStyle={{
                              borderRadius: 10,
                              border: '1px solid #e2e8f0',
                              fontSize: 12,
                              boxShadow: '0 8px 20px rgb(15 23 42 / 0.08)',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="incoming" name="Masuk" fill="#1d4ed8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                          <Bar dataKey="outgoing" name="Keluar" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <table className="sr-only">
                      <caption>Tren transaksi enam bulan terakhir</caption>
                      <thead>
                        <tr>
                          <th scope="col">Bulan</th>
                          <th scope="col">Unit masuk</th>
                          <th scope="col">Unit keluar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.trend.map((row) => (
                          <tr key={row.month}>
                            <th scope="row">{row.label}</th>
                            <td>{row.incoming}</td>
                            <td>{row.outgoing}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </figure>
                )}
              </CardBody>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader title="Perlu tindak lanjut" />
                <CardBody className="space-y-4">
                  <Link
                    to="/stock-opname?status=draft"
                    className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 hover:bg-amber-100"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-amber-950">
                        {formatNumber(data.totals.pending_opnames)} opname draf
                      </span>
                      <span className="block text-xs text-amber-800">Perlu pengisian atau pengesahan</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-amber-800" aria-hidden="true" />
                  </Link>

                  {data.pending_opname_list.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {data.pending_opname_list.map((opname) => (
                        <li key={opname.id}>
                          <Link
                            to={`/stock-opname/${opname.id}`}
                            className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary-800"
                          >
                            <span className="min-w-0">
                              <span className="block font-mono text-xs text-slate-500">{opname.reference}</span>
                              <span className="block truncate">{opname.description ?? 'Tanpa keterangan'}</span>
                            </span>
                            <span className="shrink-0 text-xs text-slate-500">{formatDate(opname.opname_date)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">Tidak ada sesi opname yang menunggu.</p>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Pintasan" />
                <CardBody className="grid gap-2">
                  {has('transactions.create') ? (
                    <>
                      <Link to="/transaksi/masuk/baru" className={buttonStyles('secondary', 'md', 'justify-start')}>
                        <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                        Catat barang masuk
                      </Link>
                      <Link to="/transaksi/keluar/baru" className={buttonStyles('secondary', 'md', 'justify-start')}>
                        <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
                        Catat barang keluar
                      </Link>
                    </>
                  ) : null}
                  {has('opname.manage') ? (
                    <Link to="/stock-opname/baru" className={buttonStyles('secondary', 'md', 'justify-start')}>
                      <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                      Buat stock opname
                    </Link>
                  ) : null}
                  {has('reports.view') ? (
                    <Link to="/laporan/aset" className={buttonStyles('secondary', 'md', 'justify-start')}>
                      <FileBarChart className="h-4 w-4" aria-hidden="true" />
                      Buka laporan
                    </Link>
                  ) : null}
                </CardBody>
              </Card>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Stok kritis"
                description="Aset aktif yang berada pada atau di bawah batas minimum."
                actions={
                  <Link to="/aset?stock_status=critical" className="text-sm font-semibold text-primary-800 hover:underline">
                    Lihat semua
                  </Link>
                }
              />
              {data.critical_stock.length === 0 ? (
                <EmptyState
                  title="Tidak ada stok kritis"
                  description="Seluruh aset aktif berada di atas batas stok minimum."
                />
              ) : (
                <Table caption="Daftar aset dengan stok kritis" minWidth="min-w-[520px]">
                  <THead>
                    <TR>
                      <TH>Aset</TH>
                      <TH className="text-right">Stok</TH>
                      <TH className="text-right">Minimum</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.critical_stock.map((asset) => (
                      <TR key={asset.id}>
                        <TD>
                          <Link to={`/aset/${asset.id}`} className="font-medium text-slate-900 hover:text-primary-800">
                            {asset.name}
                          </Link>
                          <span className="block font-mono text-xs text-slate-500">{asset.code}</span>
                        </TD>
                        <TD className="text-right">
                          <Badge tone="warning">{formatNumber(asset.stock)} {asset.unit}</Badge>
                        </TD>
                        <TD className="text-right tabular-nums">{formatNumber(asset.minimum_stock)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Transaksi terbaru"
                description="Dua transaksi masuk dan keluar terakhir."
                actions={
                  <Link to="/transaksi/masuk" className="text-sm font-semibold text-primary-800 hover:underline">
                    Riwayat
                  </Link>
                }
              />
              {data.recent_transactions.length === 0 ? (
                <EmptyState title="Belum ada transaksi" description="Transaksi aset masuk dan keluar akan tampil di sini." />
              ) : (
                <Table caption="Transaksi aset terbaru" minWidth="min-w-[600px]">
                  <THead>
                    <TR>
                      <TH>Referensi</TH>
                      <TH>Aset</TH>
                      <TH className="text-right">Jumlah</TH>
                      <TH>Pihak</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.recent_transactions.map((item) => (
                      <TR key={`${item.type}-${item.reference}`}>
                        <TD>
                          <Link
                            to={`/transaksi/${item.type === 'in' ? 'masuk' : 'keluar'}?q=${encodeURIComponent(item.reference)}`}
                            className="font-mono text-xs font-semibold text-primary-800 hover:underline"
                          >
                            {item.reference}
                          </Link>
                          <span className="mt-1 block text-xs text-slate-500">{formatDate(item.date)}</span>
                        </TD>
                        <TD>
                          <span className="block max-w-[180px] truncate text-slate-900">{item.asset_name}</span>
                          <span className="block font-mono text-xs text-slate-500">{item.asset_code}</span>
                        </TD>
                        <TD className="text-right">
                          <Badge tone={item.type === 'in' ? 'success' : 'warning'}>
                            {item.type === 'in' ? 'Masuk' : 'Keluar'} · {formatNumber(item.qty)} {item.unit}
                          </Badge>
                        </TD>
                        <TD className="max-w-[160px] truncate text-sm">{item.party}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
          </div>

          {has('audit.view') ? (
            <Card>
              <CardHeader
                title="Aktivitas terbaru"
                description="Delapan catatan audit terakhir. Catatan tidak dapat diubah dari aplikasi."
                actions={
                  <Link to="/audit" className="text-sm font-semibold text-primary-800 hover:underline">
                    Buka audit trail
                  </Link>
                }
              />
              {data.recent_activity.length === 0 ? (
                <EmptyState title="Belum ada aktivitas" description="Aktivitas pengguna akan dicatat pada audit trail." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recent_activity.map((log) => (
                    <li key={log.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800">
                          <span className="font-semibold">{log.actor?.name ?? 'Sistem'}</span>{' '}
                          <span className="text-slate-600">{auditActionLabel(log.action)}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {log.entity_type_short ?? '—'} {log.entity_id ? `#${log.entity_id}` : ''} · {log.ip_address ?? 'IP tidak tersedia'}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-slate-500">{formatDateTime(log.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
      ) : (
        <LoadingState />
      )}
    </>
  )
}
