import { useQuery } from '@tanstack/react-query'
import { Barcode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AssetCombobox } from '../components/ui/AssetCombobox'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { FilterBar, SearchField } from '../components/ui/Filters'
import { Select } from '../components/ui/Form'
import { PageHeader } from '../components/ui/PageHeader'
import { Pagination } from '../components/ui/Pagination'
import { TBody, TD, TH, THead, TR, Table, TableEmpty, TableScrollHint } from '../components/ui/Table'
import { api, buildQuery, getErrorMessage } from '../lib/api'
import { formatDateTime, formatNumber } from '../lib/format'
import { useDebouncedValue, useDocumentTitle } from '../lib/hooks'
import type { Asset, Paginated, ResourceResponse, SerialNumber } from '../types/api'

export function SerialNumbersPage() {
  useDocumentTitle('Serial Number')
  const [searchParams] = useSearchParams()
  const presetAssetId = searchParams.get('asset_id')

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 350)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!presetAssetId) return

    let active = true
    api<ResourceResponse<Asset>>(`/assets/${presetAssetId}`)
      .then((response) => {
        if (active) setAsset(response.data)
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [presetAssetId])

  const serials = useQuery({
    queryKey: ['serial-numbers', debouncedQuery, asset?.id ?? null, status, page],
    queryFn: () =>
      api<Paginated<SerialNumber>>(
        `/serial-numbers${buildQuery({
          q: debouncedQuery,
          asset_id: asset?.id,
          status,
          page,
          per_page: 25,
        })}`,
      ),
  })

  const resetFilters = () => {
    setQuery('')
    setAsset(null)
    setStatus('all')
    setPage(1)
  }

  const meta = serials.data?.meta
  const rows = serials.data?.data ?? []

  return (
    <>
      <PageHeader
        title="Serial Number"
        description="Daftar unit ber-serial beserta status ketersediaan. Serial number bersifat unik untuk seluruh organisasi dan hanya berubah melalui transaksi."
      />

      <div className="no-print mb-4">
        <FilterBar>
          <div className="sm:col-span-2">
            <label htmlFor="serial-page-search" className="mb-1 block text-xs font-semibold text-slate-600">
              Pencarian
            </label>
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Cari serial number…"
              label="Cari serial number"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="serial-asset" className="mb-1 block text-xs font-semibold text-slate-600">
              Aset
            </label>
            <AssetCombobox
              id="serial-asset"
              selected={asset}
              onSelect={(value) => {
                setAsset(value)
                setPage(1)
              }}
              onlyActive={false}
              placeholder="Semua aset ber-serial"
            />
          </div>

          <div>
            <label htmlFor="serial-status" className="mb-1 block text-xs font-semibold text-slate-600">
              Status
            </label>
            <Select
              id="serial-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">Semua status</option>
              <option value="available">Tersedia</option>
              <option value="out">Keluar</option>
            </Select>
          </div>

          <div className="flex items-end">
            <Button variant="secondary" className="w-full" onClick={resetFilters}>
              Reset filter
            </Button>
          </div>
        </FilterBar>
      </div>

      {asset ? (
        <p className="mb-3 text-sm text-slate-600">
          Menampilkan serial untuk <span className="font-semibold text-slate-900">{asset.name}</span>{' '}
          <span className="font-mono text-xs text-slate-500">{asset.code}</span>.{' '}
          <Link to={`/aset/${asset.id}`} className="font-semibold text-primary-800 hover:underline">
            Buka detail aset
          </Link>
        </p>
      ) : null}

      <Card>
        {serials.isError ? (
          <ErrorState
            title="Serial number belum dapat dimuat"
            description={getErrorMessage(serials.error)}
            onRetry={() => void serials.refetch()}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-600" aria-live="polite">
                {serials.isLoading
                  ? 'Memuat serial number…'
                  : `${formatNumber(meta?.total ?? 0)} serial sesuai filter`}
              </p>
              {serials.isFetching && !serials.isLoading ? (
                <span className="text-xs text-slate-400">Memperbarui…</span>
              ) : null}
            </div>

            <Table caption="Daftar serial number aset" minWidth="min-w-[860px]">
              <THead>
                <TR>
                  <TH>Serial number</TH>
                  <TH>Aset</TH>
                  <TH>Kategori</TH>
                  <TH>Status</TH>
                  <TH>Transaksi masuk</TH>
                  <TH>Transaksi keluar</TH>
                  <TH>Dicatat</TH>
                </TR>
              </THead>
              <TBody>
                {serials.isLoading ? (
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
                      icon={<Barcode className="h-6 w-6" aria-hidden="true" />}
                      title="Tidak ada serial number"
                      description={
                        query || asset || status !== 'all'
                          ? 'Tidak ada serial yang cocok dengan filter. Ubah kriteria pencarian.'
                          : 'Serial number akan muncul setelah barang masuk untuk aset ber-serial dicatat.'
                      }
                    />
                  </TableEmpty>
                ) : (
                  rows.map((serial) => (
                    <TR key={serial.id}>
                      <TD className="font-mono text-xs font-semibold text-slate-900">{serial.serial_number}</TD>
                      <TD>
                        <Link
                          to={`/aset/${serial.asset_id}`}
                          className="block max-w-[220px] truncate font-medium text-slate-900 hover:text-primary-800"
                        >
                          {serial.asset?.name ?? '—'}
                        </Link>
                        <span className="block font-mono text-xs text-slate-500">{serial.asset?.code ?? ''}</span>
                      </TD>
                      <TD className="text-sm text-slate-600">{serial.asset?.category?.name ?? '—'}</TD>
                      <TD>
                        <Badge tone={serial.status === 'available' ? 'success' : 'warning'} dot>
                          {serial.status_label}
                        </Badge>
                      </TD>
                      <TD className="text-xs text-slate-500">
                        {serial.asset_in_id ? `#${serial.asset_in_id}` : '—'}
                      </TD>
                      <TD className="text-xs text-slate-500">
                        {serial.asset_out_id ? `#${serial.asset_out_id}` : '—'}
                      </TD>
                      <TD className="text-xs whitespace-nowrap text-slate-500">{formatDateTime(serial.created_at)}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
            <TableScrollHint />
            {meta ? <Pagination meta={meta} onChange={setPage} itemLabel="serial" /> : null}
          </>
        )}
      </Card>
    </>
  )
}
