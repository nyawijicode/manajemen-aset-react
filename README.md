# Sistem Informasi Manajemen Aset

Aplikasi manajemen aset untuk organisasi: mencatat aset, mengelola stok masuk dan keluar, melacak serial number, menjalankan stock opname, membuat laporan PDF, serta menyimpan jejak audit. Antarmuka berbahasa Indonesia dan dirancang responsif untuk ponsel hingga desktop.

Sistem ini dapat dipakai oleh organisasi, kampus, unit kegiatan mahasiswa, usaha kecil, maupun tim yang mengerjakan proyek Kerja Praktik (KP) dan Tugas Akhir (TA). Identitas organisasi, nama aplikasi, dan teks footer dapat diganti melalui halaman Pengaturan tanpa mengubah kode.

Repositori ini terdiri dari dua aplikasi:

| Bagian      | Teknologi                                | Peran                                                                             |
| ----------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| `backend/`  | Laravel 12, PHP 8.2+, Sanctum, Dompdf    | REST API, otorisasi, transaksi stok, audit trail, landing page publik, ekspor PDF |
| `frontend/` | React 19, TypeScript, Vite, Tailwind CSS | SPA internal di `/app`                                                            |

Halaman publik `/` adalah satu-satunya halaman yang diindex mesin pencari. Seluruh halaman internal, API, dan aset SPA bertanda `noindex` dan tetap dilindungi autentikasi. `robots.txt` bukan pengganti kontrol akses.

## Fitur

- Dasbor ringkas: total aset, stok kritis, serial tersedia, tren transaksi enam bulan, aktivitas terbaru.
- Master aset dan kategori dengan pencarian, filter, sortir, serta status aktif/nonaktif.
- Serial number unik global; status `available`/`out` hanya berubah melalui transaksi.
- Transaksi masuk dan keluar dengan validasi stok, tanggal, serial, dan idempotency.
- Stock opname berbasis snapshot; hasil fisik tidak mengubah stok sistem secara otomatis.
- Laporan aset, transaksi masuk, transaksi keluar, dan opname dalam bentuk PDF yang dibuat di server (maksimal 1.000 baris per berkas) dengan ringkasan, filter aktif, dan nomor halaman.
- Navigasi samping yang dapat diciutkan pada desktop; preferensi tersimpan di peramban. Di ponsel navigasi tampil sebagai drawer penuh.
- Manajemen pengguna, reset kata sandi, penonaktifan akun, dan kebijakan ganti sandi awal.
- Audit trail untuk tindakan penting, termasuk aktor, IP, user agent, dan `X-Request-ID`.
- Pengaturan identitas organisasi yang juga tampil di landing page publik.
- Landing page SEO dengan metadata Open Graph, JSON-LD, `sitemap.xml`, dan `robots.txt`.

## Peran dan Izin

| Izin                  | Manajer | Admin |
| --------------------- | :-----: | :---: |
| `dashboard.view`      |    ✓    |   ✓   |
| `assets.view`         |    ✓    |   ✓   |
| `assets.manage`       |    ✓    |   —   |
| `categories.manage`   |    ✓    |   —   |
| `transactions.view`   |    ✓    |   ✓   |
| `transactions.create` |    ✓    |   ✓   |
| `serial.view`         |    ✓    |   ✓   |
| `opname.view`         |    ✓    |   ✓   |
| `opname.manage`       |    ✓    |   ✓   |
| `opname.approve`      |    ✓    |   —   |
| `reports.view`        |    ✓    |   ✓   |
| `users.manage`        |    ✓    |   —   |
| `audit.view`          |    ✓    |   —   |
| `settings.manage`     |    ✓    |   —   |

Backend selalu menjadi otoritas akhir. Menu yang disembunyikan di frontend bukan kontrol keamanan; setiap endpoint memeriksa izin di server.

## Menjalankan Secara Lokal

Prasyarat:

- PHP 8.2 atau lebih baru dengan ekstensi `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, dan `json`.
- Composer 2.
- Node.js 22 LTS (minimal versi yang didukung Vite 8) dan npm.
- MySQL 8+ atau MariaDB 10.4+ (XAMPP sudah menyertakan MySQL/MariaDB di `C:\xampp\mysql`).
- Untuk menjalankan `php artisan test` tidak perlu MySQL; test memakai SQLite in-memory.

### 1. Backend

```powershell
cd C:\xampp\htdocs\react\backend
composer install
Copy-Item .env.example .env
```

`.env.example` adalah template **produksi** (MySQL, HTTPS, `SEED_DEMO=false`). Untuk lokal, ubah nilai berikut di `.env`:

```dotenv
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sistem_manajemen_aset
DB_USERNAME=aset_app
DB_PASSWORD="Aset_Lokal#2026!"

SESSION_DRIVER=database
SESSION_ENCRYPT=true
SESSION_SECURE_COOKIE=false
SESSION_DOMAIN=null

CACHE_STORE=database
QUEUE_CONNECTION=database

SANCTUM_STATEFUL_DOMAINS=localhost,localhost:8000,127.0.0.1,127.0.0.1:8000,localhost:5173,127.0.0.1:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
FORCE_HTTPS=false

