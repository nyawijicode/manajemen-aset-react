import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Barcode,
  CheckCircle2,
  Save,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { AssetCombobox } from '../components/ui/AssetCombobox'
import { Badge } from '../components/ui/Badge'
import { Button, buttonStyles } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Alert } from '../components/ui/Feedback'
import { Field, Input, Textarea } from '../components/ui/Form'
import { PageHeader } from '../components/ui/PageHeader'
import { ApiError, api, getErrorMessage } from '../lib/api'
import { formatNumber, todayIso } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import type { Asset, AssetIn, AssetOut, Paginated, ResourceResponse, SerialNumber } from '../types/api'

type Kind = 'in' | 'out'
type Transaction = AssetIn | AssetOut

const schema = z.object({
  transaction_date: z
    .string()
    .min(1, 'Tanggal transaksi wajib diisi.')
    .refine((value) => value <= todayIso(), 'Tanggal transaksi tidak boleh melebihi hari ini.'),
  qty: z
    .number({ error: 'Jumlah wajib berupa angka.' })
    .int('Jumlah harus bilangan bulat.')
    .min(1, 'Jumlah minimal 1.')
    .max(10_000, 'Jumlah maksimal 10.000.'),
  party: z.string().min(1, 'Bagian ini wajib diisi.').max(180, 'Maksimal 180 karakter.'),
  notes: z.string().max(2000, 'Catatan maksimal 2.000 karakter.').optional(),
})

type FormValues = z.infer<typeof schema>

const COPY = {
  in: {
    title: 'Catat barang masuk',
    description:
      'Catat penerimaan aset. Saldo stok bertambah setelah transaksi disimpan dan tercatat pada audit trail.',
    partyLabel: 'Sumber / supplier',
    partyPlaceholder: 'Nama supplier, unit pengadaan, atau sumber perolehan',
    qtyHint: 'Jumlah unit yang diterima pada transaksi ini.',
    back: '/transaksi/masuk',
    icon: ArrowDownToLine,
  },
  out: {
    title: 'Catat barang keluar',
    description:
      'Catat pengeluaran aset untuk unit kerja atau penerima. Pastikan stok dan serial yang dipilih sesuai kondisi fisik.',
    partyLabel: 'Penerima / unit tujuan',
    partyPlaceholder: 'Nama penerima atau unit kerja tujuan',
    qtyHint: 'Jumlah unit yang dikeluarkan. Tidak boleh melebihi stok tersedia.',
    back: '/transaksi/keluar',
    icon: ArrowUpFromLine,
  },
} as const

