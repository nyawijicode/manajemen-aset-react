export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly errors?: Record<string, string[]>
  readonly requestId?: string

  constructor(
    message: string,
    status: number,
    options: {
      code?: string
      errors?: Record<string, string[]>
      requestId?: string
    } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = options.code
    this.errors = options.errors
    this.requestId = options.requestId
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  suppressAuthEvent?: boolean
}

interface ErrorBody {
  message?: string
  code?: string
  errors?: Record<string, string[]>
  request_id?: string
}

const BASE = '/api/v1'
let csrfPromise: Promise<void> | null = null

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  const entry = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))

  if (!entry) return null

  try {
    return decodeURIComponent(entry.slice(prefix.length))
  } catch {
    return entry.slice(prefix.length)
  }
}

async function ensureCsrf(): Promise<void> {
  if (readCookie('XSRF-TOKEN')) return

  if (!csrfPromise) {
    csrfPromise = fetch('/sanctum/csrf-cookie', {
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then((response) => {
        if (!response.ok) {
          throw new ApiError('Tidak dapat menyiapkan sesi formulir. Muat ulang halaman.', 0)
        }
      })
      .finally(() => {
        csrfPromise = null
      })
  }

  await csrfPromise
}

function friendlyMessage(status: number, body: ErrorBody | null): string {
  if (status === 419) {
    return 'Sesi formulir telah berakhir. Muat ulang halaman lalu coba lagi.'
  }

  if (status === 429) {
    return body?.message ?? 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.'
  }

  if (status === 401) {
    return 'Sesi Anda telah berakhir. Silakan masuk kembali.'
  }

  return body?.message ?? 'Permintaan tidak dapat diproses. Silakan coba lagi.'
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi Anda, lalu coba lagi.'
  }
  if (error instanceof Error && error.name === 'AbortError') return ''
  return 'Terjadi kendala yang tidak terduga. Silakan coba lagi.'
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const unsafe = method !== 'GET'

  if (unsafe) {
    await ensureCsrf()
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...options.headers,
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const token = readCookie('XSRF-TOKEN')
  if (unsafe && token) {
    headers['X-XSRF-TOKEN'] = token
  }

  let response: Response

  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new TypeError('network')
  }

  let payload: unknown = null

  if (response.status !== 204) {
    const contentType = response.headers.get('Content-Type') ?? ''
    if (contentType.includes('application/json')) {
      payload = await response.json().catch(() => null)
    }
  }

  if (!response.ok) {
    const body = (payload ?? null) as ErrorBody | null
    const error = new ApiError(friendlyMessage(response.status, body), response.status, {
      code: body?.code,
      errors: body?.errors,
      requestId: body?.request_id,
    })

    if (response.status === 401 && !options.suppressAuthEvent) {
      window.dispatchEvent(new CustomEvent('app:unauthorized'))
    }

    if (response.status === 419) {
      csrfPromise = null
    }

    throw error
  }

  return payload as T
}

export function buildQuery(values: Record<string, unknown>): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '' || value === 'all') continue
    if (typeof value === 'boolean') {
      params.set(key, value ? '1' : '0')
    } else {
      params.set(key, String(value))
    }
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null

  const extended = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1])
    } catch {
      return extended[1]
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1] ?? null
}

/**
 * Mengunduh berkas dari API dengan cookie sesi aktif. Dipakai untuk ekspor PDF
 * agar berkas dibuat di server, bukan lewat dialog cetak peramban.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<string> {
  let response: Response

  try {
    response = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/pdf',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
  } catch {
    throw new TypeError('network')
  }

  if (!response.ok) {
    let body: ErrorBody | null = null

    if ((response.headers.get('Content-Type') ?? '').includes('application/json')) {
      body = await response.json().catch(() => null)
    }

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('app:unauthorized'))
    }

    throw new ApiError(friendlyMessage(response.status, body), response.status, {
      code: body?.code,
      errors: body?.errors,
      requestId: body?.request_id,
    })
  }

  const blob = await response.blob()
  const filename = filenameFromDisposition(response.headers.get('Content-Disposition')) ?? fallbackName
  const objectUrl = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)

  return filename
}
