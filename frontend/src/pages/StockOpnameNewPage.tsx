import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AssetCombobox } from '../components/ui/AssetCombobox'
import { Button, buttonStyles } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Alert, EmptyState } from '../components/ui/Feedback'
import { Field, Input, Textarea } from '../components/ui/Form'
import { PageHeader } from '../components/ui/PageHeader'
import { TBody, TD, TH, THead, TR, Table } from '../components/ui/Table'
import { ApiError, api, getErrorMessage } from '../lib/api'
import { formatDate, formatNumber, todayIso } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import type { Asset, Paginated, ResourceResponse, StockOpname } from '../types/api'

const schema = z.object({
  opname_date: z
    .string()
    .min(1, 'Tanggal opname wajib diisi.')
    .refine((value) => value <= todayIso(), 'Tanggal opname tidak boleh melebihi hari ini.'),
  description: z.string().max(255, 'Keterangan maksimal 255 karakter.').optional(),
})

type OpnameValues = z.infer<typeof schema>

export function StockOpnameNewPage() {
  useDocumentTitle('Buat Stock Opname')
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [scope, setScope] = useState<'all' | 'selected'>('all')
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [assetError, setAssetError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OpnameValues>({
    resolver: zodResolver(schema),
    defaultValues: { opname_date: todayIso(), description: '' },
  })

  const opnameDate = watch('opname_date')

  const activeCount = useQuery({
    queryKey: ['assets', 'active-count'],
    queryFn: () => api<Paginated<Asset>>('/assets?is_active=true&per_page=1'),
  })

  const mutation = useMutation({
    mutationFn: (values: OpnameValues) =>
      api<ResourceResponse<StockOpname>>('/stock-opnames', {
        method: 'POST',
        body: {
          opname_date: values.opname_date,
          description: values.description?.trim() ? values.description.trim() : null,
          asset_ids: scope === 'selected' ? selectedAssets.map((asset) => asset.id) : [],
        },
      }),
    onSuccess: (response) => {
      toast('success', 'Sesi opname dibuat', `${response.data.reference} siap diisi hasil hitung fisiknya.`)
      void queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(`/stock-opname/${response.data.id}`, { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.errors) {
        for (const [field, messages] of Object.entries(error.errors)) {
          if (field === 'opname_date' || field === 'description') {
            setError(field, { type: 'server', message: messages[0] })
          }
          if (field === 'asset_ids') setAssetError(messages[0])
        }
      }
      setFormError(getErrorMessage(error))
    },
  })

  const onSubmit = (values: OpnameValues) => {
    setFormError(null)
    setAssetError(null)

    if (scope === 'selected' && selectedAssets.length === 0) {
      setAssetError('Pilih minimal satu aset atau gunakan opsi seluruh aset aktif.')
      return
    }

    mutation.mutate(values)
  }

  return (
    <>
      <PageHeader
        title="Buat sesi stock opname"
        description="Tentukan tanggal dan cakupan aset. Saldo sistem akan dicatat sebagai snapshot saat sesi dibuat."
        breadcrumbs={[{ label: 'Stock Opname', to: '/stock-opname' }, { label: 'Buat baru' }]}
        actions={
          <Link to="/stock-opname" className={buttonStyles('secondary', 'md')}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Informasi sesi" description="Tanggal opname dan keterangan tujuan penghitungan." />
            <CardBody className="space-y-5">
              {formError ? (
                <Alert tone="danger" title="Sesi belum dibuat">
                  {formError}
                </Alert>
              ) : null}

              <Field
                label="Tanggal opname"
                htmlFor="opname-date"
                required
                hint="Gunakan tanggal pelaksanaan hitung fisik."
                error={errors.opname_date?.message}
              >
                <Input
                  id="opname-date"
                  type="date"
                  max={todayIso()}
                  aria-invalid={errors.opname_date ? true : undefined}
                  {...register('opname_date')}
                />
              </Field>

              <Field
                label="Keterangan"
                htmlFor="opname-description"
                hint="Opsional. Misalnya opname semester I atau opname gudang utama."
                error={errors.description?.message}
              >
                <Textarea
                  id="opname-description"
                  rows={3}
                  placeholder="Opname rutin akhir semester…"
                  aria-invalid={errors.description ? true : undefined}
                  {...register('description')}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Cakupan aset"
              description="Pilih seluruh aset aktif atau batasi ke aset tertentu."
            />
            <CardBody className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="sr-only">Cakupan aset</legend>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                    scope === 'all' ? 'border-primary-300 bg-primary-50/60' : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="all"
                    checked={scope === 'all'}
                    onChange={() => setScope('all')}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Seluruh aset aktif</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                      {activeCount.isLoading
                        ? 'Menghitung aset aktif…'
                        : `${formatNumber(activeCount.data?.meta.total ?? 0)} aset aktif akan dimasukkan ke sesi ini.`}
                    </span>
                  </span>
                </label>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                    scope === 'selected' ? 'border-primary-300 bg-primary-50/60' : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="selected"
                    checked={scope === 'selected'}
                    onChange={() => setScope('selected')}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Pilih aset tertentu</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                      Cocok untuk opname per gudang, kategori, atau unit kerja.
                    </span>
                  </span>
                </label>
              </fieldset>

              {scope === 'selected' ? (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <Field
                    label="Tambah aset"
                    htmlFor="opname-asset-picker"
                    error={assetError ?? undefined}
                    hint="Cari dan pilih aset aktif. Aset yang sudah dipilih tidak akan ditambahkan dua kali."
                  >
                    <AssetCombobox
                      id="opname-asset-picker"
                      selected={null}
                      onSelect={(asset) => {
                        if (!asset) return
                        setAssetError(null)
                        setSelectedAssets((current) =>
                          current.some((item) => item.id === asset.id) ? current : [...current, asset],
                        )
                      }}
                      invalid={Boolean(assetError)}
                      onlyActive
                      placeholder="Cari kode atau nama aset…"
                    />
                  </Field>

                  {selectedAssets.length === 0 ? (
                    <EmptyState
                      title="Belum ada aset dipilih"
                      description="Gunakan pencarian di atas untuk menambahkan aset ke sesi opname."
                    />
                  ) : (
                    <>
                      <Table caption="Aset terpilih untuk sesi opname" minWidth="min-w-[560px]">
                        <THead>
                          <TR>
                            <TH>Aset</TH>
                            <TH>Kategori</TH>
                            <TH className="text-right">Stok sistem</TH>
                            <TH className="text-right">Aksi</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {selectedAssets.map((asset) => (
                            <TR key={asset.id}>
                              <TD>
                                <span className="block font-medium text-slate-900">{asset.name}</span>
                                <span className="font-mono text-xs text-slate-500">{asset.code}</span>
                              </TD>
                              <TD className="text-sm text-slate-600">{asset.category?.name ?? '—'}</TD>
                              <TD className="text-right tabular-nums">
                                {formatNumber(asset.stock)} {asset.unit}
                              </TD>
                              <TD>
                                <div className="flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-700 hover:bg-red-50"
                                    onClick={() =>
                                      setSelectedAssets((current) =>
                                        current.filter((item) => item.id !== asset.id),
                                      )
                                    }
                                    aria-label={`Hapus ${asset.name} dari daftar`}
                                    title="Hapus dari daftar"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                </div>
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                      <p className="text-xs text-slate-500">
                        {formatNumber(selectedAssets.length)} aset dipilih untuk sesi ini.
                      </p>
                    </>
                  )}
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="Ringkasan sesi" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Tanggal</span>
                <span className="font-medium text-slate-900">{formatDate(opnameDate)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Cakupan</span>
                <span className="font-medium text-slate-900">
                  {scope === 'all' ? 'Seluruh aset aktif' : `${formatNumber(selectedAssets.length)} aset`}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Status awal</span>
                <span className="font-medium text-amber-700">Draf</span>
              </div>
              <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
                Saldo sistem dibekukan sebagai snapshot. Perubahan stok setelah sesi dibuat tidak mengubah
                nilai pembanding pada sesi ini.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Alur opname" />
            <CardBody>
              <ol className="space-y-3 text-xs leading-5 text-slate-600">
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-800">
                    1
                  </span>
                  Buat sesi dan tentukan cakupan aset.
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-800">
                    2
                  </span>
                  Isi jumlah fisik dan catatan per baris.
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-800">
                    3
                  </span>
                  Manajer mengesahkan setelah seluruh baris terisi.
                </li>
              </ol>
            </CardBody>
          </Card>

          <Alert tone="info" title="Stok tidak berubah otomatis">
            Selisih opname tidak mengubah saldo. Catat transaksi koreksi agar perubahan stok tetap memiliki jejak
            audit.
          </Alert>
        </aside>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end lg:col-span-2">
          <Link to="/stock-opname" className={buttonStyles('secondary', 'md')}>
            Batal
          </Link>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Buat sesi opname
          </Button>
        </div>
      </form>
    </>
  )
}
