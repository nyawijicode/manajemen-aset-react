# Keamanan

Dokumen ini menjelaskan kontrol yang benar-benar diterapkan di repositori, batasnya, dan risiko yang masih tersisa. Tidak ada klaim bahwa sistem “tidak dapat diretas”. Keamanan akhir bergantung pada konfigurasi server, TLS, kata sandi, pembaruan dependensi, dan operasi yang disiplin.

## 1. Batas Kepercayaan

| Area | Akses | Index mesin pencari |
| --- | --- | --- |
| `/` landing page | Publik | Boleh (`index, follow`) |
| `/app/*` SPA internal | Wajib login + izin per rute | `noindex` |
| `/api/v1/*` | Wajib sesi Sanctum + izin | `noindex` |
| `/ui/*` aset statis | Publik, hanya berkas build | `Disallow` di `robots.txt`; shell utama tetap `/app` |
| `/sanctum/csrf-cookie` | Publik, untuk membuat token CSRF | Tidak diindex |

`robots.txt` hanya mengurangi perayapan; bukan kontrol akses. Seluruh data operasional dilindungi autentikasi dan otorisasi di server.

## 2. Autentikasi dan Sesi

- Autentikasi memakai **cookie sesi Laravel + Sanctum stateful**. Aplikasi tidak menerbitkan bearer token dan tidak menyimpan token di `localStorage`.
- Login hanya diterima bila request memiliki sesi (`hasSession()`). Permintaan non-stateful ditolak dengan `422`.
- Setelah login berhasil, ID sesi diregenerasi. Logout menghapus autentikasi, menginvalidasi sesi, dan meregenerasi token CSRF.
- Permintaan tidak aman (`POST`, `PUT`, `PATCH`, `DELETE`) memerlukan token CSRF dari `/sanctum/csrf-cookie` dan header `X-XSRF-TOKEN`.
- Kata sandi di-hash dengan bcrypt (biaya produksi 12). Kebijakan kata sandi: minimal 12 karakter, huruf besar dan kecil, angka, serta simbol.
- Akun baru, hasil reset, dan akun seed memiliki `must_change_password = true`. Endpoint operasional mengembalikan `409 PASSWORD_CHANGE_REQUIRED` sampai kata sandi diganti.
- Akun nonaktif tidak dapat login. Jika sesi lama masih aktif, middleware `active` mengeluarkannya dan mengembalikan `401 ACCOUNT_INACTIVE`.
- Reset kata sandi dan penonaktifan akun oleh Manajer menghapus sesi database pengguna tersebut. Ini hanya berlaku bila `SESSION_DRIVER=database`; gunakan driver tersebut di produksi.
- Login gagal selalu memberi pesan generik yang sama, sehingga tidak membocorkan keberadaan akun atau statusnya.

## 3. Otorisasi

Izin didefinisikan sekali pada `App\Enums\Role` dan didaftarkan sebagai Gate. Setiap endpoint memakai middleware `can:<permission>`; request form juga memeriksa izin yang sama. Frontend menyembunyikan menu dan memasang guard per rute, tetapi server tetap menjadi otoritas akhir.

| Izin | Manajer | Admin |
| --- | :---: | :---: |
| `dashboard.view` | ✓ | ✓ |
| `assets.view` | ✓ | ✓ |
| `assets.manage` | ✓ | — |
| `categories.manage` | ✓ | — |
| `transactions.view` | ✓ | ✓ |
| `transactions.create` | ✓ | ✓ |
| `serial.view` | ✓ | ✓ |
| `opname.view` | ✓ | ✓ |
| `opname.manage` | ✓ | ✓ |
| `opname.approve` | ✓ | — |
| `reports.view` | ✓ | ✓ |
| `users.manage` | ✓ | — |
| `audit.view` | ✓ | — |
| `settings.manage` | ✓ | — |

Aturan tambahan:

- Manajer tidak dapat mengubah peran akun sendiri.
- Manajer tidak dapat menonaktifkan akun sendiri.
- Sistem menolak perubahan yang menghilangkan Manajer aktif terakhir.
- Hanya Manajer yang dapat melihat daftar pengguna, audit trail, dan pengaturan.

## 4. Validasi Input dan Output

