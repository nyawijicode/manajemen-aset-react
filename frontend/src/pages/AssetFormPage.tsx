import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Info, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Alert } from '../components/ui/Feedback'
import { PageHeader } from '../components/ui/PageHeader'
import { Button, buttonStyles } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Checkbox, Field, Input, Select, Textarea } from '../components/ui/Form'
import { ApiError, api, getErrorMessage } from '../lib/api'
import { formatNumber } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import type { AssetDetail, Category, Paginated, ResourceResponse } from '../types/api'

const schema = z.object({
  code: z
    .string()
    .min(1, 'Kode aset wajib diisi.')
    .max(40, 'Kode aset maksimal 40 karakter.')
    .regex(/^[A-Z0-9][A-Z0-9._\-/]*$/, 'Gunakan huruf besar, angka, titik, garis bawah, strip, atau garis miring.'),
  name: z.string().min(1, 'Nama aset wajib diisi.').max(180, 'Nama aset maksimal 180 karakter.'),
  category_id: z.string().min(1, 'Pilih kategori aset.'),
  unit: z.string().min(1, 'Satuan wajib diisi.').max(30, 'Satuan maksimal 30 karakter.'),
  has_serial_number: z.boolean(),
  minimum_stock: z
    .number({ error: 'Stok minimum wajib berupa angka.' })
    .int('Stok minimum harus bilangan bulat.')
    .min(0, 'Stok minimum tidak boleh negatif.')
    .max(1_000_000_000, 'Stok minimum terlalu besar.'),
  description: z.string().max(2000, 'Keterangan maksimal 2.000 karakter.').optional(),
})

type AssetValues = z.infer<typeof schema>

const KNOWN_FIELDS = ['code', 'name', 'category_id', 'unit', 'has_serial_number', 'minimum_stock', 'description'] as const

