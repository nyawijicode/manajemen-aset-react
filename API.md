# Referensi API

API internal untuk SPA. Semua endpoint berada di bawah `/api/v1` dan memakai **sesi cookie Sanctum**, bukan bearer token. API tidak untuk konsumen publik dan seluruh respons bertanda `noindex`.

## 1. Autentikasi

Alur yang benar:

1. Panggil `GET /sanctum/csrf-cookie` dengan credentials.
2. Baca cookie `XSRF-TOKEN`, lalu kirim nilainya sebagai header `X-XSRF-TOKEN` pada request tidak aman.
3. `POST /api/v1/auth/login`.
4. Setelah login, sesi diregenerasi. Baca ulang cookie `XSRF-TOKEN` sebelum request berikutnya.
5. Selalu kirim cookie dengan `credentials: 'include'` dan header `Accept: application/json`.

Contoh JavaScript:

```js
await fetch('/sanctum/csrf-cookie', { credentials: 'include' })

function xsrfToken() {
  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith('XSRF-TOKEN='))
    ?.slice('XSRF-TOKEN='.length)

  return raw ? decodeURIComponent(raw) : ''
}

await fetch('/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-XSRF-TOKEN': xsrfToken(),
  },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'KataSandiYangKuat#2026',
  }),
})
```

Header umum:

| Header | Wajib | Keterangan |
| --- | :---: | --- |
| `Accept: application/json` | Ya | Memastikan error dalam format JSON |
| `X-Requested-With: XMLHttpRequest` | Ya | Konsisten dengan SPA |
| `X-XSRF-TOKEN` | Untuk POST/PUT/PATCH/DELETE | Diambil dari cookie |
| `Content-Type: application/json` | Bila ada body | — |
| `Idempotency-Key` | Opsional | Hanya untuk transaksi masuk/keluar; 8–80 karakter `A-Z a-z 0-9 . _ -` |
| `X-Request-ID` | Opsional | 8–64 karakter `A-Z a-z 0-9 . _ -`; jika tidak valid, server membuat UUID |

Request stateful harus berasal dari origin yang terdaftar di `SANCTUM_STATEFUL_DOMAINS`. Login dari klien non-sesi ditolak `422`.

## 2. Format Respons

Sumber daya tunggal:

```json
{
  "message": "Data aset berhasil diperbarui.",
  "data": { "id": 12, "code": "AST-001", "name": "Laptop" }
}
```

Daftar dengan paginasi Laravel:

```json
{
  "data": [],
  "links": {
    "first": "http://localhost:8000/api/v1/assets?page=1",
    "last": "http://localhost:8000/api/v1/assets?page=3",
    "prev": null,
    "next": "http://localhost:8000/api/v1/assets?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 3,
    "per_page": 15,
    "to": 15,
    "total": 42
  }
}
```

Laporan menambahkan `summary` dan `filters` di level atas. Laporan stock opname memakai `meta` kustom (`current_page`, `last_page`, `per_page`, `total`) tanpa `links`; klien menormalkannya sendiri.

Error:

```json
{
  "message": "Data yang dikirim tidak valid.",
  "errors": {
    "qty": ["Jumlah minimal 1."]
  },
  "code": "VALIDATION_ERROR",
  "request_id": "8f0c2f4e-6d30-4c1b-a1b2-3c4d5e6f7a8b"
}
```

| Status | `code` umum | Arti |
| --- | --- | --- |
| `200` | — | Berhasil; replay idempotent juga `200` |
| `201` | — | Sumber daya baru dibuat |
| `401` | `UNAUTHENTICATED`, `ACCOUNT_INACTIVE` | Belum login atau akun dinonaktifkan |
| `403` | `FORBIDDEN` | Izin tidak cukup |
| `404` | `NOT_FOUND` | Data tidak ditemukan |
| `409` | `PASSWORD_CHANGE_REQUIRED`, atau pesan konflik stok/status | Konflik aturan bisnis |
| `419` | `REQUEST_REJECTED` | Token CSRF tidak ada/kedaluwarsa |
| `422` | `VALIDATION_ERROR` | Validasi gagal, termasuk login salah |
| `429` | `TOO_MANY_REQUESTS` | Rate limit; lihat `Retry-After` |
| `500` | `SERVER_ERROR` | Kesalahan server; detail hanya di log |

Selalu sertakan `request_id` saat melaporkan masalah.

## 3. Izin Endpoint

