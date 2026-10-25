import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function FullPageLoader({ label = 'Memuat aplikasi…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <LoaderCircle className="h-7 w-7 animate-spin text-primary-700" aria-hidden="true" />
      <p role="status" className="text-sm font-medium text-slate-600">
        {label}
      </p>
    </div>
  )
}

export function RequireAuth() {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />

  if (!user) {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/masuk" replace state={{ from }} />
  }

  if (user.must_change_password && location.pathname !== '/ubah-sandi') {
    return <Navigate to="/ubah-sandi" replace />
  }

  return <Outlet />
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const { has } = useAuth()

  if (!has(permission)) return <ForbiddenContent />
  return <>{children}</>
}

export function ForbiddenContent() {
  return <ErrorPanel code="403" title="Akses ditolak" description="Anda tidak memiliki akses untuk membuka halaman ini. Hubungi Manajer apabila akses diperlukan." />
}

export function ErrorPanel({
  code,
  title,
  description,
  action,
}: {
  code: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="mx-auto max-w-xl py-8 sm:py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card sm:p-10">
        <p className="font-mono text-sm font-semibold tracking-widest text-primary-700">{code}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {action ?? (
            <a
              href="/app/"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800"
            >
              Kembali ke dashboard
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
