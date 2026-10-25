import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar, SidebarContent } from '../components/layout/Sidebar'
import { Topbar } from '../components/layout/Topbar'
import { LoadingState } from '../components/ui/Feedback'

const SIDEBAR_STORAGE_KEY = 'aset.sidebar.collapsed'

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsedPreference)
  const { pathname } = useLocation()
  const [lastPathname, setLastPathname] = useState(pathname)

  if (lastPathname !== pathname) {
    setLastPathname(pathname)
    setMobileOpen(false)
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // Preferensi tetap berlaku pada sesi ini bila penyimpanan diblokir.
    }
  }, [collapsed])

  useEffect(() => {
    if (!mobileOpen) return

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="app-skip-link sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-800 focus:shadow-lg focus:ring-2 focus:ring-primary-700"
      >
        Lewati ke konten utama
      </a>

      <Sidebar collapsed={collapsed} />

      {mobileOpen ? (
        <div className="lg:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-slate-950/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Tutup menu navigasi"
            tabIndex={-1}
          />
          <aside
            id="mobile-navigation"
            className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r border-slate-200 bg-white shadow-2xl"
            aria-label="Navigasi seluler"
          >
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div
        className={`transition-[padding] duration-200 ease-out ${
          collapsed ? 'lg:pl-[84px]' : 'lg:pl-[264px]'
        }`}
      >
        <Topbar
          onOpenMenu={() => setMobileOpen(true)}
          mobileOpen={mobileOpen}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((value) => !value)}
        />

        <main id="main-content" className="app-main mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="app-content">
            <Suspense
              fallback={
                <div className="rounded-xl border border-slate-200 bg-white shadow-card">
                  <LoadingState label="Memuat halaman…" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>

        <footer className="app-footer border-t border-slate-200 px-4 py-5 text-center text-xs leading-5 text-slate-500 sm:px-6 lg:px-8">
          Sistem manajemen aset untuk organisasi, kampus, dan tim kerja.
        </footer>
      </div>
    </div>
  )
}
