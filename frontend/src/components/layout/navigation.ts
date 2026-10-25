import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Barcode,
  Boxes,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  ScrollText,
  Settings,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  permission: string
  end?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Ringkasan',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'dashboard.view', end: true }],
  },
  {
    title: 'Data Aset',
    items: [
      { label: 'Daftar Aset', to: '/aset', icon: Boxes, permission: 'assets.view' },
      { label: 'Kategori Aset', to: '/kategori', icon: Tags, permission: 'assets.view' },
      { label: 'Serial Number', to: '/serial-number', icon: Barcode, permission: 'serial.view' },
    ],
  },
  {
    title: 'Transaksi',
    items: [
      { label: 'Barang Masuk', to: '/transaksi/masuk', icon: ArrowDownToLine, permission: 'transactions.view' },
      { label: 'Barang Keluar', to: '/transaksi/keluar', icon: ArrowUpFromLine, permission: 'transactions.view' },
    ],
  },
  {
    title: 'Pengawasan',
    items: [
      { label: 'Stock Opname', to: '/stock-opname', icon: ClipboardCheck, permission: 'opname.view' },
      { label: 'Laporan', to: '/laporan/aset', icon: FileBarChart, permission: 'reports.view' },
    ],
  },
  {
    title: 'Administrasi',
    items: [
      { label: 'Pengguna', to: '/pengguna', icon: Users, permission: 'users.manage' },
      { label: 'Audit Trail', to: '/audit', icon: ScrollText, permission: 'audit.view' },
      { label: 'Pengaturan', to: '/pengaturan', icon: Settings, permission: 'settings.manage' },
    ],
  },
]

export function pageTitleFor(pathname: string): string {
  if (pathname === '/aset/baru') return 'Tambah Aset'
  if (/^\/aset\/[^/]+\/ubah$/.test(pathname)) return 'Ubah Aset'
  if (/^\/aset\/[^/]+$/.test(pathname)) return 'Detail Aset'
  if (pathname === '/transaksi/masuk/baru') return 'Catat Barang Masuk'
  if (/^\/transaksi\/masuk\/[^/]+$/.test(pathname)) return 'Detail Barang Masuk'
  if (pathname === '/transaksi/keluar/baru') return 'Catat Barang Keluar'
  if (/^\/transaksi\/keluar\/[^/]+$/.test(pathname)) return 'Detail Barang Keluar'
  if (pathname === '/stock-opname/baru') return 'Buat Stock Opname'
  if (/^\/stock-opname\/[^/]+$/.test(pathname)) return 'Detail Stock Opname'
  if (pathname.startsWith('/laporan/')) {
    const labels: Record<string, string> = {
      '/laporan/aset': 'Laporan Inventaris Aset',
      '/laporan/masuk': 'Laporan Aset Masuk',
      '/laporan/keluar': 'Laporan Aset Keluar',
      '/laporan/opname': 'Laporan Stock Opname',
    }
    return labels[pathname] ?? 'Laporan'
  }

  const items = NAV_GROUPS.flatMap((group) => group.items)
  const match = items
    .filter((item) => (item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0]

  return match?.label ?? 'Halaman'
}
