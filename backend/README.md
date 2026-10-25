# Backend — Laravel REST API

API dan penyaji SPA untuk Sistem Manajemen Aset. Dokumentasi lengkap ada di root repo:

- [`../README.md`](../README.md) — ringkasan fitur, peran, dan cara menjalankan.
- [`../API.md`](../API.md) — autentikasi cookie, daftar endpoint, contoh payload.
- [`../SECURITY.md`](../SECURITY.md) — model keamanan, header, rate limit, risiko residual.
- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) — deploy nginx/Apache, MySQL, cache, backup.

## Menjalankan lokal

```bash
composer install
cp .env.example .env
php artisan key:generate
```

Siapkan database MySQL `sistem_manajemen_aset` beserta user aplikasi (perintah lengkap ada di
[`../README.md`](../README.md#menjalankan-secara-lokal)), lalu:

```bash
php artisan migrate --seed   # hanya untuk lokal/demo (SEED_DEMO=true)
php artisan serve
```

Gunakan `SEED_DEMO=false` dan password awal yang kuat di production. Frontend hasil build
diletakkan di `public/ui` (lihat `../DEPLOYMENT.md`); shell SPA dilayani Laravel pada `/app`.

## Perintah verifikasi

```bash
php artisan test
composer audit --no-interaction
php artisan route:cache
```
