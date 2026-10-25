import { useQuery } from '@tanstack/react-query'
import { Eye, ScrollText, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DetailList } from '../components/ui/DetailList'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { FilterBar, SearchField } from '../components/ui/Filters'
import { Input, Select } from '../components/ui/Form'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { Pagination } from '../components/ui/Pagination'
import { Table, TableEmpty, TableScrollHint, TBody, TD, TH, THead, TR } from '../components/ui/Table'
import { api, buildQuery, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { AUDIT_LABELS, auditActionLabel, formatDateTime, formatNumber } from '../lib/format'
import { useDebouncedValue, useDocumentTitle } from '../lib/hooks'
import type { AuditLog, Paginated, User } from '../types/api'

const PER_PAGE = 25

const ACTION_OPTIONS = Object.entries(AUDIT_LABELS).sort((left, right) =>
  left[1].localeCompare(right[1], 'id'),
)

function actionTone(action: string): BadgeTone {
  if (action.includes('failed')) return 'danger'
  if (action.includes('deleted') || action.includes('deactivated') || action.includes('archived')) {
    return 'warning'
  }
  if (action.includes('login') || action.includes('created') || action.includes('activated')) {
    return 'success'
  }
  if (action.includes('finalized') || action.includes('approve')) return 'primary'
  return 'info'
}

export function AuditPage() {
  useDocumentTitle('Audit Trail')
  const { has } = useAuth()

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 350)
  const [action, setAction] = useState('')
  const [actorId, setActorId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AuditLog | null>(null)

  const canListUsers = has('users.manage')

  const actors = useQuery({
    queryKey: ['users', 'audit-actors'],
    queryFn: () => api<Paginated<User>>('/users?per_page=100&status=all'),
    enabled: canListUsers,
    staleTime: 60_000,
  })

  const logs = useQuery({
    queryKey: ['audit-logs', debouncedQuery, action, actorId, dateFrom, dateTo, page],
    queryFn: () =>
      api<Paginated<AuditLog>>(
        `/audit-logs${buildQuery({
          q: debouncedQuery,
          action,
          actor_user_id: actorId,
          date_from: dateFrom,
          date_to: dateTo,
          page,
          per_page: PER_PAGE,
        })}`,
      ),
  })

  const resetFilters = () => {
    setQuery('')
    setAction('')
    setActorId('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const meta = logs.data?.meta
  const rows = logs.data?.data ?? []
  const hasFilters = Boolean(debouncedQuery || action || actorId || dateFrom || dateTo)

  return (
    <>
      <PageHeader
        title="Audit Trail"
        description="Riwayat tindakan penting pada aplikasi. Catatan bersifat tambah-saja dan tidak dapat diubah dari antarmuka."
        meta={
          <>
            <Badge tone="primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Hanya dapat dibaca
            </Badge>
            {meta ? <Badge tone="neutral">{formatNumber(meta.total)} catatan</Badge> : null}
          </>
        }
      />

      <div className="no-print mb-4">
        <FilterBar>
          <div className="sm:col-span-2">
            <label htmlFor="audit-search" className="mb-1 block text-xs font-semibold text-slate-600">
              Pencarian
            </label>
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Cari tindakan, entitas, atau ID korelasi…"
              label="Cari catatan audit berdasarkan tindakan, entitas, atau ID korelasi"
            />
          </div>

          <div>
            <label htmlFor="audit-action" className="mb-1 block text-xs font-semibold text-slate-600">
              Tindakan
            </label>
            <Select
              id="audit-action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value)
                setPage(1)
              }}
            >
              <option value="">Semua tindakan</option>
              {ACTION_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="audit-actor" className="mb-1 block text-xs font-semibold text-slate-600">
              Pelaku
            </label>
            <Select
              id="audit-actor"
              value={actorId}
              disabled={!canListUsers}
              onChange={(event) => {
                setActorId(event.target.value)
                setPage(1)
              }}
            >
              <option value="">Semua pelaku</option>
              {actors.data?.data.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name} — {actor.role_label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="audit-from" className="mb-1 block text-xs font-semibold text-slate-600">
              Dari tanggal
            </label>
            <Input
              id="audit-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => {
                setDateFrom(event.target.value)
                setPage(1)
              }}
            />
          </div>

          <div>
            <label htmlFor="audit-to" className="mb-1 block text-xs font-semibold text-slate-600">
              Sampai tanggal
            </label>
            <Input
              id="audit-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => {
                setDateTo(event.target.value)
                setPage(1)
              }}
            />
          </div>

          <div className="flex items-end sm:col-span-2">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={resetFilters} disabled={!hasFilters}>
              Reset filter
            </Button>
          </div>
        </FilterBar>
      </div>

      <Card>
        {logs.isError ? (
          <ErrorState
            title="Catatan audit belum dapat dimuat"
            description={getErrorMessage(logs.error)}
            onRetry={() => void logs.refetch()}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-600" aria-live="polite">
                {logs.isLoading
                  ? 'Memuat catatan audit…'
                  : `${formatNumber(meta?.total ?? 0)} catatan sesuai filter`}
              </p>
              <p className="text-xs text-slate-500">
                Waktu ditampilkan sesuai zona waktu perangkat Anda.
              </p>
            </div>

            <Table caption="Daftar catatan audit aktivitas pengguna" minWidth="min-w-[1040px]">
              <THead>
                <TR>
                  <TH>Waktu</TH>
                  <TH>Pelaku</TH>
                  <TH>Tindakan</TH>
                  <TH>Entitas</TH>
                  <TH>ID korelasi</TH>
                  <TH>Alamat IP</TH>
                  <TH className="text-right">Detail</TH>
                </TR>
              </THead>
              <TBody>
                {logs.isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TR key={`skeleton-${index}`}>
                      <TD colSpan={7}>
                        <span className="block h-5 animate-pulse rounded bg-slate-100" />
                      </TD>
                    </TR>
                  ))
                ) : rows.length === 0 ? (
                  <TableEmpty colSpan={7}>
                    <EmptyState
                      icon={<ScrollText className="h-6 w-6" aria-hidden="true" />}
                      title="Tidak ada catatan yang sesuai"
                      description="Ubah kata kunci, tindakan, pelaku, atau rentang tanggal untuk melihat catatan lain."
                      action={
                        hasFilters ? (
                          <Button variant="secondary" onClick={resetFilters}>
                            Reset filter
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableEmpty>
                ) : (
                  rows.map((log) => (
                    <TR key={log.id}>
                      <TD className="text-sm whitespace-nowrap text-slate-700">
                        {formatDateTime(log.created_at)}
                      </TD>
                      <TD>
                        {log.actor ? (
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className="block max-w-[170px] truncate font-medium text-slate-900">
                                {log.actor.name}
                              </span>
                              <span className="block text-xs text-slate-500">{log.actor.role_label}</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">Sistem</span>
                        )}
                      </TD>
                      <TD>
                        <Badge tone={actionTone(log.action)}>{auditActionLabel(log.action)}</Badge>
                        <span className="mt-1 block font-mono text-[11px] text-slate-500">{log.action}</span>
                      </TD>
                      <TD className="text-sm">
                        {log.entity_type_short ? (
                          <>
                            <span className="block text-slate-900">{log.entity_type_short}</span>
                            <span className="block text-xs text-slate-500">
                              {log.entity_id ? `#${log.entity_id}` : 'Tanpa ID'}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </TD>
                      <TD>
                        <span
                          className="block max-w-[150px] truncate font-mono text-xs text-slate-600"
                          title={log.correlation_id ?? undefined}
                        >
                          {log.correlation_id ?? '—'}
                        </span>
                      </TD>
                      <TD className="font-mono text-xs text-slate-600">{log.ip_address ?? '—'}</TD>
                      <TD>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setSelected(log)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            aria-label={`Lihat detail catatan audit ${auditActionLabel(log.action)}`}
                            title="Lihat detail"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
            <TableScrollHint />
            {meta ? <Pagination meta={meta} onChange={setPage} itemLabel="catatan" /> : null}
          </>
        )}
      </Card>

      {selected ? (
        <AuditDetailModal log={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  )
}

function AuditDetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const metadata = log.metadata
  const hasMetadata = Boolean(metadata && Object.keys(metadata).length > 0)

  return (
    <Modal
      open
      onClose={onClose}
      title="Detail catatan audit"
      description={`${auditActionLabel(log.action)} · ${formatDateTime(log.created_at)}`}
      size="lg"
    >
      <DetailList
        items={[
          { label: 'Waktu', value: formatDateTime(log.created_at) },
          { label: 'Pelaku', value: log.actor ? `${log.actor.name} (${log.actor.role_label})` : 'Sistem' },
          {
            label: 'Email pelaku',
            value: log.actor ? log.actor.email : 'Tidak tersedia',
          },
          {
            label: 'Tindakan',
            value: (
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={actionTone(log.action)}>{auditActionLabel(log.action)}</Badge>
                <span className="font-mono text-xs text-slate-500">{log.action}</span>
              </span>
            ),
          },
          {
            label: 'Entitas',
            value: log.entity_type ? `${log.entity_type_short ?? log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : '—',
          },
          { label: 'ID korelasi', value: <span className="font-mono text-xs">{log.correlation_id ?? '—'}</span> },
          { label: 'Alamat IP', value: <span className="font-mono text-xs">{log.ip_address ?? '—'}</span> },
          { label: 'Peramban', value: log.user_agent ?? '—', wide: true },
        ]}
      />

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">Metadata peristiwa</h3>
        {hasMetadata ? (
          <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Peristiwa ini tidak menyertakan metadata tambahan.
          </p>
        )}
      </div>

      <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        Catatan audit tidak dapat diubah atau dihapus dari antarmuka aplikasi. Data sensitif seperti
        kata sandi tidak pernah disimpan pada metadata.
      </p>

      <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </Modal>
  )
}
