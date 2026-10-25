# Deployment Produksi

Panduan ini mengasumsikan distribusi Linux (contoh: Ubuntu 24.04 LTS), nginx atau Apache, PHP-FPM 8.3, MySQL 8, dan domain `aset.example.com`. Aplikasi dipasang di root domain. Deployment pada subpath memerlukan perubahan `base` Vite dan `basename` React Router; konfigurasi saat ini tidak mendukung subpath.

> Jangan menjalankan `migrate:fresh`, `db:wipe`, atau perintah destruktif lain di produksi. Selalu buat backup sebelum migrasi.

## 1. Arsitektur Produksi

```text
Internet
   │ HTTPS
   ▼
nginx / Apache ── /ui/assets/*  → berkas statis dari backend/public/ui
   │
   └── /* → PHP-FPM → Laravel
                      ├── /              landing page publik (indexable)
                      ├── /app/*         shell SPA (noindex, auth)
                      └── /api/v1/*      REST API (sesi Sanctum)
```

Frontend **tidak** berjalan sebagai server Node di produksi. `npm run build` menghasilkan berkas statis di `backend/public/ui`, lalu Laravel menyajikan shell `/app/*` dan nginx/Apache menyajikan aset `/ui/assets/*`.

## 2. Prasyarat Server

```bash
sudo apt update
sudo apt install -y nginx mysql-server unzip curl git \
  php8.3-fpm php8.3-cli php8.3-mbstring php8.3-xml php8.3-curl \
  php8.3-mysql php8.3-zip php8.3-bcmath
```

Pasang Composer 2 dan Node.js 22 LTS (hanya diperlukan saat build). Jika build dilakukan di CI, Node tidak perlu ada di server produksi.

Ekspor PDF memakai Dompdf. Pastikan `backend/storage/fonts` ada dan dapat ditulis proses web (sudah tercakup oleh perintah permission di bawah), serta `memory_limit` PHP minimal 256 MB agar laporan hingga 1.000 baris tidak kehabisan memori.

Direktori aplikasi:

```text
/var/www/aset/
├── backend/
│   ├── public/          ← DocumentRoot
│   │   └── ui/          ← hasil build frontend
│   └── ...
└── frontend/
```

## 3. Build dan Dependensi

Urutan yang disarankan:

```bash
cd /var/www/aset/frontend
npm ci
npm run build          # menulis ../backend/public/ui dengan base /ui/

cd /var/www/aset/backend
composer install --no-dev --optimize-autoloader --no-interaction
```

Periksa bahwa `backend/public/ui/index.html` dan `backend/public/ui/assets/` ada. Jangan menyalin folder `public/app`; layout lama tersebut sengaja dihapus agar rute `/app/*` tidak bertabrakan dengan direktori fisik.

## 4. Konfigurasi `.env` Produksi

```dotenv
APP_NAME="Sistem Informasi Manajemen Aset"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://aset.example.com
APP_TIMEZONE=Asia/Jakarta

APP_LOCALE=id
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=id_ID

LOG_CHANNEL=stack
LOG_STACK=daily
LOG_LEVEL=warning
LOG_DAILY_DAYS=14

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sistem_manajemen_aset
DB_USERNAME=aset_app
DB_PASSWORD=GANTI_DENGAN_SANDI_PANJANG

SESSION_DRIVER=database
SESSION_LIFETIME=60
SESSION_ENCRYPT=true
SESSION_PATH=/
SESSION_DOMAIN=null
SESSION_SECURE_COOKIE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax

CACHE_STORE=database
QUEUE_CONNECTION=database
BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
BCRYPT_ROUNDS=12

SANCTUM_STATEFUL_DOMAINS=aset.example.com
CORS_ALLOWED_ORIGINS=https://aset.example.com
FORCE_HTTPS=true
TRUSTED_PROXIES=

SEED_PIMPINAN_NAME="Manajer Organisasi"
SEED_PIMPINAN_EMAIL=pimpinan@example.com
SEED_PIMPINAN_PASSWORD=GANTI_SANDI_AWAL_PIMPINAN
SEED_ADMIN_NAME="Admin Aset"
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=GANTI_SANDI_AWAL_ADMIN
ORGANIZATION_NAME="Organisasi Anda"
ORGANIZATION_SHORT_NAME=Organisasi
ORGANIZATION_EMAIL=
SEED_DEMO=false

MAIL_MAILER=log
MAIL_FROM_ADDRESS="no-reply@example.com"
MAIL_FROM_NAME="${APP_NAME}"
```

