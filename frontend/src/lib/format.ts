const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function monthStartIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

function parseDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  }
  return new Date(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = parseDate(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getDate())} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getDate())} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}.${pad(date.getMinutes())}`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('id-ID').format(value)
}

export function formatDifference(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (value === 0) return '0'
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export const AUDIT_LABELS: Record<string, string> = {
  'auth.login': 'Masuk aplikasi',
  'auth.logout': 'Keluar aplikasi',
  'auth.login_failed': 'Percobaan masuk gagal',
  'auth.password_changed': 'Kata sandi diubah',
  'asset.created': 'Aset ditambahkan',
  'asset.updated': 'Aset diperbarui',
  'asset.activated': 'Aset diaktifkan',
  'asset.archived': 'Aset dinonaktifkan',
  'asset.deleted': 'Aset dihapus',
  'category.created': 'Kategori ditambahkan',
  'category.updated': 'Kategori diperbarui',
  'category.deleted': 'Kategori dihapus',
  'asset_in.created': 'Aset masuk dicatat',
  'asset_out.created': 'Aset keluar dicatat',
  'stock_opname.created': 'Sesi opname dibuat',
  'stock_opname.updated': 'Hasil opname disimpan',
  'stock_opname.finalized': 'Opname disahkan',
  'user.created': 'Pengguna ditambahkan',
  'user.updated': 'Pengguna diperbarui',
  'user.activated': 'Pengguna diaktifkan',
  'user.deactivated': 'Pengguna dinonaktifkan',
  'user.password_reset': 'Kata sandi pengguna direset',
  'settings.updated': 'Pengaturan diperbarui',
}

export function auditActionLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action
}