| Endpoint | Izin |
| --- | --- |
| `GET /dashboard` | `dashboard.view` |
| `GET /categories` | `assets.view` |
| `POST/PUT/DELETE /categories...` | `categories.manage` |
| `GET /assets...` | `assets.view` |
| `POST/PUT/PATCH/DELETE /assets...` | `assets.manage` |
| `GET /serial-numbers` | `serial.view` |
| `GET /asset-ins`, `GET /asset-outs` | `transactions.view` |
| `POST /asset-ins`, `POST /asset-outs` | `transactions.create` |
| `GET /stock-opnames...` | `opname.view` |
| `POST/PUT /stock-opnames...` | `opname.manage` |
| `POST /stock-opnames/{id}/finalize` | `opname.approve` |
| `GET /reports/*` | `reports.view` |
| `GET /users...` | `users.manage` |
| `POST/PUT/PATCH /users...`, reset sandi | `users.manage` |
| `GET /audit-logs` | `audit.view` |
| `GET/PUT /settings` | `settings.manage` |

Manajer memiliki seluruh izin. Admin tidak memiliki `assets.manage`, `categories.manage`, `opname.approve`, `users.manage`, `audit.view`, dan `settings.manage`.

## 4. Autentikasi dan Profil

### `POST /auth/login`

Publik, rate limit ketat. Body:

```json
{
  "email": "admin@example.com",
  "password": "KataSandiYangKuat#2026"
}
```

Respons `200` berisi `message` dan `data` pengguna (termasuk `permissions`, `must_change_password`). Pesan gagal login selalu generik. Bila `must_change_password=true`, endpoint operasional berikutnya mengembalikan `409` sampai sandi diganti.

### `GET /auth/me`

Mengembalikan pengguna aktif. Tetap dapat diakses saat `must_change_password=true`.

### `POST /auth/logout`

Menghapus autentikasi, menginvalidasi sesi, dan meregenerasi token CSRF.

### `PUT /auth/password`

Izin: pengguna login. Rate limit `sensitive`.

```json
{
  "current_password": "SandiLama#2026",
  "password": "SandiBaru#2026",
  "password_confirmation": "SandiBaru#2026"
}
```

Sandi baru minimal 12 karakter, harus berbeda dari sandi saat ini, serta memuat huruf besar, huruf kecil, angka, dan simbol. Berhasil mengganti juga menghapus flag `must_change_password`.

## 5. Dasbor

### `GET /dashboard?from=2026-10-01&to=2026-10-31`

Kedua parameter opsional; default awal bulan sampai hari ini. `to` harus ≥ `from`.

Respons `data`:

- `period.from`, `period.to`
- `totals`: `assets`, `active_assets`, `categories`, `stock_units`, `critical_assets`, `serial_available`, `serial_out`, `incoming_qty`, `incoming_count`, `outgoing_qty`, `outgoing_count`, `pending_opnames`
- `trend`: enam bulan terakhir, `{ month, label, incoming, outgoing }`
- `critical_stock`: maksimal 6 aset
- `recent_transactions`: maksimal 8
- `recent_activity`: maksimal 8, hanya untuk yang punya `audit.view`; jika tidak, array kosong
- `pending_opname_list`: maksimal 5 draft

## 6. Kategori

| Method | Path | Keterangan |
| --- | --- | --- |
| `GET` | `/categories?q=&per_page=` | Default 50, maksimal 100 |
| `POST` | `/categories` | `201` |
| `PUT` | `/categories/{id}` | — |
| `DELETE` | `/categories/{id}` | `409` bila masih dipakai aset |

Body:

```json
{
  "name": "Elektronik dan Komputer",
  "description": "Perangkat komputer dan elektronik kantor."
}
```

`name` wajib, maksimal 120, unik. `description` opsional, maksimal 1.000.

## 7. Aset

### `GET /assets`

Query:

| Parameter | Nilai | Default |
| --- | --- | --- |
| `q` | Cari kode/nama, maksimal 120 | — |
| `category_id` | ID kategori valid | — |
| `has_serial_number` | `1`/`0` | — |
| `is_active` | `1`/`0` | — |
| `stock_status` | `critical`, `empty`, `normal`, `all` | `all` |
| `sort` | `code`, `name`, `stock`, `updated_at`, `created_at` | `code` |
| `direction` | `asc`, `desc` | `asc` |
| `per_page` | 1–100 | 15 |

