import { ChevronDown, KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { initials } from '../../lib/format'
import { useToast } from '../../lib/toast'
import { pageTitleFor } from './navigation'

export function Topbar({
  onOpenMenu,
  mobileOpen,
  collapsed,
  onToggleSidebar,
}: {
  onOpenMenu: () => void
  mobileOpen: boolean
  collapsed: boolean
  onToggleSidebar: () => void
}) {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [lastPathname, setLastPathname] = useState(pathname)
  const [today] = useState(() =>
    new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date()),
  )
  const menuRef = useRef<HTMLDivElement>(null)

  if (lastPathname !== pathname) {
    setLastPathname(pathname)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      toast('info', 'Anda telah keluar', 'Sesi aplikasi berhasil diakhiri.')
    } catch {
      toast('error', 'Gagal keluar', 'Sesi lokal diakhiri. Silakan periksa koneksi Anda.')
    } finally {
      setLoggingOut(false)
      navigate('/masuk', { replace: true })
    }
  }

  const pageTitle = pageTitleFor(pathname)

  return (
    <header className="app-topbar sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="-ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 lg:hidden"
        aria-label="Buka menu navigasi"
        aria-controls="mobile-navigation"
        aria-expanded={mobileOpen}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onToggleSidebar}
        className="-ml-2 hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 lg:inline-flex"
        aria-label={collapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}
        aria-pressed={collapsed}
        aria-controls="app-sidebar"
        title={collapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link to="/" className="hidden rounded hover:text-primary-800 hover:underline sm:inline">
            Beranda
          </Link>
          <span className="hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="truncate font-medium text-slate-700" aria-current="page">
            {pageTitle}
          </span>
        </nav>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-950 lg:hidden">{pageTitle}</p>
      </div>

      <p className="hidden text-xs text-slate-500 xl:block">{today}</p>

      {user ? (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex min-h-11 items-center gap-2 rounded-lg border border-transparent px-1.5 py-1.5 hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 sm:px-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800">
              {initials(user.name)}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-[150px] truncate text-sm font-semibold text-slate-900">{user.name}</span>
              <span className="block text-xs text-slate-500">{user.role_label}</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true" />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              aria-label="Menu akun"
              className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lift"
            >
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
                <p className="mt-1 text-xs font-medium text-primary-800">{user.role_label}</p>
              </div>
              <div className="p-1.5">
                <Link
                  to="/ubah-sandi"
                  role="menuitem"
                  className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <KeyRound className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  Ubah kata sandi
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {loggingOut ? 'Mengakhiri sesi…' : 'Keluar'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}
