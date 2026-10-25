export type Role = 'pimpinan' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  role_label: string
  permissions: string[]
  is_active: boolean
  must_change_password: boolean
  last_login_at: string | null
  deactivated_at: string | null
  created_at: string
}

export interface Category {
  id: number
  name: string
  description: string | null
  assets_count?: number
  created_at?: string
  updated_at?: string
}

export interface Asset {
  id: number
  code: string
  name: string
  category_id: number
  category?: Category
  unit: string
  has_serial_number: boolean
  description: string | null
  minimum_stock: number
  stock: number
  is_active: boolean
  is_critical: boolean
  serial_numbers_count?: number
  available_serial_numbers_count?: number
  created_at: string
  updated_at: string
}

export interface AssetDetailTransaction {
  type: 'in' | 'out'
  id: number
  reference: string
  date: string
  qty: number
  party: string
  creator: string | null
}

export interface AssetDetail extends Asset {
  serial_summary: {
    available: number
    out: number
  }
  recent_transactions: AssetDetailTransaction[]
}

export type SerialStatus = 'available' | 'out'

export interface SerialNumber {
  id: number
  serial_number: string
  status: SerialStatus
  status_label: string
  asset_id: number
  asset?: Asset
  asset_in_id: number | null
  asset_out_id: number | null
  created_at: string
}

export interface AssetIn {
  id: number
  reference: string
  asset_id: number
  asset?: Asset
  transaction_date: string
  qty: number
  supplier_or_source: string
  notes: string | null
  created_by: number
  creator?: User
  serial_numbers?: SerialNumber[]
  serial_numbers_count?: number
  created_at: string
}

export interface AssetOut {
  id: number
  reference: string
  asset_id: number
  asset?: Asset
  transaction_date: string
  qty: number
  recipient: string
  notes: string | null
  created_by: number
  creator?: User
  serial_numbers?: SerialNumber[]
  serial_numbers_count?: number
  created_at: string
}

export interface OpnameSummary {
  total: number
  filled: number
  match: number
  more: number
  less: number
}

export interface StockOpnameItem {
  id: number
  asset_id: number
  asset?: Asset
  system_qty_snapshot: number
  physical_qty: number | null
  difference: number | null
  notes: string | null
}

export interface StockOpname {
  id: number
  reference: string
  opname_date: string
  description: string | null
  status: 'draft' | 'finalized'
  status_label: string
  created_by: number
  creator?: User
  approved_by: number | null
  approver?: User
  approved_at: string | null
  items_count?: number
  items?: StockOpnameItem[]
  summary?: OpnameSummary
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: number
  action: string
  entity_type: string | null
  entity_type_short: string | null
  entity_id: number | null
  correlation_id: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  actor?: User
  created_at: string
}

export interface Settings {
  organization_name: string
  organization_short_name: string
  app_name: string
  public_tagline: string
  footer_text: string
  contact_email: string | null
}

export interface DashboardTransaction {
  type: 'in' | 'out'
  reference: string
  date: string
  asset_code: string
  asset_name: string
  qty: number
  unit: string
  party: string
}

export interface DashboardData {
  period: { from: string; to: string }
  totals: {
    assets: number
    active_assets: number
    categories: number
    stock_units: number
    critical_assets: number
    serial_available: number
    serial_out: number
    incoming_qty: number
    incoming_count: number
    outgoing_qty: number
    outgoing_count: number
    pending_opnames: number
  }
  trend: Array<{
    month: string
    label: string
    incoming: number
    outgoing: number
  }>
  critical_stock: Asset[]
  recent_transactions: DashboardTransaction[]
  recent_activity: AuditLog[]
  pending_opname_list: Array<{
    id: number
    reference: string
    opname_date: string
    description: string | null
    creator_name: string | null
  }>
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export interface Paginated<T> {
  data: T[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: PaginationMeta
}

export interface ResourceResponse<T> {
  data: T
  message?: string
}

export interface ReportResponse<T, S> {
  data: T[]
  links?: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: PaginationMeta
  summary: S
  filters: Record<string, string>
}

export interface AssetReportSummary {
  total_assets: number
  total_stock: number
  critical_assets: number
}

export interface TransactionReportSummary {
  transactions: number
  total_qty: number
}

export interface OpnameReportSummary {
  items: number
  match: number
  more: number
  less: number
  net_difference: number
}

export interface StockOpnameReportRow {
  id: number
  opname_id: number
  reference: string
  opname_date: string
  status: 'draft' | 'finalized'
  status_label: string
  approved_by: string | null
  asset_code: string
  asset_name: string
  unit: string
  category: string | null
  system_qty: number
  physical_qty: number | null
  difference: number | null
  notes: string | null
}
