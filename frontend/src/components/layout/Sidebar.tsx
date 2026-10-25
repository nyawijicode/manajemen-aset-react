import { Boxes, ShieldCheck, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useAuth } from '../../lib/auth'
import { NAV_GROUPS, type NavItem } from './navigation'

function isActive(pathname: string, item: NavItem): boolean {
  if (item.to === '/') return pathname === '/'
  if (item.to === '/laporan/aset') return pathname.startsWith('/laporan')
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function SidebarContent({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const { has } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-slate-200',
          collapsed ? 'justify-center px-2' : 'justify-between gap-3 px-5',
        )}
      >
        <Link
          to="/"
          onClick={onNavigate}
          title={collapsed ? 'Manajemen Aset' : undefined}
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white shadow-sm">
            <Boxes className="h-5 w-5" aria-hidden="true" />
          </span>
          {collapsed ? (
            <span className="sr-only">Manajemen Aset</span>
          ) : (
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-slate-950">
                Manajemen Aset
              </span>
              <span className="block truncate text-xs text-slate-500">Sistem Informasi</span>
            </span>
          )}
        </Link>

        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="-mr-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Tutup menu navigasi"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => has(item.permission))
          if (items.length === 0) return null

          return (
            <div key={group.title} className="mb-5 last:mb-0">
              <p
                className={cn(
                  collapsed
                    ? 'sr-only'
                    : 'px-2.5 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase',
                )}
              >
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item)

                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group flex min-h-10 items-center rounded-lg py-2 text-sm font-medium transition-colors',
                          collapsed ? 'justify-center px-0' : 'gap-3 px-2.5',
                          active
                            ? 'bg-primary-50 text-primary-800'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0',
                            active ? 'text-primary-700' : 'text-slate-400 group-hover:text-slate-600',
                          )}
                          aria-hidden="true"
                        />
                        <span className={collapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className={cn('shrink-0 border-t border-slate-200', collapsed ? 'p-2' : 'p-3')}>
        <div
          title={
            collapsed
              ? 'Sistem manajemen aset. Seluruh akses data dicatat dan dibatasi sesuai peran.'
              : undefined
          }
          className={cn(
            'flex items-start gap-2.5 rounded-lg bg-slate-50 text-xs leading-5 text-slate-500',
            collapsed ? 'justify-center p-2' : 'p-3',
          )}
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          {collapsed ? (
            <span className="sr-only">
              Sistem manajemen aset. Seluruh akses data dicatat dan dibatasi sesuai peran.
            </span>
          ) : (
            <p>Sistem manajemen aset. Seluruh akses data dicatat dan dibatasi sesuai peran.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      id="app-sidebar"
      className={cn(
        'app-sidebar fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white transition-[width] duration-200 ease-out lg:block',
        collapsed ? 'w-[84px]' : 'w-[264px]',
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  )
}
