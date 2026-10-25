import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ExternalLink, Globe2, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Alert, ErrorState, LoadingState } from '../components/ui/Feedback'
import { Field, Input, Textarea } from '../components/ui/Form'
import { PageHeader } from '../components/ui/PageHeader'
import { ApiError, api, getErrorMessage } from '../lib/api'
import { useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import type { ResourceResponse, Settings } from '../types/api'

const settingsSchema = z.object({
  organization_name: z
    .string()
    .trim()
    .min(1, 'Nama organisasi wajib diisi.')
    .max(120, 'Nama organisasi maksimal 120 karakter.'),
  organization_short_name: z
    .string()
    .trim()
    .min(1, 'Nama singkat wajib diisi.')
    .max(30, 'Nama singkat maksimal 30 karakter.'),
  app_name: z
    .string()
    .trim()
    .min(1, 'Nama aplikasi wajib diisi.')
    .max(80, 'Nama aplikasi maksimal 80 karakter.'),
  public_tagline: z
    .string()
    .trim()
    .min(1, 'Tagline wajib diisi.')
    .max(200, 'Tagline maksimal 200 karakter.'),
  footer_text: z
    .string()
    .trim()
    .min(1, 'Teks footer wajib diisi.')
    .max(200, 'Teks footer maksimal 200 karakter.'),
  contact_email: z
    .string()
    .trim()
    .max(190, 'Email maksimal 190 karakter.')
    .refine(
      (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      'Format email tidak valid.',
    ),
})

type SettingsValues = z.infer<typeof settingsSchema>

const EMPTY: SettingsValues = {
  organization_name: '',
  organization_short_name: '',
  app_name: '',
  public_tagline: '',
  footer_text: '',
  contact_email: '',
}

function toValues(settings: Settings): SettingsValues {
  return {
    organization_name: settings.organization_name,
    organization_short_name: settings.organization_short_name,
    app_name: settings.app_name,
    public_tagline: settings.public_tagline,
    footer_text: settings.footer_text,
    contact_email: settings.contact_email ?? '',
  }
}

export function SettingsPage() {
  useDocumentTitle('Pengaturan')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<ResourceResponse<Settings>>('/settings'),
  })

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!settings.data) return
    reset(toValues(settings.data.data))
  }, [settings.data, reset])

  const mutation = useMutation({
    mutationFn: (values: SettingsValues) =>
      api<ResourceResponse<Settings>>('/settings', {
        method: 'PUT',
        body: {
          ...values,
          contact_email: values.contact_email.trim() || null,
        },
      }),
    onSuccess: (response) => {
      toast('success', 'Pengaturan disimpan', response.message ?? 'Identitas organisasi berhasil diperbarui.')
      queryClient.setQueryData(['settings'], response)
      reset(toValues(response.data))
      setFormError(null)
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.errors) {
        for (const [field, messages] of Object.entries(error.errors)) {
          if (field in EMPTY) {
            setError(field as keyof SettingsValues, { type: 'server', message: messages[0] })
          }
        }
      }
      setFormError(getErrorMessage(error))
    },
  })

  const preview = watch()
  const initial = (preview.organization_short_name.trim() || 'I').charAt(0).toUpperCase()

  if (settings.isError) {
    return (
      <>
        <PageHeader title="Pengaturan" />
        <Card>
          <ErrorState
            title="Pengaturan belum dapat dimuat"
            description={getErrorMessage(settings.error)}
            onRetry={() => void settings.refetch()}
          />
        </Card>
      </>
    )
  }

  if (settings.isLoading) {
    return (
      <>
        <PageHeader title="Pengaturan" />
        <Card>
          <LoadingState label="Memuat pengaturan organisasi…" />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Atur identitas organisasi, nama aplikasi, dan informasi yang tampil pada halaman publik. Perubahan berlaku setelah disimpan."
        meta={
          <>
            <Badge tone="primary">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
              Halaman publik
            </Badge>
            {isDirty ? <Badge tone="warning">Perubahan belum disimpan</Badge> : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            title="Identitas organisasi"
            description="Isi dengan nama resmi organisasi dan informasi kontak yang dapat dipublikasikan."
          />
          <CardBody>
            {formError ? (
              <div className="mb-5">
                <Alert tone="danger" title="Pengaturan belum dapat disimpan">
                  {formError}
                </Alert>
              </div>
            ) : null}

            <form
              onSubmit={handleSubmit((values) => {
                setFormError(null)
                mutation.mutate(values)
              })}
              noValidate
              className="space-y-5"
            >
              <Field
                label="Nama lengkap organisasi"
                htmlFor="settings-organization"
                required
                error={errors.organization_name?.message}
              >
                <Input
                  id="settings-organization"
                  autoComplete="organization"
                  aria-invalid={errors.organization_name ? true : undefined}
                  {...register('organization_name')}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nama singkat"
                  htmlFor="settings-short-name"
                  required
                  error={errors.organization_short_name?.message}
                  hint="Digunakan pada merek di halaman publik."
                >
                  <Input
                    id="settings-short-name"
                    maxLength={30}
                    aria-invalid={errors.organization_short_name ? true : undefined}
                    {...register('organization_short_name')}
                  />
                </Field>

                <Field
                  label="Nama aplikasi"
                  htmlFor="settings-app-name"
                  required
                  error={errors.app_name?.message}
                  hint="Tampil pada judul halaman dan metadata SEO."
                >
                  <Input
                    id="settings-app-name"
                    aria-invalid={errors.app_name ? true : undefined}
                    {...register('app_name')}
                  />
                </Field>
              </div>

              <Field
                label="Tagline publik"
                htmlFor="settings-tagline"
                required
                error={errors.public_tagline?.message}
                hint="Ringkasan singkat yang tampil pada deskripsi halaman publik."
              >
                <Textarea
                  id="settings-tagline"
                  rows={2}
                  maxLength={200}
                  aria-invalid={errors.public_tagline ? true : undefined}
                  {...register('public_tagline')}
                />
              </Field>

              <Field
                label="Teks footer"
                htmlFor="settings-footer"
                required
                error={errors.footer_text?.message}
                hint="Catatan singkat pada bagian bawah halaman publik dan aplikasi."
              >
                <Textarea
                  id="settings-footer"
                  rows={2}
                  maxLength={200}
                  aria-invalid={errors.footer_text ? true : undefined}
                  {...register('footer_text')}
                />
              </Field>

              <Field
                label="Email kontak"
                htmlFor="settings-email"
                error={errors.contact_email?.message}
                hint="Opsional. Ditampilkan sebagai tautan kontak pada halaman publik."
              >
                <Input
                  id="settings-email"
                  type="email"
                  autoComplete="email"
                  placeholder="kontak@example.com"
                  aria-invalid={errors.contact_email ? true : undefined}
                  {...register('contact_email')}
                />
              </Field>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">
                  Perubahan dicatat pada audit trail beserta nilai sebelum dan sesudahnya.
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    disabled={!isDirty || mutation.isPending}
                    onClick={() => {
                      if (settings.data) reset(toValues(settings.data.data))
                      setFormError(null)
                    }}
                  >
                    Batalkan perubahan
                  </Button>
                  <Button type="submit" loading={mutation.isPending || isSubmitting}>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Simpan pengaturan
                  </Button>
                </div>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Pratinjau halaman publik"
              description="Gambaran informasi yang tampil sebelum pengguna masuk."
            />
            <CardBody>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-700 text-sm font-bold text-white">
                    {initial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {preview.organization_short_name.trim() || 'Nama singkat organisasi'}
                    </p>
                    <p className="text-xs text-slate-500">Manajemen Aset</p>
                  </div>
                </div>

                <p className="mt-4 text-base leading-snug font-semibold tracking-tight text-slate-950">
                  {preview.app_name.trim() || 'Nama aplikasi'}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  {preview.public_tagline.trim() ||
                    'Tagline publik akan tampil pada deskripsi halaman.'}
                </p>

                <div className="mt-4 space-y-1 border-t border-slate-200 pt-3">
                  <p className="text-xs leading-5 font-medium text-slate-700">
                    {preview.organization_name.trim() || 'Nama lengkap organisasi'}
                  </p>
                  <p className="text-xs leading-5 text-slate-500">
                    {preview.footer_text.trim() || 'Teks footer organisasi.'}
                  </p>
                  {preview.contact_email.trim() ? (
                    <p className="text-xs font-medium text-primary-800">{preview.contact_email.trim()}</p>
                  ) : null}
                </div>
              </div>

              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Buka halaman publik
              </a>
              <p className="mt-2 text-center text-xs text-slate-500">
                Halaman publik dibuka pada tab baru.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Batasan publikasi" />
            <CardBody className="space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <p className="text-sm leading-6 text-slate-600">
                  Halaman publik hanya memuat identitas organisasi. Data aset, transaksi, pengguna,
                  dan laporan tetap berada di balik autentikasi.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <p className="text-sm leading-6 text-slate-600">
                  Gunakan nama resmi dan alamat email organisasi. Hindari mencantumkan informasi
                  pribadi anggota tim.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