`critical` = `minimum_stock > 0` dan `stock <= minimum_stock`. `empty` = `stock = 0`. `normal` = `stock > 0` dan tidak kritis.

### `GET /assets/{id}`

Menambahkan `serial_summary` (`available`, `out`) dan maksimal 8 `recent_transactions`.

### `POST /assets` dan `PUT /assets/{id}`

```json
{
  "code": "AST-ELK-001",
  "name": "Laptop Kantor",
  "category_id": 1,
  "unit": "unit",
  "has_serial_number": true,
  "description": "Laptop untuk staf.",
  "minimum_stock": 2,
  "is_active": true
}
```

- `code` wajib, maksimal 40, unik, pola `^[A-Z0-9][A-Z0-9._\-\/]*$`; server mengubahnya menjadi huruf besar.
- `name` maksimal 180, `unit` maksimal 30, `description` maksimal 2.000.
- `minimum_stock` 0–1.000.000.000.
- `has_serial_number` tidak dapat diubah jika aset sudah memiliki riwayat transaksi/serial (`409`).
- `POST` mengembalikan `201`.

### `PATCH /assets/{id}/status`

```json
{ "is_active": false }
```

Menonaktifkan aset agar tidak menerima transaksi baru tanpa menghapus riwayat.

### `DELETE /assets/{id}`

Hanya untuk aset tanpa riwayat transaksi/serial. Jika ada riwayat, `409`; gunakan penonaktifan.

### `GET /assets/{id}/serial-numbers`

Query: `status=available|out|all`, `q`, `per_page` 1–200 (default 50).

### `GET /serial-numbers`

Query: `q`, `asset_id`, `status=available|out|all`, `per_page` 1–200 (default 25).

## 8. Transaksi Masuk

### `GET /asset-ins`

Query: `q` (referensi/sumber), `asset_id`, `date_from`, `date_to`, `per_page` 1–100 (default 15). `date_to` harus ≥ `date_from`.

### `GET /asset-ins/{id}`

Mengembalikan transaksi beserta aset, pembuat, dan serial number.

### `POST /asset-ins`

```json
{
  "asset_id": 12,
  "transaction_date": "2026-10-25",
  "qty": 2,
  "supplier_or_source": "PT Sumber Komputer",
  "notes": "Pengadaan rutin",
  "serial_numbers": ["SN-AAA-001", "SN-AAA-002"]
}
```

Header opsional:

```text
Idempotency-Key: in-2026-10-25-001
```

Aturan:

- `transaction_date` wajib, tidak boleh melebihi hari ini.
- `qty` 1–10.000.
- `serial_numbers` wajib berjumlah sama dengan `qty` bila aset memakai serial; harus kosong bila tidak.
- Serial dinormalisasi ke huruf besar dan unik global.
- Aset nonaktif ditolak `409`.
- Respons baru: `201`. Replay dengan `Idempotency-Key` yang sama: `200` dan transaksi lama.
- Transaksi tidak memiliki endpoint ubah/hapus.

## 9. Transaksi Keluar

### `GET /asset-outs`

Query: `q` (referensi/penerima), `asset_id`, `date_from`, `date_to`, `per_page` 1–100.

### `GET /asset-outs/{id}`

Detail transaksi keluar.

### `POST /asset-outs`

```json
{
  "asset_id": 12,
  "transaction_date": "2026-10-25",
  "qty": 2,
  "recipient": "Divisi Umum",
  "notes": "Distribusi perangkat",
  "serial_ids": [31, 32]
}
```

Aturan:

- `qty` tidak boleh melebihi stok; pelanggaran `409`.
- Bila aset memakai serial, `serial_ids` harus tepat sebanyak `qty`, milik aset tersebut, dan berstatus `available`.
- Serial yang dipakai berubah menjadi `out` dan tidak dapat dipakai lagi.
- Aset nonaktif ditolak `409`.
- `201` untuk transaksi baru; replay idempotent `200`.

## 10. Stock Opname

### `GET /stock-opnames`

Query: `q`, `status=draft|finalized|all`, `date_from`, `date_to`, `per_page` 1–100 (default 15).

### `GET /stock-opnames/{id}`

Mengembalikan header, `items`, dan `summary` (`total`, `filled`, `match`, `more`, `less`).

### `POST /stock-opnames`

```json
{
  "opname_date": "2026-10-25",
  "description": "Opname akhir bulan",
  "asset_ids": [1, 2, 3]
}
```