- Semua input API divalidasi dengan FormRequest atau `$request->validate()`; tidak ada mass assignment bebas.
- Kode aset dibatasi pola `^[A-Z0-9][A-Z0-9._\-\/]*$` dan unik.
- Tanggal transaksi tidak boleh melebihi hari ini. Kuantitas dibatasi 1–10.000. `per_page` dibatasi (maksimal 1.000 hanya untuk laporan).
- Serial number dinormalisasi (huruf besar, spasi dirapikan), unik global di database, dan jumlahnya harus sama dengan kuantitas.
- Pencarian memakai query binding Eloquent. Karakter `%` dan `_` pada input `LIKE` di-escape agar tidak menjadi wildcard tak terkendali.
- React meng-escape nilai yang dirender. Tidak ada `dangerouslySetInnerHTML`, `eval`, atau `new Function` di frontend.
- Blade meng-escape variabel dengan `{{ }}`. JSON-LD landing page memakai `json_encode` dengan `JSON_HEX_TAG`, `JSON_HEX_AMP`, `JSON_HEX_APOS`, dan `JSON_HEX_QUOT` agar nilai pengaturan tidak dapat menutup tag `<script>`.
- Tidak ada endpoint unggah berkas, sehingga tidak ada pemrosesan file dari pengguna.

## 5. Header Keamanan dan CSP

Middleware `SecurityHeaders` memasang header berikut pada respons Laravel:

