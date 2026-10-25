# Frontend — React + TypeScript + Vite

SPA internal (hanya untuk pengguna terautentikasi, `noindex`). Halaman publik SEO dilayani
Blade dari backend. Dokumentasi lengkap ada di root repo:

- [`../README.md`](../README.md) — ringkasan fitur, peran, dan cara menjalankan.
- [`../API.md`](../API.md) — kontrak API yang dipakai SPA.
- [`../SECURITY.md`](../SECURITY.md) — header, CSP, dan batasan keamanan.
- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) — build dan deploy.

## Menjalankan lokal

```bash
npm install
npm run dev      # http://localhost:5173/app/ — proxy API ke http://localhost:8000
npm run lint
npm run build    # hasil ke ../backend/public/ui dengan base /ui/
```

Dev memakai base `/app/`; build produksi memakai `/ui/` agar aset statis tidak menimpa
rute SPA di Laravel (lihat `vite.config.ts`).