- `asset_ids` opsional. Jika kosong, seluruh aset aktif dimasukkan.
- Snapshot `system_qty_snapshot` diambil saat pembuatan dan tidak berubah oleh transaksi berikutnya.
- Tidak ada aset valid → `422`.
- Respons `201`.

### `PUT /stock-opnames/{id}`

Hanya untuk status `draft`; yang sudah disahkan `409`.

```json
{
  "opname_date": "2026-10-25",
  "description": "Revisi keterangan",
  "items": [
    { "id": 101, "physical_qty": 8, "notes": "Sesuai" },
    { "id": 102, "physical_qty": 4, "notes": "Kurang 1" }
  ]
}
```

`difference = physical_qty - system_qty_snapshot` dihitung server. `id` harus milik sesi tersebut. Semua field opsional, tetapi item yang dikirim harus valid.

### `POST /stock-opnames/{id}/finalize`

Hanya Manajer (`opname.approve`). Semua baris wajib memiliki `physical_qty`, jika tidak `422`. Finalisasi mengunci sesi dan **tidak mengubah stok**. Respons menjelaskan bahwa penyesuaian harus lewat transaksi.

## 11. Laporan

Semua laporan memakai izin `reports.view`, mendukung `per_page` sampai **1.000** (default 100), dan menambahkan `summary` serta `filters`.

| Endpoint | Filter | Summary |
| --- | --- | --- |
| `GET /reports/assets` | `q`, `category_id`, `has_serial_number`, `stock_status`, `is_active`, `per_page` | `total_assets`, `total_stock`, `critical_assets` |
| `GET /reports/asset-ins` | `q`, `asset_id`, `date_from`, `date_to`, `per_page` | `transactions`, `total_qty` |
| `GET /reports/asset-outs` | `q`, `asset_id`, `date_from`, `date_to`, `per_page` | `transactions`, `total_qty` |
| `GET /reports/stock-opnames` | `stock_opname_id`, `status`, `date_from`, `date_to`, `per_page` | `items`, `match`, `more`, `less`, `net_difference` |

Laporan stock opname mengembalikan baris item, bukan header sesi.

### `GET /reports/*/pdf`

Empat endpoint ekspor PDF dibuat di server (bukan dialog cetak peramban). Tata letak, ringkasan, filter aktif, dan nomor halaman dihasilkan oleh server sehingga hasilnya konsisten di semua perangkat.

| Endpoint | Filter | Nama berkas |
| --- | --- | --- |
| `GET /reports/assets/pdf` | `q`, `category_id`, `has_serial_number`, `stock_status`, `is_active` | `laporan-inventaris-aset-YYYYMMDD.pdf` |
| `GET /reports/asset-ins/pdf` | `q`, `asset_id`, `date_from`, `date_to` | `laporan-aset-masuk-YYYYMMDD.pdf` |
| `GET /reports/asset-outs/pdf` | `q`, `asset_id`, `date_from`, `date_to` | `laporan-aset-keluar-YYYYMMDD.pdf` |
| `GET /reports/stock-opnames/pdf` | `stock_opname_id`, `status`, `date_from`, `date_to` | `laporan-stock-opname-YYYYMMDD.pdf` |

Catatan:

- Izin `reports.view`; tanpa sesi `401`, tanpa izin `403`.
- Rate limit `sensitive`: **20 permintaan/menit** per pengguna. Header `X-RateLimit-Limit`, `X-RateLimit-Remaining`, dan `Retry-After` disertakan seperti endpoint sensitif lain.
- Parameter filter sama dengan versi JSON. `asset_id` dan `stock_opname_id` harus ada; nilai tidak valid menghasilkan `422` JSON, bukan PDF.
- `date_to` harus ≥ `date_from`. `status` menerima `draft`, `finalized`, atau `all`.
- `per_page` tidak dipakai: PDF selalu memuat maksimal **1.000 baris** pertama sesuai urutan laporan. Jika hasil filter lebih besar, berkas tetap dibuat dan menyertakan pemberitahuan pemotongan; persempit filter untuk laporan lengkap.
- Respons `200` bertipe `application/pdf` dengan `Content-Disposition: attachment`. Header `Cache-Control: no-store` dan `X-Content-Type-Options: nosniff` selalu disertakan.
- Setiap ekspor dicatat di audit trail dengan aksi `report.assets_exported`, `report.asset_ins_exported`, `report.asset_outs_exported`, atau `report.stock_opnames_exported`, beserta filter, jumlah baris, dan nama berkas.
- Klien harus memakai `credentials: 'include'` dan `Accept: application/pdf`. Untuk membaca nama berkas, ambil `Content-Disposition` sebelum membuat blob URL.