| Header | Nilai |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Menonaktifkan kamera, mikrofon, geolokasi, pembayaran, USB |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `X-Permitted-Cross-Domain-Policies` | `none` |
| `X-Robots-Tag` | `noindex, nofollow, noarchive, nosnippet` untuk `/app*`, `/api/*`, dan `/ui*` yang melewati Laravel |
| `Cache-Control` | `no-store, no-cache, must-revalidate, private` untuk area internal/API |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` hanya di produksi dan request HTTPS |
| `X-Request-ID` | UUID atau ID masuk yang tervalidasi (8–64 karakter `A-Z a-z 0-9 . _ -`) |

CSP untuk HTML:

```text
default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
object-src 'none'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline';
script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'
```

CSP untuk API: `default-src 'none'; frame-ancestors 'none'`.

Catatan penting:

- `style-src 'unsafe-inline'` diperlukan oleh gaya inline komponen. Ini pelemahan terbatas; `script-src` tetap `'self'` tanpa `unsafe-inline` atau `unsafe-eval`.
- Font antarmuka memakai font sistem, sehingga tidak ada koneksi ke CDN.
- Ekspor PDF dibuat di server dengan Dompdf dari templat Blade tepercaya. Tidak ada HTML masukan pengguna yang dirender; `enable_remote` dan `enable_php` tetap `false`, dan akses berkas dibatasi `chroot` ke `base_path()`. Endpoint memerlukan `reports.view`, dibatasi `throttle:sensitive` (20/menit), dan setiap ekspor dicatat di audit trail. Berkas PDF dikirim langsung ke klien dan tidak disimpan di direktori publik.
- Berkas statis di `/ui/assets` dilayani langsung oleh web server dan **tidak melewati middleware Laravel**. Shell aplikasi yang dipakai pengguna adalah `/app/*` dan mendapat seluruh header di atas. Di produksi, blokir `/ui/index.html` atau tambahkan header yang sama di reverse proxy (lihat `DEPLOYMENT.md`).

## 6. CSRF dan CORS

- `statefulApi()` mengaktifkan pemeriksaan CSRF untuk request stateful dari domain yang terdaftar di `SANCTUM_STATEFUL_DOMAINS`.
- Cookie sesi: `HttpOnly`, `Secure` di produksi, `SameSite=Lax`, dan terenkripsi (`SESSION_ENCRYPT=true`).
- Cookie `XSRF-TOKEN` memang dapat dibaca JavaScript sesuai desain Laravel; nilainya hanya berguna bersama sesi same-origin dan dilindungi CSP.
- CORS memakai allowlist eksplisit dari `CORS_ALLOWED_ORIGINS`, mendukung credentials, dan tidak memakai wildcard.
- Header `X-Requested-With`, `X-XSRF-TOKEN`, `Idempotency-Key`, dan `X-Request-ID` termasuk header yang diizinkan.

## 7. Pembatasan Laju

| Limiter | Batas | Kunci | Cakupan |
| --- | --- | --- | --- |
| `login` | 10/menit | Email + IP | Endpoint login |
| Pemeriksaan login internal | 5 kegagalan/60 detik | Email + IP | Form login |
| `api` | 180/menit | User ID (atau IP untuk tamu) | Seluruh grup API |
| `sensitive` | 20/menit | User ID + IP | Transaksi, perubahan sandi, mutasi pengguna, opname, pengaturan |

Respons `429` memakai pesan Indonesia dan menyertakan `Retry-After` dari framework. Limiter memakai cache aplikasi. Untuk beberapa node produksi, gunakan cache bersama (Redis) agar batas berlaku global, bukan per node.

## 8. Integritas Stok dan Data

- Saldo stok disimpan di `assets.stock`; riwayat masuk/keluar adalah ledger terpisah yang tidak diubah setelah dibuat.
- `recordIn` dan `recordOut` berjalan dalam transaksi database dengan `lockForUpdate()` pada baris aset, serta tiga kali percobaan ulang untuk deadlock.
- Stok keluar tidak boleh melebihi saldo; pelanggaran menghasilkan `409`.
- Serial number memiliki constraint unik global. Serial yang sudah keluar tidak dapat dipakai lagi.
- Foreign key memakai `restrictOnDelete` pada data yang memiliki riwayat, sehingga aset/kategori bertransaksi tidak terhapus diam-diam. Penghapusan aset ditolak jika sudah memiliki riwayat; gunakan penonaktifan.
- `Idempotency-Key` (8–80 karakter) unik per tabel transaksi mencegah duplikasi saat pengguna mengirim ulang. Replay mengembalikan `200` dengan data yang sudah ada, bukan membuat transaksi baru.
- Stock opname menyimpan snapshot `system_qty_snapshot`; finalisasi tidak mengubah stok. Selisih harus ditindaklanjuti melalui transaksi resmi agar audit tetap lengkap.
- Perubahan status aset dan opname yang sudah disahkan ditolak (`409`) agar riwayat konsisten.

## 9. Audit Trail

Audit log mencatat aktor, aksi, tipe/ID entitas, `correlation_id`, IP, user agent, metadata JSON, dan waktu. Metadata dibersihkan dari kunci sensitif (`password`, `token`, `secret`, `authorization`, `cookie`, `session`, dan sejenisnya), serta dipotong agar tidak membengkak.

Aksi yang dicatat:

`auth.login`, `auth.logout`, `auth.login_failed`, `auth.password_changed`, `asset.created`, `asset.updated`, `asset.activated`, `asset.archived`, `asset.deleted`, `category.created`, `category.updated`, `category.deleted`, `asset_in.created`, `asset_out.created`, `stock_opname.created`, `stock_opname.updated`, `stock_opname.finalized`, `user.created`, `user.updated`, `user.activated`, `user.deactivated`, `user.password_reset`, `settings.updated`.

Audit trail bersifat **append-only di tingkat aplikasi** (tidak ada endpoint ubah/hapus), tetapi tidak memiliki hash chain atau WORM. Administrator database masih dapat mengubahnya. Untuk kebutuhan forensik tingkat lanjut, kirim log ke penyimpanan terpisah/SIEM.

## 10. Penanganan Kesalahan dan Log

- API tidak mengembalikan stack trace, query SQL, atau pesan internal.
- Kesalahan validasi, autentikasi, otorisasi, 404, 429, dan 5xx memiliki format JSON konsisten dengan `code` dan `request_id`.
- Pengecualian 5xx dan `QueryException` dilaporkan ke log aplikasi; klien hanya menerima pesan generik.
- `APP_DEBUG=false` wajib di produksi.
- `X-Request-ID` dapat dicocokkan dengan log dan audit trail.

## 11. Rahasia dan Konfigurasi

Wajib di produksi:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://aset.example.com
FORCE_HTTPS=true
SESSION_DRIVER=database
SESSION_ENCRYPT=true
SESSION_SECURE_COOKIE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax
SEED_DEMO=false
```

- `APP_KEY` harus dibuat dengan `php artisan key:generate` dan disimpan rahasia. Jangan memakai ulang kunci pengembangan.
- Kredensial MySQL memakai akun khusus aplikasi, bukan `root`.
- `SANCTUM_STATEFUL_DOMAINS` dan `CORS_ALLOWED_ORIGINS` harus berisi domain produksi yang tepat, tanpa wildcard.
- `TRUSTED_PROXIES` hanya diisi alamat proxy/LB yang benar. Jangan memercayai `X-Forwarded-*` dari internet terbuka.
- `.env` tidak boleh masuk repositori atau dokumen.

## 12. Risiko Residual

| Risiko | Dampak | Mitigasi saat ini | Tindakan lanjutan |
| --- | --- | --- | --- |
| Penyalahgunaan oleh pengguna berizin | Data/stok salah, kebocoran internal | Least privilege, audit trail, finalisasi opname oleh Manajer | Tinjau audit berkala; pisahkan tugas; pertimbangkan MFA |
| Tidak ada MFA/SSO | Akun dapat diambil alih jika sandi bocor | Sandi kuat, rate limit, sesi pendek, audit login | Tambahkan MFA/SSO organisasi |
| Tidak ada reset sandi mandiri | Beban operasional Manajer | Reset oleh Manajer + wajib ganti sandi | Integrasi email/helpdesk terverifikasi |
| `style-src 'unsafe-inline'` | Risiko XSS berbasis style/atribut meningkat | `script-src 'self'`, React escaping, tanpa HTML mentah | Migrasikan gaya inline ke nonce/hash |
| Audit log dapat diubah admin DB | Bukti forensik melemah | Tidak ada API mutasi; akses DB terbatas | SIEM/WORM, hash chain, akses DB terpisah |
| Rate limit per node | Batas dapat dilipatgandakan di kluster | Limiter aktif di setiap node | Redis bersama untuk limiter |
| Tidak ada WAF/anti-DDoS | Layanan dapat dibanjiri | Timeout server, rate limit aplikasi | WAF/CDN organisasi |
| Backup tidak otomatis | Kehilangan data saat insiden | Prosedur backup didokumentasikan | Jadwalkan, uji restore, simpan off-site |
| Dependensi dapat memiliki kerentanan | RCE/XSS/dll. | Versi terkini, lockfile | `composer audit`, `npm audit`, pembaruan rutin |
| Data demo tidak sengaja dipakai | Kredensial publik | `SEED_DEMO` hanya lokal; seeder produksi memakai env | Periksa `.env` sebelum go-live |
| Enkripsi at-rest tidak diatur aplikasi | Media DB dapat dibaca pihak lain | Kontrol akses filesystem/DB | Enkripsi disk/TDE dan manajemen kunci |
| Retensi audit/PII belum otomatis | Pertumbuhan data dan kepatuhan | Metadata dibatasi | Kebijakan retensi dan pembersihan terjadwal |
| Belum ada uji penetrasi formal | Celah tidak diketahui | 63 feature/unit test, header, validasi | Pentest sebelum produksi dan berkala |

## 13. Checklist Sebelum Go-Live

- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY` baru, `FORCE_HTTPS=true`.
- [ ] HTTPS valid, HTTP dialihkan 301, HSTS terkirim.
- [ ] `SANCTUM_STATEFUL_DOMAINS` dan `CORS_ALLOWED_ORIGINS` hanya domain produksi.
- [ ] `SEED_DEMO=false`; kata sandi seed kuat dan sudah diganti.
- [ ] MySQL memakai akun least privilege; port DB tidak terbuka ke publik.
- [ ] `php artisan migrate --force` dijalankan dengan backup tersedia.
- [ ] `storage/` dan `bootstrap/cache/` dapat ditulis `www-data`, tidak dapat diakses langsung dari web.
- [ ] `/ui/index.html` diblokir atau diberi header keamanan oleh reverse proxy.
- [ ] Log dan audit dapat dipantau; retensi ditetapkan.
- [ ] Backup terjadwal dan restore sudah diuji.
- [ ] `composer audit` dan `npm audit` ditinjau.
- [ ] Uji akses Admin: tidak bisa membuka aset manage, kategori, pengguna, audit, pengaturan, atau finalisasi opname.
- [ ] Uji sesi: logout, akun dinonaktifkan, dan reset sandi mencabut akses.

## 14. Melaporkan Kerentanan

Hubungi pemilik sistem melalui kanal keamanan yang tersedia. Jangan membuat isu publik yang memuat data pribadi, kredensial, atau detail eksploitasi. Sertakan langkah reproduksi, dampak, dan `request_id` bila tersedia. Belum ada alamat surel keamanan khusus di repositori ini; isi sesuai kebijakan organisasi sebelum publikasi.
