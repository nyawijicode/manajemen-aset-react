import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowRight,
  Barcode,
  Boxes,
  ClipboardCheck,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Form'
import { ApiError, getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useDocumentTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { FullPageLoader } from '../app/guards'

const schema = z.object({
  email: z.string().min(1, 'Email wajib diisi.').email('Format email tidak valid.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
})

type LoginValues = z.infer<typeof schema>

const FEATURES = [
  { icon: Boxes, title: 'Data aset terpusat', text: 'Master aset, kategori, dan satuan yang konsisten.' },
  { icon: Barcode, title: 'Pelacakan per unit', text: 'Serial number unik dengan riwayat masuk dan keluar.' },
  { icon: ClipboardCheck, title: 'Opname terkendali', text: 'Rekonsiliasi stok fisik dengan jejak audit.' },
  { icon: ShieldCheck, title: 'Akses berlapis', text: 'Peran, izin, dan pencatatan aktivitas penting.' },
]

export function LoginPage() {
  useDocumentTitle('Masuk')
  const { login, status, user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  if (status === 'loading') return <FullPageLoader />

  if (user) {
    return <Navigate to={user.must_change_password ? '/ubah-sandi' : '/'} replace />
  }

  const onSubmit = async (values: LoginValues) => {
    setFormError(null)

    try {
      const signedIn = await login(values.email, values.password)
      toast('success', 'Berhasil masuk', `Selamat datang, ${signedIn.name}.`)

      const state = location.state as { from?: string } | null
      const from = state?.from
      const target =
        signedIn.must_change_password
          ? '/ubah-sandi'
          : from && from.startsWith('/') && !from.startsWith('/masuk')
            ? from
            : '/'

      navigate(target, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        for (const [field, messages] of Object.entries(error.errors)) {
          if (field === 'email' || field === 'password') {
            setError(field, { type: 'server', message: messages[0] })
          }
        }
      }

      setFormError(getErrorMessage(error))
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-primary-900 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-28 h-96 w-96 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-primary-800/60"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        <div className="relative">
          <a href="/" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Boxes className="h-6 w-6" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight">Manajemen Aset</span>
              <span className="block text-xs text-primary-200">Sistem manajemen aset</span>
            </span>
          </a>

          <div className="mt-16 max-w-xl xl:mt-20">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-primary-100 ring-1 ring-white/15 ring-inset">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Masuk dengan akun yang terdaftar
            </p>
            <h1 className="mt-5 text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">
              Satu sumber data untuk aset organisasi yang tertib dan dapat diaudit.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-primary-100/90">
              Catat pergerakan aset, pantau stok kritis, dan siapkan laporan tanpa kehilangan jejak
              perubahan.
            </p>
          </div>
        </div>

        <ul className="relative mt-14 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <li key={feature.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <Icon className="h-5 w-5 text-primary-200" aria-hidden="true" />
                <p className="mt-2.5 text-sm font-semibold">{feature.title}</p>
                <p className="mt-1 text-xs leading-5 text-primary-100/80">{feature.text}</p>
              </li>
            )
          })}
        </ul>

        <p className="relative mt-12 text-xs text-primary-200/80">
          Seluruh aktivitas penting dicatat dalam audit trail. Jangan membagikan kredensial akun.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-700 text-white">
              <Boxes className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-bold tracking-tight text-slate-950">Manajemen Aset</p>
              <p className="text-xs text-slate-500">Sistem manajemen aset</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
            <p className="text-xs font-semibold tracking-wider text-primary-700 uppercase">Masuk aplikasi</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Selamat datang kembali
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              Gunakan akun yang telah diberikan oleh Manajer atau administrator sistem.
            </p>

            {formError ? (
              <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                {formError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-5">
              <Field label="Email" htmlFor="login-email" required error={errors.email?.message}>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="nama@example.com"
                  aria-invalid={errors.email ? true : undefined}
                  {...register('email')}
                />
              </Field>

              <Field label="Kata sandi" htmlFor="login-password" required error={errors.password?.message}>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Masukkan kata sandi"
                    className="pr-12"
                    aria-invalid={errors.password ? true : undefined}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </Field>

              <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
                {isSubmitting ? 'Memeriksa akun…' : 'Masuk'}
                {!isSubmitting ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
              </Button>
            </form>

            <p className="mt-5 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
              Lupa kata sandi atau akun terkunci? Hubungi Manajer atau administrator sistem untuk
              pengaturan ulang. Demi keamanan, jangan gunakan akun bersama.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            <a href="/" className="rounded font-medium text-primary-800 hover:underline">
              Kembali ke halaman informasi
            </a>
          </p>
        </div>
      </section>
    </div>
  )
}