Catatan:

- `APP_KEY` dibuat sekali dengan `php artisan key:generate`; simpan di secret manager. Jangan mengganti kunci pada sistem yang sudah berjalan karena sesi dan data terenkripsi dapat tidak terbaca.
- `SESSION_DRIVER=database` penting agar reset sandi/penonaktifan akun dapat mencabut sesi pengguna.
- `SESSION_SECURE_COOKIE=true` dan `FORCE_HTTPS=true` wajib jika TLS aktif.
- `TRUSTED_PROXIES` hanya diisi IP proxy/load balancer. Contoh bila nginx berada di mesin yang sama dan PHP-FPM menerima `X-Forwarded-*`: `127.0.0.1`. Jangan memakai `*`.
- Jika build dilakukan di server, `npm ci` memerlukan akses registry. Alternatifnya, build di CI dan unggah `backend/public/ui` sebagai artefak.
- `SEED_DEMO=false` mutlak. Seeder demo hanya berjalan saat `APP_ENV=local`.

## 5. Menyiapkan MySQL

Masuk sebagai administrator MySQL:

```sql
CREATE DATABASE sistem_manajemen_aset
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'aset_app'@'127.0.0.1'
  IDENTIFIED BY 'GANTI_DENGAN_SANDI_PANJANG';

GRANT ALL PRIVILEGES ON sistem_manajemen_aset.* TO 'aset_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Akun di atas dipakai untuk migrasi. Setelah migrasi selesai dan aplikasi stabil, Anda dapat membatasi hak runtime:

```sql
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'aset_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON sistem_manajemen_aset.* TO 'aset_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Saat akan menjalankan migrasi berikutnya, berikan kembali hak DDL (`ALTER`, `CREATE`, `DROP`, `INDEX`, `REFERENCES`) sementara, lalu cabut lagi. Pisahkan akun migrasi dan akun runtime bila proses rilis memungkinkan.

Pastikan MySQL hanya mendengarkan di localhost/private network dan firewall membatasi port 3306.

## 6. Migrasi dan Seed Pertama

```bash
cd /var/www/aset/backend
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
```

Seeder membuat pengaturan awal, kategori dasar, dan dua akun (Manajer dan Admin). Seeder tidak membuat data demo di produksi. Jika `SEED_*_PASSWORD` kosong atau kurang dari 12 karakter, kata sandi acak dibuat dan ditampilkan **satu kali** di terminal. Catat dan ganti segera.

Jangan mengulang `db:seed` tanpa memahami sifat idempotennya: pengguna dengan email yang sama dilewati, tetapi kategori/pengaturan dapat diperbarui. Untuk produksi, seed pertama sebaiknya dilakukan sekali.

## 7. Permission Berkas

```bash
cd /var/www/aset
sudo chown -R www-data:www-data backend/storage backend/bootstrap/cache
sudo find backend/storage backend/bootstrap/cache -type d -exec chmod 775 {} \;
sudo find backend/storage backend/bootstrap/cache -type f -exec chmod 664 {} \;

sudo chown www-data:www-data backend/.env
sudo chmod 640 backend/.env

sudo find backend -path backend/vendor -prune -o -type f -exec chmod 644 {} \;
```

`backend/public` harus menjadi DocumentRoot. Jangan menunjuk web root ke `backend/` karena `.env`, `storage`, dan kode sumber dapat terekspos.

