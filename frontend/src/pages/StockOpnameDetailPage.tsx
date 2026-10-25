import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart,
  Lock,
  Save,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button, buttonStyles } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { DetailList } from '../components/ui/DetailList'
import { Alert, EmptyState, ErrorState } from '../components/ui/Feedback'
import { SearchField } from '../components/ui/Filters'
import { Input } from '../components/ui/Form'
import { ConfirmDialog } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { Pagination } from '../components/ui/Pagination'
import { TBody, TD, TH, THead, TR, Table, TableScrollHint } from '../components/ui/Table'
import { ApiError, api, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDate, formatDateTime, formatDifference, formatNumber } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import type { ResourceResponse, StockOpname, StockOpnameItem } from '../types/api'

interface Entry {
  physical: string
  notes: string
}

const PAGE_SIZE = 25

function entriesFrom(items: StockOpnameItem[] | undefined): Record<number, Entry> {
  if (!items) return {}

  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        physical: item.physical_qty === null ? '' : String(item.physical_qty),
        notes: item.notes ?? '',
      },
    ]),
  )
}

export function StockOpnameDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { has } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [entries, setEntries] = useState<Record<number, Entry>>({})
  const [syncedKey, setSyncedKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [onlyUnfilled, setOnlyUnfilled] = useState(false)
  const [page, setPage] = useState(1)
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const detail = useQuery({
    queryKey: ['stock-opname', id],
    queryFn: () => api<ResourceResponse<StockOpname>>(`/stock-opnames/${id}`),
    enabled: Boolean(id),
  })

  const opname = detail.data?.data
  useDocumentTitle(opname ? `Opname ${opname.reference}` : 'Detail Stock Opname')

  // Re-sync the editable sheet whenever the server snapshot changes (initial load,
  // refetch, save, or finalize). Adjusting state during render avoids an extra
  // effect render and keeps in-progress edits until newer server data arrives.
  const syncKey = opname ? `${opname.id}:${opname.status}:${opname.updated_at}` : null
  if (opname && syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    setEntries(entriesFrom(opname.items))
  }

  const isDraft = opname?.status === 'draft'
  const canManage = has('opname.manage')
  const canApprove = has('opname.approve')
  const editable = Boolean(isDraft && canManage)
  const items = useMemo(() => opname?.items ?? [], [opname])

  const live = useMemo(() => {
    let filled = 0
    let match = 0
    let more = 0
    let less = 0

    for (const item of items) {
      const raw = entries[item.id]?.physical ?? ''
      if (raw.trim() === '') continue

      const value = Number(raw)
      if (!Number.isFinite(value)) continue

      filled += 1
      const difference = value - item.system_qty_snapshot
      if (difference === 0) match += 1
      else if (difference > 0) more += 1
      else less += 1
    }

    return { total: items.length, filled, match, more, less }
  }, [items, entries])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()

    return items.filter((item) => {
      const entry = entries[item.id]
      if (onlyUnfilled && (entry?.physical ?? '') !== '') return false
      if (!term) return true

      return (
        (item.asset?.code ?? '').toLowerCase().includes(term) ||
        (item.asset?.name ?? '').toLowerCase().includes(term) ||
        (item.asset?.category?.name ?? '').toLowerCase().includes(term)
      )
    })
  }, [items, entries, query, onlyUnfilled])

  const lastPage = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, lastPage)
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageMeta = {
    current_page: currentPage,
    last_page: lastPage,
    per_page: PAGE_SIZE,
    total: visible.length,
    from: visible.length === 0 ? null : (currentPage - 1) * PAGE_SIZE + 1,
    to: Math.min(currentPage * PAGE_SIZE, visible.length),
  }

  const buildPayload = (): Array<{ id: number; physical_qty: number | null; notes: string | null }> | null => {
    for (const item of items) {
      const raw = entries[item.id]?.physical.trim() ?? ''
      if (raw === '') continue

      if (!/^\d+$/.test(raw) || Number(raw) > 1_000_000_000) {
        setFormError(
          `Jumlah fisik untuk ${item.asset?.name ?? 'aset'} harus bilangan bulat antara 0 dan 1.000.000.000.`,
        )
        return null
      }
    }

    return items.map((item) => {
      const entry = entries[item.id]
      return {
        id: item.id,
        physical_qty: entry && entry.physical.trim() !== '' ? Number(entry.physical) : null,
        notes: entry?.notes.trim() ? entry.notes.trim() : null,
      }
    })
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['reports'] })
  }

  const saveMutation = useMutation({
    mutationFn: (payload: Array<{ id: number; physical_qty: number | null; notes: string | null }>) =>
      api<ResourceResponse<StockOpname>>(`/stock-opnames/${id}`, {
        method: 'PUT',
        body: { items: payload },
      }),
    onSuccess: (response) => {
      toast('success', 'Hasil opname disimpan', 'Jumlah fisik dan catatan telah diperbarui.')
      setFormError(null)
      setEntries(entriesFrom(response.data.items))
      queryClient.setQueryData(['stock-opname', id], response)
      invalidate()
    },
    onError: (error) => {
      setFormError(getErrorMessage(error))
      if (error instanceof ApiError && error.errors?.items) {
        setFormError(error.errors.items[0])
      }
    },
  })

  const finalizeMutation = useMutation({
    mutationFn: async (payload: Array<{ id: number; physical_qty: number | null; notes: string | null }>) => {
      await api(`/stock-opnames/${id}`, { method: 'PUT', body: { items: payload } })
      return api<ResourceResponse<StockOpname>>(`/stock-opnames/${id}/finalize`, { method: 'POST' })
    },
    onSuccess: (response) => {
      toast('success', 'Opname disahkan', 'Sesi opname dikunci. Stok sistem tidak diubah otomatis.')
      setFinalizeOpen(false)
      setFormError(null)
      setEntries(entriesFrom(response.data.items))
      queryClient.setQueryData(['stock-opname', id], response)
      invalidate()
    },
    onError: (error) => {
      setFinalizeOpen(false)
      setFormError(getErrorMessage(error))
      if (error instanceof ApiError && error.errors?.items) {
        setFormError(error.errors.items[0])
      }
    },
  })

  const handleSave = () => {
    setFormError(null)
    const payload = buildPayload()
    if (payload) saveMutation.mutate(payload)
  }

  const handleFinalize = () => {
    setFormError(null)
    if (live.filled !== live.total) {
      setFormError('Seluruh baris harus memiliki jumlah fisik sebelum sesi disahkan.')
      return
    }

    const payload = buildPayload()
    if (payload) finalizeMutation.mutate(payload)
  }

  if (detail.isLoading) {
    return (
      <>
        <PageHeader
          title="Detail stock opname"
          breadcrumbs={[{ label: 'Stock Opname', to: '/stock-opname' }, { label: 'Memuat…' }]}
        />
        <Card>
          <div className="space-y-4 p-5" aria-busy="true" aria-label="Memuat sesi opname">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </Card>
      </>
    )
  }

  if (detail.isError || !opname) {
    return (
      <>
        <PageHeader title="Detail stock opname" breadcrumbs={[{ label: 'Stock Opname', to: '/stock-opname' }]} />
        <Card>
          <ErrorState
            title="Sesi opname belum dapat dimuat"
            description={getErrorMessage(detail.error)}
            onRetry={() => void detail.refetch()}
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={opname.reference}
        description={opname.description ?? 'Sesi penghitungan fisik aset.'}
        breadcrumbs={[
          { label: 'Stock Opname', to: '/stock-opname' },
          { label: opname.reference },
        ]}
        meta={
          <>
            <Badge tone={opname.status === 'finalized' ? 'success' : 'warning'} dot>
              {opname.status_label}
            </Badge>
            <span className="text-xs text-slate-500">Tanggal opname {formatDate(opname.opname_date)}</span>
            <span className="text-xs text-slate-500">Dibuat oleh {opname.creator?.name ?? '—'}</span>
          </>
        }
        actions={
          <>
            <Link to="/stock-opname" className={buttonStyles('secondary', 'md')}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </Link>
            {has('reports.view') ? (
              <Link
                to={`/laporan/opname?stock_opname_id=${opname.id}`}
                className={buttonStyles('secondary', 'md')}
              >
                <FileBarChart className="h-4 w-4" aria-hidden="true" />
                Laporan
              </Link>
            ) : null}
            {editable ? (
              <Button
                variant="secondary"
                onClick={handleSave}
                loading={saveMutation.isPending}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Simpan hasil
              </Button>
            ) : null}
            {editable && canApprove ? (
              <Button
                onClick={() => setFinalizeOpen(true)}
                disabled={live.filled !== live.total}
                title={
                  live.filled !== live.total
                    ? 'Seluruh baris harus diisi sebelum sesi dapat disahkan.'
                    : undefined
                }
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Sahkan opname
              </Button>
            ) : null}
          </>
        }
      />

      {opname.status === 'finalized' ? (
        <div className="mb-4">
          <Alert tone="success" title="Sesi telah disahkan">
            Disahkan oleh {opname.approver?.name ?? 'Manajer'} pada{' '}
            {formatDateTime(opname.approved_at)}. Hasil opname terkunci dan tidak dapat diubah. Stok sistem tidak
            berubah otomatis; catat transaksi koreksi bila diperlukan.
          </Alert>
        </div>
      ) : !canManage ? (
        <div className="mb-4">
          <Alert tone="info" title="Akses baca saja">
            Anda dapat melihat hasil opname, tetapi tidak memiliki izin mengisi atau mengubahnya.
          </Alert>
        </div>
      ) : null}

      {formError ? (
        <div className="mb-4">
          <Alert tone="danger" title="Belum dapat diproses">
            {formError}
          </Alert>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Total baris', value: live.total, tone: 'text-slate-950' },
          { label: 'Sudah diisi', value: live.filled, tone: 'text-primary-800' },
          { label: 'Sesuai', value: live.match, tone: 'text-emerald-700' },
          { label: 'Lebih', value: live.more, tone: 'text-sky-700' },
          { label: 'Kurang', value: live.less, tone: 'text-amber-700' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-card">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{stat.label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${stat.tone}`}>{formatNumber(stat.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title="Lembar hitung fisik"
            description="Masukkan jumlah fisik per aset. Selisih dihitung terhadap snapshot sistem saat sesi dibuat."
            actions={
              <Badge tone={live.filled === live.total && live.total > 0 ? 'success' : 'neutral'}>
                {formatNumber(live.filled)} / {formatNumber(live.total)} terisi
              </Badge>
            }
          />

          <div className="border-b border-slate-200 p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div>
                <label htmlFor="opname-item-search" className="mb-1 block text-xs font-semibold text-slate-600">
                  Cari baris
                </label>
                <SearchField
                  value={query}
                  onChange={(value) => {
                    setQuery(value)
                    setPage(1)
                  }}
                  placeholder="Cari kode, nama, atau kategori aset…"
                  label="Cari baris opname"
                />
              </div>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={onlyUnfilled}
                  onChange={(event) => {
                    setOnlyUnfilled(event.target.checked)
                    setPage(1)
                  }}
                  className="h-4 w-4 rounded border-slate-400"
                />
                Hanya belum terisi
              </label>
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
              title="Sesi tidak memiliki baris aset"
              description="Sesi opname ini tidak memuat aset. Buat sesi baru dengan cakupan yang sesuai."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Search className="h-6 w-6" aria-hidden="true" />}
              title="Tidak ada baris yang cocok"
              description="Ubah kata kunci atau matikan filter hanya belum terisi."
            />
          ) : (
            <>
              <Table caption={`Lembar hitung fisik ${opname.reference}`} minWidth="min-w-[940px]">
                <THead>
                  <TR>
                    <TH>Aset</TH>
                    <TH className="text-right">Stok sistem</TH>
                    <TH className="text-right">Jumlah fisik</TH>
                    <TH className="text-right">Selisih</TH>
                    <TH>Catatan baris</TH>
                  </TR>
                </THead>
                <TBody>
                  {pageRows.map((item) => {
                    const entry = entries[item.id] ?? { physical: '', notes: '' }
                    const physical = entry.physical.trim() === '' ? null : Number(entry.physical)
                    const difference =
                      physical === null || !Number.isFinite(physical)
                        ? null
                        : physical - item.system_qty_snapshot

                    return (
                      <TR key={item.id}>
                        <TD>
                          <span className="block max-w-[240px] font-medium text-slate-900">
                            {item.asset?.name ?? '—'}
                          </span>
                          <span className="font-mono text-xs text-slate-500">{item.asset?.code ?? ''}</span>
                          <span className="block text-xs text-slate-400">
                            {item.asset?.category?.name ?? ''}
                          </span>
                        </TD>
                        <TD className="text-right tabular-nums">
                          {formatNumber(item.system_qty_snapshot)}{' '}
                          <span className="text-xs text-slate-500">{item.asset?.unit}</span>
                        </TD>
                        <TD>
                          <label className="sr-only" htmlFor={`physical-${item.id}`}>
                            Jumlah fisik {item.asset?.name ?? ''}
                          </label>
                          <Input
                            id={`physical-${item.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={1_000_000_000}
                            step={1}
                            value={entry.physical}
                            disabled={!editable}
                            placeholder="—"
                            onChange={(event) => {
                              const value = event.target.value
                              setEntries((current) => ({
                                ...current,
                                [item.id]: { ...current[item.id], physical: value, notes: current[item.id]?.notes ?? '' },
                              }))
                            }}
                            className="min-w-[110px] text-right tabular-nums"
                          />
                        </TD>
                        <TD className="text-right">
                          {difference === null ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <Badge
                              tone={difference === 0 ? 'success' : difference > 0 ? 'info' : 'warning'}
                            >
                              {formatDifference(difference)}
                            </Badge>
                          )}
                        </TD>
                        <TD>
                          <label className="sr-only" htmlFor={`notes-${item.id}`}>
                            Catatan {item.asset?.name ?? ''}
                          </label>
                          <Input
                            id={`notes-${item.id}`}
                            type="text"
                            maxLength={255}
                            value={entry.notes}
                            disabled={!editable}
                            placeholder="Opsional"
                            onChange={(event) => {
                              const value = event.target.value
                              setEntries((current) => ({
                                ...current,
                                [item.id]: { physical: current[item.id]?.physical ?? '', notes: value },
                              }))
                            }}
                            className="min-w-[180px]"
                          />
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
              <TableScrollHint />
              <Pagination
                meta={pageMeta}
                onChange={setPage}
                itemLabel="baris"
              />
            </>
          )}

          {editable ? (
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={handleSave} loading={saveMutation.isPending}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Simpan hasil
              </Button>
              {canApprove ? (
                <Button
                  onClick={() => setFinalizeOpen(true)}
                  loading={finalizeMutation.isPending}
                  disabled={live.filled !== live.total}
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Sahkan opname
                </Button>
              ) : (
                <p className="self-center text-xs text-slate-500">
                  Pengesahan dilakukan oleh Manajer setelah seluruh baris terisi.
                </p>
              )}
            </div>
          ) : null}
        </Card>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="Informasi sesi" />
            <CardBody>
              <DetailList
                columns={1}
                items={[
                  { label: 'Referensi', value: <span className="font-mono">{opname.reference}</span> },
                  { label: 'Tanggal opname', value: formatDate(opname.opname_date) },
                  { label: 'Dibuat oleh', value: opname.creator?.name ?? '—' },
                  { label: 'Dibuat pada', value: formatDateTime(opname.created_at) },
                  {
                    label: 'Pengesahan',
                    value:
                      opname.status === 'finalized'
                        ? `${opname.approver?.name ?? 'Manajer'} · ${formatDateTime(opname.approved_at)}`
                        : 'Belum disahkan',
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ketentuan pengesahan" />
            <CardBody>
              <ul className="space-y-2.5 text-xs leading-5 text-slate-600">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  Seluruh baris wajib memiliki jumlah fisik.
                </li>
                <li className="flex gap-2">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  Setelah disahkan, hasil tidak dapat diubah.
                </li>
                <li className="flex gap-2">
                  <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  Selisih tidak mengubah saldo stok secara otomatis.
                </li>
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        onConfirm={handleFinalize}
        loading={finalizeMutation.isPending}
        title="Sahkan sesi opname ini?"
        description={`${opname.reference} akan dikunci dan tidak dapat diubah lagi. Pastikan seluruh jumlah fisik sudah benar. Stok sistem tidak akan diubah otomatis oleh pengesahan ini.`}
        confirmLabel="Sahkan opname"
        tone="primary"
      />
    </>
  )
}
