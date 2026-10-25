import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Boxes, Check, KeyRound, LogOut, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Form'
import { ApiError, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'

const schema = z
  .object({
    current_password: z.string().min(1, 'Kata sandi saat ini wajib diisi.'),
    password: z
      .string()
      .min(12, 'Kata sandi minimal 12 karakter.')
      .regex(/[a-z]/, 'Kata sandi harus memuat huruf kecil.')
      .regex(/[A-Z]/, 'Kata sandi harus memuat huruf besar.')
      .regex(/[0-9]/, 'Kata sandi harus memuat angka.')
      .regex(/[^A-Za-z0-9]/, 'Kata sandi harus memuat simbol.'),
    password_confirmation: z.string().min(1, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Konfirmasi kata sandi belum sama.',
  })
  .refine((values) => values.password !== values.current_password, {
    path: ['password'],
    message: 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
  })

type PasswordValues = z.infer<typeof schema>

export function ChangePasswordPage() {
  useDocumentTitle('Ubah Kata Sandi')
  const { user, changePassword, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const forced = user?.must_change_password ?? false
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  })

  const password = watch('password')
  const requirements = [
    { label: 'Minimal 12 karakter', met: password.length >= 12 },
    { label: 'Mengandung huruf kecil dan besar', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'Mengandung angka', met: /[0-9]/.test(password) },
    { label: 'Mengandung simbol', met: /[^A-Za-z0-9]/.test(password) },
  ]

  const onSubmit = async (values: PasswordValues) => {
    setFormError(null)
    try {
      await changePassword(values)
      toast('success', 'Kata sandi diperbarui', 'Gunakan kata sandi baru pada sesi berikutnya.')
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        for (const [field, messages] of Object.entries(error.errors)) {
          if (field === 'current_password' || field === 'password') {
            setError(field, { type: 'server', message: messages[0] })
          }
        }
      }
      setFormError(getErrorMessage(error))
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 rounded-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-700 text-white">
            <Boxes className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-bold text-slate-950">Manajemen Aset</span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await logout()
            navigate('/masuk', { replace: true })
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Keluar
        </Button>
      </div>

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                  Ubah kata sandi
                </h1>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {forced
                    ? 'Untuk keamanan akun, ganti kata sandi awal sebelum melanjutkan ke aplikasi.'
                    : 'Gunakan kata sandi yang kuat dan tidak dipakai pada layanan lain.'}
                </p>
              </div>
            </div>

            {forced ? (
              <div
                role="status"
                className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-6 text-amber-900"
              >
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p>Kata sandi awal bersifat sementara. Akses modul lain baru terbuka setelah kata sandi diganti.</p>
              </div>
            ) : null}

            {formError ? (
              <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-6 text-red-800">
                {formError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-5">
              <Field
                label="Kata sandi saat ini"
                htmlFor="current-password"
                required
                error={errors.current_password?.message}
              >
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.current_password ? true : undefined}
                  {...register('current_password')}
                />
              </Field>

              <Field label="Kata sandi baru" htmlFor="new-password" required error={errors.password?.message}>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={errors.password ? true : undefined}
                  {...register('password')}
                />
              </Field>

              <Field
                label="Ulangi kata sandi baru"
                htmlFor="confirm-password"
                required
                error={errors.password_confirmation?.message}
              >
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={errors.password_confirmation ? true : undefined}
                  {...register('password_confirmation')}
                />
              </Field>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                {!forced ? (
                  <Button variant="secondary" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Kembali
                  </Button>
                ) : null}
                <Button type="submit" loading={isSubmitting}>
                  Simpan kata sandi
                </Button>
              </div>
            </form>
          </div>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-slate-900">Persyaratan kata sandi</h2>
            <ul className="mt-3 space-y-2.5">
              {requirements.map((requirement) => (
                <li key={requirement.label} className="flex items-start gap-2 text-sm leading-5">
                  <span
                    className={
                      requirement.met
                        ? 'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700'
                        : 'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400'
                    }
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                  <span className={requirement.met ? 'text-slate-700' : 'text-slate-500'}>
                    {requirement.label}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
              Jangan bagikan kata sandi. Setiap perubahan kata sandi dicatat pada audit trail.
            </p>
          </aside>
        </div>
      </main>
    </div>
  )
}