## 8. nginx

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name aset.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name aset.example.com;

    root /var/www/aset/backend/public;
    index index.php;
    charset utf-8;
    client_max_body_size 2m;

    ssl_certificate     /etc/letsencrypt/live/aset.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aset.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Shell SPA hanya lewat /app agar CSP dan noindex dari Laravel selalu ada.
    location = /ui/index.html { return 404; }
    location = /ui/ { return 404; }
    location = /ui { return 404; }

    location ^~ /ui/assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
    }

    location ^~ /ui/ {
        try_files $uri =404;
        expires 1h;
        add_header Cache-Control "public, max-age=3600" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Robots-Tag "noindex, nofollow, noarchive, nosnippet" always;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $realpath_root;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

Aktifkan dan uji:

```bash
sudo ln -s /etc/nginx/sites-available/aset /etc/nginx/sites-enabled/aset
sudo nginx -t
sudo systemctl reload nginx
```

Catatan:

- `try_files` mengarahkan deep link `/app/aset/12` ke Laravel, yang menyajikan shell SPA.
- `/ui/index.html`, `/ui/`, dan `/ui` diblokir. Pengguna harus membuka `/app/`; ini memastikan header keamanan dinamis selalu diterapkan.
- CSP tidak ditambahkan di nginx karena sudah dikelola middleware Laravel untuk HTML `/app/*` dan `/api/*`. Header statis di atas melengkapi berkas `/ui`.
- HSTS ditambahkan di nginx dan juga oleh Laravel saat request terdeteksi HTTPS.

## 9. Apache (Alternatif)

Aktifkan modul:

```bash
sudo a2enmod rewrite headers ssl
sudo systemctl restart apache2
```

Virtual host:

```apache
<VirtualHost *:443>
    ServerName aset.example.com
    DocumentRoot /var/www/aset/backend/public

    SSLEngine on
    SSLCertificateFile      /etc/letsencrypt/live/aset.example.com/fullchain.pem
    SSLCertificateKeyFile   /etc/letsencrypt/live/aset.example.com/privkey.pem

    <Directory /var/www/aset/backend/public>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    <Directory /var/www/aset/backend/public/ui>
        <Files "index.html">
            Require all denied
        </Files>
    </Directory>
</VirtualHost>
```

`backend/public/.htaccess` sudah memuat aturan front controller dan memblokir akses langsung ke `ui/index.html` serta `ui/`. Pastikan `mod_rewrite` aktif. Untuk performa aset, aktifkan `mod_expires` dan set cache panjang untuk `/ui/assets`.

Jangan mengaktifkan directory listing. `Options -Indexes` wajib.

## 10. Cache Produksi

Setelah `.env`, rute, dan view final:

```bash
cd /var/www/aset/backend
php artisan optimize:clear
php artisan optimize
```

`php artisan optimize` melakukan cache konfigurasi, event, rute, dan view. `php artisan route:cache` telah diverifikasi berhasil pada kode saat ini karena tidak ada route closure. Jika kelak menambahkan route closure, `route:cache` akan gagal; ubah ke controller.

Setiap kali mengubah `.env`, rute, config, atau view di produksi, jalankan ulang `php artisan optimize` (atau minimal `config:cache`, `route:cache`, `view:cache`). Jangan menjalankan `config:cache` sebelum `.env` final.

## 11. Queue dan Scheduler

Fitur saat ini tidak mengirim job ke queue. Dengan `QUEUE_CONNECTION=database`, aplikasi tetap berjalan tanpa worker karena tidak ada job yang di-dispatch. Jika nantinya menambahkan email/notifikasi, jalankan worker:

```ini
# /etc/systemd/system/aset-worker.service
[Unit]
Description=Aset queue worker
After=network.target mysql.service

[Service]
User=www-data
Group=www-data
Restart=always
WorkingDirectory=/var/www/aset/backend
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3 --timeout=90
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aset-worker
```

Saat ini tidak ada tugas terjadwal. Jika ditambahkan, pasang cron:

```cron
* * * * * cd /var/www/aset/backend && php artisan schedule:run >> /dev/null 2>&1
```

## 12. Backup dan Restore

Backup minimum: database, `.env`, dan konfigurasi web server. Berkas `/ui` dapat dibangun ulang; tidak ada unggahan pengguna saat ini.

Contoh backup MySQL:

```bash
sudo install -d -m 700 /var/backups/aset
mysqldump --single-transaction --routines --triggers \
  -u aset_backup -p sistem_manajemen_aset \
  | gzip > "/var/backups/aset/aset-$(date +%F-%H%M).sql.gz"
```

Simpan salinan terenkripsi di lokasi terpisah. Uji restore secara berkala ke database sementara:

```bash
gunzip -c /var/backups/aset/aset-YYYY-MM-DD-HHMM.sql.gz \
  | mysql -u root -p aset_restore_test
```

Backup `.env` terpisah dan terenkripsi; jangan menaruhnya di web root.

## 13. Monitoring dan Log

- Health check: `GET https://aset.example.com/up` → `200`. Ini liveness aplikasi, bukan pemeriksaan database penuh.
- Log aplikasi: `backend/storage/logs/laravel.log` (harian, retensi default 14 hari).
- Pantau `401`, `403`, `409`, `429`, dan `5xx`. Setiap respons API memiliki `X-Request-ID`; gunakan ID tersebut untuk mencocokkan log dan audit trail.
- Pantau ruang disk, koneksi MySQL, dan waktu respons.
- Audit trail dapat dilihat Manajer di `/app/audit`. Ekspor/kirim ke SIEM belum tersedia.

## 14. Prosedur Rilis

```bash
cd /var/www/aset/backend
php artisan down --retry=60

# 1. Backup database dan .env
# 2. Ambil kode baru
# 3. Build frontend (jika dilakukan di server)
cd /var/www/aset/frontend && npm ci && npm run build

# 4. Dependensi backend
cd /var/www/aset/backend
composer install --no-dev --optimize-autoloader --no-interaction

# 5. Migrasi
php artisan migrate --force

# 6. Cache ulang dan naikkan aplikasi
php artisan optimize:clear
php artisan optimize
php artisan up
```

Untuk rollback, kembalikan kode ke rilis sebelumnya, pulihkan database dari backup bila migrasi bersifat merusak, lalu jalankan `php artisan optimize:clear && php artisan optimize`. Hindari `migrate:rollback` tanpa memahami dampaknya terhadap data produksi.

## 15. Troubleshooting

| Gejala | Penyebab umum | Tindakan |
| --- | --- | --- |
| Halaman putih / 500 | `APP_KEY` kosong, permission `storage`, atau log penuh | Periksa `storage/logs/laravel.log`; jalankan `php artisan optimize:clear` |
| `419 Page Expired` | Domain tidak ada di `SANCTUM_STATEFUL_DOMAINS`; cookie Secure di HTTP; CORS salah | Samakan domain, pastikan HTTPS, periksa `SESSION_DOMAIN` dan `CORS_ALLOWED_ORIGINS` |
| Login 422 “harus berasal dari antarmuka” | Request tidak stateful | Pastikan cookie sesi terkirim dan origin terdaftar |
| Login 409 | `must_change_password=true` | Ganti sandi lewat `/app/ubah-sandi` |
| Deep link `/app/...` 404 | Rewrite tidak mengarah ke `index.php`, atau direktori `public/app` masih ada | Periksa konfigurasi nginx/Apache; hapus `public/app`; pastikan build di `public/ui` |
| Aset `/ui/assets/*` 404 | Build belum dijalankan atau `base` salah | Jalankan `npm run build`; cek `base: '/ui/'` |
| `route:cache` gagal | Ada route closure | Ganti dengan controller; jalankan ulang |
| 429 saat operasi normal | Limiter `sensitive` atau `api` tercapai | Tunggu `Retry-After`; untuk kluster gunakan Redis bersama |
| Ekspor PDF 500 / kosong | `storage/fonts` tidak ada atau tidak writable; `memory_limit` terlalu rendah | Buat `backend/storage/fonts`, perbaiki permission `storage`, naikkan `memory_limit` ke 256 MB atau lebih |
| Sesi tidak tercabut setelah reset | `SESSION_DRIVER` bukan `database` | Set `SESSION_DRIVER=database`; login ulang |
| Aset statis langsung `/ui/index.html` 403/404 | Perlindungan disengaja | Gunakan `/app/` |

## 16. Checklist Go-Live

- [ ] DNS dan sertifikat TLS valid; HTTP → HTTPS 301.
- [ ] DocumentRoot menunjuk `backend/public`.
- [ ] `backend/public/ui` berisi hasil build terbaru.
- [ ] `.env` produksi lengkap; `APP_DEBUG=false`, `SEED_DEMO=false`.
- [ ] `php artisan migrate --force` sukses; backup tersedia.
- [ ] Akun Manajer/Admin dibuat, sandi awal kuat, sudah diganti.
- [ ] Login, logout, ganti sandi, dan 409 alur sandi awal diuji.
- [ ] Uji peran Admin tidak dapat mengakses pengguna/audit/pengaturan/finalisasi opname.
- [ ] `/`, `/app/`, `/app/aset`, `/robots.txt`, `/sitemap.xml`, `/up` diuji.
- [ ] Ekspor PDF keempat laporan diuji; `backend/storage/fonts` writable.
- [ ] `/ui/index.html` tidak dapat diakses langsung.
- [ ] `php artisan optimize` berhasil.
- [ ] Backup terjadwal dan restore diuji.
- [ ] Log, disk, dan health check dipantau.