export function AssetFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const isEdit = mode === 'edit'
  useDocumentTitle(isEdit ? 'Ubah Aset' : 'Tambah Aset')
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)

  const categories = useQuery({
    queryKey: ['categories', 'options'],
    queryFn: () => api<Paginated<Category>>('/categories?per_page=100'),
    staleTime: 60_000,
  })

  const detail = useQuery({
    queryKey: ['asset', id],
    queryFn: () => api<ResourceResponse<AssetDetail>>(`/assets/${id}`),
    enabled: isEdit && Boolean(id),
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AssetValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      category_id: '',
      unit: '',
      has_serial_number: false,
      minimum_stock: 0,
      description: '',
    },
  })

  const asset = detail.data?.data
  const serialLocked = Boolean(asset && (asset.serial_numbers_count ?? 0) > 0)

  useEffect(() => {
    if (!asset) return

    reset({
      code: asset.code,
      name: asset.name,
      category_id: String(asset.category_id),
      unit: asset.unit,
      has_serial_number: asset.has_serial_number,
      minimum_stock: asset.minimum_stock,
      description: asset.description ?? '',
    })
  }, [asset, reset])

  const mutation = useMutation({
    mutationFn: (values: AssetValues) => {
      const body = {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        category_id: Number(values.category_id),
        unit: values.unit.trim(),
        has_serial_number: values.has_serial_number,
        minimum_stock: values.minimum_stock,
        description: values.description?.trim() ? values.description.trim() : null,
      }

      return isEdit
        ? api<ResourceResponse<AssetDetail>>(`/assets/${id}`, { method: 'PUT', body })
        : api<ResourceResponse<AssetDetail>>('/assets', { method: 'POST', body })
    },
    onSuccess: (response) => {
      toast(
        'success',
        isEdit ? 'Data aset diperbarui' : 'Aset ditambahkan',
        isEdit
          ? 'Perubahan data master aset telah disimpan.'
          : `Aset ${response.data.code} — ${response.data.name} berhasil ditambahkan.`,
      )
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
      void queryClient.invalidateQueries({ queryKey: ['asset', String(response.data.id)] })
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['asset-picker'] })
      navigate(`/aset/${response.data.id}`, { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.errors) {
        for (const [field, messages] of Object.entries(error.errors)) {
          if ((KNOWN_FIELDS as readonly string[]).includes(field)) {
            setError(field as (typeof KNOWN_FIELDS)[number], { type: 'server', message: messages[0] })
          }
        }
      }
      setFormError(getErrorMessage(error))
    },
  })

  const onSubmit = (values: AssetValues) => {
    setFormError(null)
    mutation.mutate(values)
  }

  const serialValue = watch('has_serial_number')

  if (isEdit && detail.isLoading) {
    return (
      <>
        <PageHeader
          title="Ubah aset"
          breadcrumbs={[{ label: 'Daftar Aset', to: '/aset' }, { label: 'Memuat…' }]}
        />
        <Card>
          <div className="space-y-4 p-5" aria-busy="true" aria-label="Memuat data aset">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </Card>
      </>
    )
  }

  if (isEdit && detail.isError) {
    return (
      <>
        <PageHeader title="Ubah aset" breadcrumbs={[{ label: 'Daftar Aset', to: '/aset' }]} />
        <Alert tone="danger" title="Data aset belum dapat dimuat">
          {getErrorMessage(detail.error)}
        </Alert>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={isEdit ? `Ubah ${asset?.name ?? 'aset'}` : 'Tambah aset'}
        description={
          isEdit
            ? 'Perbarui data master aset. Stok dan serial number hanya dapat berubah melalui transaksi masuk atau keluar.'
            : 'Lengkapi data master aset. Saldo stok awal diisi melalui transaksi barang masuk.'
        }
        breadcrumbs={[
          { label: 'Daftar Aset', to: '/aset' },
          ...(isEdit && asset ? [{ label: asset.code, to: `/aset/${asset.id}` }] : []),
          { label: isEdit ? 'Ubah' : 'Tambah' },
        ]}
        actions={
          <Link to={isEdit && asset ? `/aset/${asset.id}` : '/aset'} className={buttonStyles('secondary', 'md')}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Batal
          </Link>
        }
      />

      {formError ? (
        <div className="mb-4">
          <Alert tone="danger" title="Data belum tersimpan">
            {formError}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Identitas aset" description="Informasi dasar yang digunakan pada seluruh transaksi dan laporan." />
          <CardBody className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Kode aset"
                htmlFor="asset-code"
                required
                hint="Contoh: ATK-001 atau ELK/2026/001. Kode harus unik."
                error={errors.code?.message}
              >
                <Input
                  id="asset-code"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ATK-001"
                  className="font-mono uppercase"
                  aria-invalid={errors.code ? true : undefined}
                  {...register('code')}
                />
              </Field>

              <Field label="Nama aset" htmlFor="asset-name" required error={errors.name?.message}>
                <Input
                  id="asset-name"
                  autoComplete="off"
                  placeholder="Kertas HVS A4"
                  aria-invalid={errors.name ? true : undefined}
                  {...register('name')}
                />
              </Field>

              <Field label="Kategori" htmlFor="asset-category" required error={errors.category_id?.message}>
                <Select
                  id="asset-category"
                  aria-invalid={errors.category_id ? true : undefined}
                  {...register('category_id')}
                >
                  <option value="">Pilih kategori</option>
                  {categories.data?.data.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Satuan"
                htmlFor="asset-unit"
                required
                hint="Satuan terkecil yang dipakai, misalnya rim, unit, atau buah."
                error={errors.unit?.message}
              >
                <Input
                  id="asset-unit"
                  autoComplete="off"
                  placeholder="rim"
                  aria-invalid={errors.unit ? true : undefined}
                  {...register('unit')}
                />
              </Field>

              <Field
                label="Stok minimum"
                htmlFor="asset-minimum"
                required
                hint="Dipakai untuk menandai stok kritis pada dashboard."
                error={errors.minimum_stock?.message}
              >
                <Input
                  id="asset-minimum"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  aria-invalid={errors.minimum_stock ? true : undefined}
                  {...register('minimum_stock', { valueAsNumber: true })}
                />
              </Field>
            </div>

            <Field
              label="Keterangan"
              htmlFor="asset-description"
              hint="Opsional. Jelaskan spesifikasi atau catatan penting lainnya."
              error={errors.description?.message}
            >
              <Textarea
                id="asset-description"
                rows={4}
                placeholder="Spesifikasi, merek, atau catatan pengadaan…"
                aria-invalid={errors.description ? true : undefined}
                {...register('description')}
              />
            </Field>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Pelacakan serial" />
            <CardBody className="space-y-3">
              <Checkbox
                label="Gunakan serial number"
                description="Setiap unit dicatat dengan nomor unik dan dapat dilacak saat keluar."
                disabled={serialLocked}
                {...register('has_serial_number')}
              />
              {serialLocked ? (
                <Alert tone="warning">
                  Pengaturan serial tidak dapat diubah karena aset sudah memiliki riwayat transaksi atau serial
                  number.
                </Alert>
              ) : serialValue ? (
                <p className="text-xs leading-5 text-slate-500">
                  Jumlah serial number saat barang masuk harus sama dengan kuantitas. Serial number berlaku unik
                  untuk seluruh organisasi.
                </p>
              ) : (
                <p className="text-xs leading-5 text-slate-500">
                  Tanpa serial number, stok dicatat sebagai saldo agregat per satuan.
                </p>
              )}
            </CardBody>
          </Card>

          {isEdit && asset ? (
            <Card>
              <CardHeader title="Kondisi saat ini" />
              <CardBody className="space-y-2 text-sm text-slate-600">
                <p className="flex items-center justify-between gap-3">
                  <span>Stok</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatNumber(asset.stock)} {asset.unit}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span>Serial tersedia</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatNumber(asset.serial_summary.available)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span>Status</span>
                  <span className="font-semibold text-slate-900">{asset.is_active ? 'Aktif' : 'Nonaktif'}</span>
                </p>
                <p className="flex gap-2 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Stok tidak dapat diubah langsung dari formulir ini. Gunakan transaksi masuk atau keluar agar
                  jejak audit tetap utuh.
                </p>
              </CardBody>
            </Card>
          ) : (
            <Alert tone="info" title="Stok awal">
              Aset baru dimulai dengan stok 0. Catat barang masuk setelah data master tersimpan.
            </Alert>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end lg:col-span-2">
          <Link to={isEdit && asset ? `/aset/${asset.id}` : '/aset'} className={buttonStyles('secondary', 'md')}>
            Batal
          </Link>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {isEdit ? 'Simpan perubahan' : 'Simpan aset'}
          </Button>
        </div>
      </form>
    </>
  )
}