function parseSerials(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

export function TransactionFormPage({ kind }: { kind: Kind }) {
  const copy = COPY[kind]
  useDocumentTitle(copy.title)
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const presetId = searchParams.get('asset_id')
  const idempotencyKey = useRef<string>(crypto.randomUUID())

  const [asset, setAsset] = useState<Asset | null>(null)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [serialError, setSerialError] = useState<string | null>(null)
  const [serialText, setSerialText] = useState('')
  const [selectedSerials, setSelectedSerials] = useState<number[]>([])
  const [serialQuery, setSerialQuery] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      transaction_date: todayIso(),
      qty: 1,
      party: '',
      notes: '',
    },
  })

  const qty = watch('qty')

  useEffect(() => {
    if (!presetId) return

    let active = true
    api<ResourceResponse<Asset>>(`/assets/${presetId}`)
      .then((response) => {
        if (active) setAsset(response.data)
      })
      .catch(() => {
        if (active) setAssetError('Aset awal tidak dapat dimuat. Pilih aset secara manual.')
      })

    return () => {
      active = false
    }
  }, [presetId])

  const availableSerials = useQuery({
    queryKey: ['asset-serials', asset?.id, 'available'],
    queryFn: () =>
      api<Paginated<SerialNumber>>(`/assets/${asset?.id}/serial-numbers?status=available&per_page=200`),
    enabled: kind === 'out' && Boolean(asset?.has_serial_number && asset?.id),
  })

  const serialOptions = useMemo(() => availableSerials.data?.data ?? [], [availableSerials.data])
  const filteredSerials = useMemo(() => {
    const term = serialQuery.trim().toUpperCase()
    return term ? serialOptions.filter((serial) => serial.serial_number.includes(term)) : serialOptions
  }, [serialOptions, serialQuery])

  const incomingSerials = useMemo(() => parseSerials(serialText), [serialText])
  const duplicateIncoming = useMemo(
    () => incomingSerials.filter((value, index) => incomingSerials.indexOf(value) !== index),
    [incomingSerials],
  )

  useEffect(() => {
    setSelectedSerials((current) => (current.length > qty ? current.slice(0, qty) : current))
  }, [qty])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['transactions'] })
    void queryClient.invalidateQueries({ queryKey: ['transaction'] })
    void queryClient.invalidateQueries({ queryKey: ['assets'] })
    void queryClient.invalidateQueries({ queryKey: ['asset'] })
    void queryClient.invalidateQueries({ queryKey: ['asset-serials'] })
    void queryClient.invalidateQueries({ queryKey: ['serial-numbers'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['reports'] })
  }

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!asset) throw new Error('asset-required')

      const body =
        kind === 'in'
          ? {
              asset_id: asset.id,
              transaction_date: values.transaction_date,
              qty: values.qty,
              supplier_or_source: values.party.trim(),
              notes: values.notes?.trim() ? values.notes.trim() : null,
              serial_numbers: asset.has_serial_number ? incomingSerials : [],
            }
          : {
              asset_id: asset.id,
              transaction_date: values.transaction_date,
              qty: values.qty,
              recipient: values.party.trim(),
              notes: values.notes?.trim() ? values.notes.trim() : null,
              serial_ids: asset.has_serial_number ? selectedSerials : [],
            }

      return api<ResourceResponse<Transaction>>(`/asset-${kind}s`, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': idempotencyKey.current },
      })
    },
    onSuccess: (response) => {
      toast(
        'success',
        'Transaksi tersimpan',
        `${response.data.reference} berhasil dicatat. Stok aset telah diperbarui.`,
      )
      invalidate()
      navigate(`${copy.back}/${response.data.id}`, { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.errors) {
        for (const [field, messages] of Object.entries(error.errors)) {
          if (field === 'asset_id') setAssetError(messages[0])
          else if (field === 'serial_numbers' || field === 'serial_ids') setSerialError(messages[0])
          else if (field === 'supplier_or_source' || field === 'recipient') {
            setError('party', { type: 'server', message: messages[0] })
          } else if (
            field === 'transaction_date' ||
            field === 'qty' ||
            field === 'notes'
          ) {
            setError(field, { type: 'server', message: messages[0] })
          }
        }
      }
      setFormError(getErrorMessage(error))
    },
  })

  const chooseAsset = (next: Asset | null) => {
    setAsset(next)
    setAssetError(null)
    setSerialError(null)
    setSerialText('')
    setSelectedSerials([])
    setSerialQuery('')
    if (next && kind === 'out') setValue('qty', 1)
  }

  const onSubmit = (values: FormValues) => {
    setFormError(null)
    setAssetError(null)
    setSerialError(null)

    if (!asset) {
      setAssetError('Pilih aset terlebih dahulu.')
      return
    }

    if (!asset.is_active) {
      setAssetError('Aset tidak aktif sehingga tidak dapat dipakai pada transaksi baru.')
      return
    }

    if (kind === 'out' && values.qty > asset.stock) {
      setError('qty', {
        type: 'manual',
        message: `Stok tidak mencukupi. Tersedia ${formatNumber(asset.stock)} ${asset.unit}.`,
      })
      return
    }

    if (asset.has_serial_number) {
      if (kind === 'in') {
        if (incomingSerials.length !== values.qty) {
          setSerialError(
            `Jumlah serial number (${incomingSerials.length}) harus sama dengan kuantitas (${values.qty}).`,
          )
          return
        }
        if (duplicateIncoming.length > 0) {
          setSerialError(`Serial number duplikat: ${[...new Set(duplicateIncoming)].join(', ')}.`)
          return
        }
      } else if (selectedSerials.length !== values.qty) {
        setSerialError(
          `Pilih ${values.qty} serial number yang keluar. Saat ini dipilih ${selectedSerials.length}.`,
        )
        return
      }
    }

    mutation.mutate(values)
  }

  const Icon = copy.icon
  const serialRemaining = asset?.has_serial_number
    ? kind === 'out'
      ? selectedSerials.length
      : incomingSerials.length
    : null
  const serialReady = serialRemaining !== null && asset ? serialRemaining === qty : true

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        breadcrumbs={[
          { label: kind === 'in' ? 'Barang Masuk' : 'Barang Keluar', to: copy.back },
          { label: 'Catat baru' },
        ]}
        actions={
          <Link to={copy.back} className={buttonStyles('secondary', 'md')}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Rincian transaksi" description="Seluruh kolom bertanda bintang wajib diisi." />
            <CardBody className="space-y-5">
              {formError ? (
                <Alert tone="danger" title="Transaksi belum tersimpan">
                  {formError}
                </Alert>
              ) : null}

              <Field
                label="Aset"
                htmlFor="transaction-asset"
                required
                error={assetError ?? undefined}
                hint="Hanya aset aktif yang dapat dipilih untuk transaksi baru."
              >
                <AssetCombobox
                  id="transaction-asset"
                  selected={asset}
                  onSelect={chooseAsset}
                  invalid={Boolean(assetError)}
                  onlyActive
                  placeholder="Cari kode atau nama aset aktif…"
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Tanggal transaksi"
                  htmlFor="transaction-date"
                  required
                  error={errors.transaction_date?.message}
                >
                  <Input
                    id="transaction-date"
                    type="date"
                    max={todayIso()}
                    aria-invalid={errors.transaction_date ? true : undefined}
                    {...register('transaction_date')}
                  />
                </Field>

                <Field
                  label={kind === 'in' ? 'Jumlah masuk' : 'Jumlah keluar'}
                  htmlFor="transaction-qty"
                  required
                  hint={
                    kind === 'out' && asset
                      ? `Stok tersedia ${formatNumber(asset.stock)} ${asset.unit}.`
                      : copy.qtyHint
                  }
                  error={errors.qty?.message}
                >
                  <Input
                    id="transaction-qty"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={kind === 'out' && asset ? Math.max(1, asset.stock) : 10_000}
                    step={1}
                    aria-invalid={errors.qty ? true : undefined}
                    {...register('qty', { valueAsNumber: true })}
                  />
                </Field>
              </div>

              <Field label={copy.partyLabel} htmlFor="transaction-party" required error={errors.party?.message}>
                <Input
                  id="transaction-party"
                  autoComplete="off"
                  placeholder={copy.partyPlaceholder}
                  aria-invalid={errors.party ? true : undefined}
                  {...register('party')}
                />
              </Field>

              <Field
                label="Catatan"
                htmlFor="transaction-notes"
                hint="Opsional. Misalnya nomor faktur, surat jalan, atau keperluan unit."
                error={errors.notes?.message}
              >
                <Textarea
                  id="transaction-notes"
                  rows={3}
                  placeholder="Nomor dokumen atau keterangan tambahan…"
                  aria-invalid={errors.notes ? true : undefined}
                  {...register('notes')}
                />
              </Field>
            </CardBody>
          </Card>

          {asset?.has_serial_number ? (
            <Card>
              <CardHeader
                title="Serial number"
                description={
                  kind === 'in'
                    ? 'Masukkan satu serial per baris. Jumlahnya harus sama dengan kuantitas masuk.'
                    : 'Pilih serial number yang keluar. Jumlahnya harus sama dengan kuantitas keluar.'
                }
                actions={
                  <Badge tone={serialReady ? 'success' : 'warning'}>
                    {serialRemaining} / {qty} dipilih
                  </Badge>
                }
              />
              <CardBody className="space-y-3">
                {serialError ? <Alert tone="danger">{serialError}</Alert> : null}

                {kind === 'in' ? (
                  <>
                    <Field
                      label="Daftar serial number"
                      htmlFor="transaction-serials"
                      hint="Pisahkan dengan baris baru atau koma. Sistem mengubah menjadi huruf besar secara otomatis."
                    >
                      <Textarea
                        id="transaction-serials"
                        rows={Math.min(12, Math.max(5, qty + 1))}
                        spellCheck={false}
                        className="font-mono text-sm"
                        placeholder={'SN-001\nSN-002\nSN-003'}
                        value={serialText}
                        onChange={(event) => {
                          setSerialText(event.target.value)
                          setSerialError(null)
                        }}
                      />
                    </Field>
                    {duplicateIncoming.length > 0 ? (
                      <p className="text-xs font-medium text-red-700">
                        Serial duplikat: {[...new Set(duplicateIncoming)].join(', ')}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Field label="Cari serial" htmlFor="serial-search">
                      <Input
                        id="serial-search"
                        type="search"
                        placeholder="Cari serial number…"
                        value={serialQuery}
                        onChange={(event) => setSerialQuery(event.target.value)}
                      />
                    </Field>

                    {availableSerials.isLoading ? (
                      <p className="text-sm text-slate-500" role="status">
                        Memuat serial tersedia…
                      </p>
                    ) : availableSerials.isError ? (
                      <Alert tone="danger">{getErrorMessage(availableSerials.error)}</Alert>
                    ) : filteredSerials.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        {asset.stock === 0
                          ? 'Stok aset ini kosong sehingga belum ada serial yang dapat dikeluarkan.'
                          : 'Tidak ada serial tersedia yang cocok. Pastikan barang masuk sudah dicatat.'}
                      </p>
                    ) : (
                      <fieldset>
                        <legend className="sr-only">Pilih serial number yang keluar</legend>
                        <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                          {filteredSerials.map((serial) => {
                            const checked = selectedSerials.includes(serial.id)
                            const full = !checked && selectedSerials.length >= qty

                            return (
                              <label
                                key={serial.id}
                                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm ${
                                  full ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-400 text-primary-700"
                                  checked={checked}
                                  disabled={full}
                                  onChange={() => {
                                    setSerialError(null)
                                    setSelectedSerials((current) =>
                                      checked
                                        ? current.filter((id) => id !== serial.id)
                                        : current.length >= qty
                                          ? current
                                          : [...current, serial.id],
                                    )
                                  }}
                                />
                                <span className="font-mono text-xs text-slate-800">{serial.serial_number}</span>
                                <CheckCircle2
                                  className={`ml-auto h-4 w-4 ${checked ? 'text-emerald-600' : 'text-transparent'}`}
                                  aria-hidden="true"
                                />
                              </label>
                            )
                          })}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Menampilkan {formatNumber(filteredSerials.length)} dari{' '}
                          {formatNumber(availableSerials.data?.meta.total ?? 0)} serial tersedia.
                          {(availableSerials.data?.meta.total ?? 0) > 200
                            ? ' Gunakan pencarian untuk mempersempit pilihan.'
                            : ''}
                        </p>
                      </fieldset>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="Ringkasan" />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs text-slate-500">{kind === 'in' ? 'Barang masuk' : 'Barang keluar'}</p>
                  <p className="text-sm font-semibold text-slate-900">{asset?.name ?? 'Belum dipilih'}</p>
                </div>
              </div>

              {asset ? (
                <>
                  <dl className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Kode</dt>
                      <dd className="font-mono text-xs font-semibold text-slate-900">{asset.code}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Stok saat ini</dt>
                      <dd className="font-semibold text-slate-900 tabular-nums">
                        {formatNumber(asset.stock)} {asset.unit}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Serial</dt>
                      <dd>
                        {asset.has_serial_number ? (
                          <Badge tone="primary">
                            {formatNumber(asset.available_serial_numbers_count ?? 0)} tersedia
                          </Badge>
                        ) : (
                          <span className="text-slate-500">Tidak digunakan</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
                      <dt className="text-slate-500">Stok setelah transaksi</dt>
                      <dd className="font-semibold text-slate-900 tabular-nums">
                        {Number.isFinite(qty)
                          ? formatNumber(
                              kind === 'in' ? asset.stock + qty : asset.stock - Math.max(0, qty),
                            )
                          : '—'}{' '}
                        {asset.unit}
                      </dd>
                    </div>
                  </dl>

                  {asset.is_critical ? (
                    <Alert tone="warning" title="Stok kritis">
                      Stok aset ini berada pada atau di bawah batas minimum.
                    </Alert>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-500">Pilih aset untuk melihat ringkasan stok.</p>
              )}

              {kind === 'out' && asset && qty > asset.stock ? (
                <p className="flex items-start gap-2 text-xs font-medium text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Jumlah keluar melebihi stok tersedia.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Konsekuensi pencatatan" />
            <CardBody className="space-y-2 text-xs leading-5 text-slate-500">
              <p>Saldo stok berubah seketika setelah transaksi tersimpan.</p>
              <p>Transaksi tidak dapat diubah atau dihapus; koreksi dilakukan dengan transaksi lawan.</p>
              <p>Seluruh aksi dicatat pada audit trail beserta identitas pencatat.</p>
              {kind === 'in' && asset?.has_serial_number ? (
                <p className="flex items-start gap-1.5">
                  <Barcode className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Serial number berlaku unik untuk seluruh organisasi.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </aside>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end lg:col-span-2">
          <Link to={copy.back} className={buttonStyles('secondary', 'md')}>
            Batal
          </Link>
          <Button
            type="submit"
            loading={isSubmitting || mutation.isPending}
            disabled={!asset || (kind === 'out' && Boolean(asset && qty > asset.stock))}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Simpan transaksi
          </Button>
        </div>
      </form>
    </>
  )
}