SEED_DEMO=true
SEED_PIMPINAN_PASSWORD="Pimpinan#Aset2026!"
SEED_ADMIN_PASSWORD="Admin#Aset2026!"
ORGANIZATION_NAME="Organisasi Anda"
ORGANIZATION_SHORT_NAME=Organisasi
ORGANIZATION_EMAIL=
```

Lalu buat database dan user aplikasi (sekali saja), kemudian jalankan migrasi:

```powershell
# Jalankan dari backend\. Sesuaikan path mysql.exe jika XAMPP berada di lokasi lain.
& C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS sistem_manajemen_aset CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'aset_app'@'localhost' IDENTIFIED BY 'Aset_Lokal#2026!'; CREATE USER IF NOT EXISTS 'aset_app'@'127.0.0.1' IDENTIFIED BY 'Aset_Lokal#2026!'; GRANT ALL PRIVILEGES ON sistem_manajemen_aset.* TO 'aset_app'@'localhost'; GRANT ALL PRIVILEGES ON sistem_manajemen_aset.* TO 'aset_app'@'127.0.0.1'; FLUSH PRIVILEGES;"

php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Backend tersedia di `http://localhost:8000`. Health check: `http://localhost:8000/up`.

> Jangan pernah memakai kata sandi demo di produksi. Seeder produksi memakai nilai `SEED_*_PASSWORD`; jika kosong atau kurang dari 12 karakter, seeder membuat kata sandi acak dan menampilkannya satu kali di terminal.

### 2. Frontend

Mode pengembangan (Vite dengan proxy API ke Laravel):

```powershell
cd C:\xampp\htdocs\react\frontend
npm install
npm run dev
```

Buka `http://localhost:5173/app/`. Vite memakai base `/app/` pada mode dev dan mem-proxy `/api` serta `/sanctum` ke `http://127.0.0.1:8000`.

Mode menyerupai produksi:

```powershell
cd C:\xampp\htdocs\react\frontend
npm run build
```

Hasil build ditulis ke `backend/public/ui/` dengan base `/ui/`. Shell SPA tetap disajikan Laravel pada rute `/app/*`, sehingga deep link seperti `/app/aset/12` bekerja dan mendapat header keamanan dari middleware. Buka `http://localhost:8000/app/`.

Pemisahan `/ui` (aset statis) dan `/app` (rute aplikasi) disengaja: PHP built-in server memperlakukan direktori fisik yang memiliki `index.html` sebagai skrip dan dapat memotong prefix rute. Dengan pemisahan ini, perilaku server lokal konsisten dengan nginx/Apache.

### 3. Akun Demo Lokal

| Peran   | Email                  | Kata sandi awal      |
| ------- | ---------------------- | -------------------- |
| Manajer | `pimpinan@example.com` | `Pimpinan#Aset2026!` |
| Admin   | `admin@example.com`    | `Admin#Aset2026!`    |

Kedua akun memiliki `must_change_password = true`. Sebelum mengganti kata sandi, endpoint operasional mengembalikan `409 PASSWORD_CHANGE_REQUIRED`.

## Verifikasi

Perintah berikut dijalankan dari kondisi repositori saat ini:

```powershell
cd backend
php artisan test
# Tests: 63 passed (389 assertions)

cd ..\frontend
npm run build
# tsc -b && vite build berhasil

npm run lint
# 0 error, 8 warning (React Hook Form + fast-refresh)
```

Delapan warning lint berasal dari keterbatasan analyzer, bukan kegagalan build:

- Lima peringatan `react(incompatible-library)` pada pemakaian React Hook Form.
- Tiga peringatan `react(only-export-components)` pada file yang mengekspor hook/konstanta bersama komponen. (Jumlah baris warning dapat berubah saat file dirapikan; saat ini total 8.)

Pemeriksaan rute produksi juga diverifikasi: `php artisan route:cache` berhasil karena tidak ada route berbasis closure. Cache rute dibersihkan kembali setelah verifikasi.

## Struktur Direktori

```text
manajemen-aset-react/
├── backend/                 Laravel API + landing page
│   ├── app/                 Controller, request, resource, service, middleware
│   ├── database/            Migrasi dan seeder (data demo lokal)
│   ├── public/              Document root
│   │   └── ui/              Hasil build frontend (dibuat oleh npm run build)
│   ├── resources/views/     Landing page Blade dan templat PDF
│   ├── routes/              web.php dan api.php
│   └── tests/               Feature dan unit test
├── frontend/                React SPA
│   └── src/                 Halaman, komponen, guard, API client
├── SECURITY.md              Model keamanan dan risiko residual
├── DEPLOYMENT.md            Panduan produksi
└── API.md                   Referensi REST API
```

## Dokumentasi

- [SECURITY.md](SECURITY.md) — kontrol keamanan, batas pertahanan, dan risiko yang belum ditangani.
- [DEPLOYMENT.md](DEPLOYMENT.md) — nginx/Apache, MySQL, cache produksi, backup, dan troubleshooting.
- [API.md](API.md) — autentikasi cookie, endpoint, payload, kode error, dan contoh pemakaian.

## Batasan yang Disengaja

- Tidak ada klaim “tidak bisa diretas”. Keamanan bergantung pada konfigurasi server, HTTPS, kata sandi kuat, pembaruan dependensi, dan operasi yang disiplin.
- Belum ada MFA, SSO, reset kata sandi mandiri lewat email, atau integrasi SIEM.
- Stock opname bersifat laporan/snapshot; penyesuaian stok tetap dilakukan melalui transaksi yang tercatat.
- Laporan dibuat sebagai PDF di server dan dibatasi 1.000 baris per berkas; pengguna harus mempersempit filter untuk data lebih besar.
- Data demo hanya untuk lokal. Produksi wajib `APP_ENV=production`, `APP_DEBUG=false`, dan `SEED_DEMO=false`.