Contoh:

```js
const response = await fetch('/api/v1/reports/assets/pdf?stock_status=critical', {
  credentials: 'include',
  headers: {
    Accept: 'application/pdf',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

if (!response.ok) {
  // 401/403/422/429: baca JSON error dan tampilkan pesan.
  throw new Error(`Ekspor gagal (${response.status})`)
}

const blob = await response.blob()
const url = URL.createObjectURL(blob)
// Gunakan atribut download pada <a> sesuai nama dari Content-Disposition.
```

## 12. Pengguna

Semua endpoint memerlukan `users.manage` (Manajer).

| Method | Path | Keterangan |
| --- | --- | --- |
| `GET` | `/users?q=&role=&status=&per_page=` | `status=active|inactive|all`; default 25, maksimal 100 |
| `GET` | `/users/{id}` | Detail |
| `POST` | `/users` | `201`; akun langsung aktif dan wajib ganti sandi |
| `PUT` | `/users/{id}` | Peran, nama, email; sandi opsional |
| `PATCH` | `/users/{id}/status` | `{ "is_active": false }` |
| `POST` | `/users/{id}/reset-password` | `{ "password": "...", "password_confirmation": "..." }` |

Body buat/ubah:

```json
{
  "name": "Operator Aset",
  "email": "operator@example.com",
  "role": "admin",
  "password": "SandiAwal#2026",
  "password_confirmation": "SandiAwal#2026"
}
```

`role` hanya `pimpinan` atau `admin`. Saat mengubah tanpa mengganti sandi, kirim `password` sebagai `null` atau hilangkan field. Jika sandi diubah, pengguna wajib menggantinya lagi saat masuk. Reset sandi dan penonaktifan menghapus sesi database pengguna.

Aturan konflik (`422`):

- Tidak dapat mengubah peran akun sendiri.
- Tidak dapat menonaktifkan akun sendiri.
- Tidak dapat menghilangkan Manajer aktif terakhir.

## 13. Audit Trail

### `GET /audit-logs`

Izin `audit.view`. Query: `q` (aksi/entitas/correlation ID), `action`, `actor_user_id`, `date_from`, `date_to`, `per_page` 1–100 (default 25).

Setiap baris memuat aktor, aksi, entitas, `correlation_id`, IP, user agent, metadata, dan waktu. Metadata sudah dibersihkan dari rahasia dan dipotong panjangnya.

## 14. Pengaturan

### `GET /settings`

Izin `settings.manage`. Mengembalikan:

```json
{
  "data": {
    "organization_name": "Organisasi Anda",
    "organization_short_name": "Organisasi",
    "app_name": "Sistem Informasi Manajemen Aset",
    "public_tagline": "Pengelolaan aset yang tertib, transparan, dan dapat diaudit.",
    "footer_text": "Sistem manajemen aset untuk organisasi, kampus, dan tim kerja.",
    "contact_email": null
  }
}
```

### `PUT /settings`

Semua field string wajib; `contact_email` boleh `null`. Mengirim sebagian field akan gagal `422`.

```json
{
  "organization_name": "Organisasi Contoh",
  "organization_short_name": "Org Contoh",
  "app_name": "Sistem Manajemen Aset Organisasi",
  "public_tagline": "Aset tertib dan akuntabel.",
  "footer_text": "Sistem manajemen aset Organisasi Contoh.",
  "contact_email": "aset@example.com"
}
```

Perubahan langsung tercermin di landing page publik. Nilai ini di-escape, termasuk pada JSON-LD.

## 15. Batas dan Perilaku Penting

- Tidak ada endpoint bearer token, webhook, atau API key.
- Tidak ada endpoint unggah berkas.
- Transaksi masuk/keluar bersifat immutable; koreksi dilakukan dengan transaksi baru.
- Serial number unik lintas aset.
- Stock opname tidak menyesuaikan stok otomatis.
- `409` juga dipakai untuk konflik status (aset nonaktif, stok kurang, opname sudah disahkan, kategori masih dipakai, aset punya riwayat).
- Rate limit global API 180/menit per pengguna/IP; operasi sensitif 20/menit; login 10/menit.
- `X-Request-ID` dikembalikan pada setiap respons dan dapat dipakai untuk korelasi log.
