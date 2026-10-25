<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $settings['app_name'] }} — {{ $settings['organization_name'] }}</title>
    <meta name="description" content="{{ $metaDescription }}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="theme-color" content="#1D4ED8">
    <link rel="canonical" href="{{ $canonical }}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/css/landing.css">

    <meta property="og:type" content="website">
    <meta property="og:locale" content="id_ID">
    <meta property="og:site_name" content="{{ $settings['organization_name'] }}">
    <meta property="og:title" content="{{ $settings['app_name'] }}">
    <meta property="og:description" content="{{ $metaDescription }}">
    <meta property="og:url" content="{{ $canonical }}">
    <meta property="og:image" content="{{ url('/images/og-cover.png') }}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="{{ $settings['app_name'] }}">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ $settings['app_name'] }}">
    <meta name="twitter:description" content="{{ $metaDescription }}">
    <meta name="twitter:image" content="{{ url('/images/og-cover.png') }}">

    <script type="application/ld+json">
        {!! json_encode([
            '@'.'context' => 'https://schema.org',
            '@type' => 'WebPage',
            'name' => $settings['app_name'],
            'description' => $metaDescription,
            'url' => $canonical,
            'inLanguage' => 'id-ID',
            'isPartOf' => [
                '@type' => 'WebSite',
                'name' => $settings['organization_name'],
                'url' => url('/'),
            ],
            'publisher' => [
                '@type' => 'Organization',
                'name' => $settings['organization_name'],
            ],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) !!}
    </script>
</head>
<body>
<a class="skip-link" href="#main">Lewati ke konten utama</a>

<header class="site-header">
    <div class="container header-inner">
        <a class="brand" href="/" aria-label="{{ $settings['app_name'] }} — beranda">
            <span class="brand-mark" aria-hidden="true">{{ mb_strtoupper(mb_substr($settings['organization_short_name'], 0, 1)) }}</span>
            <span class="brand-text">
                <strong>{{ $settings['organization_short_name'] }}</strong>
                <span>Manajemen Aset</span>
            </span>
        </a>

        <nav class="site-nav" aria-label="Navigasi utama">
            <a href="#tentang">Tentang</a>
            <a href="#modul">Modul</a>
            <a href="#keamanan">Keamanan</a>
        </nav>

        <a class="btn btn-primary btn-small" href="/app/masuk">Masuk ke aplikasi</a>
    </div>
</header>

<main id="main">
    <section class="hero">
        <div class="container hero-grid">
            <div class="hero-copy">
                <p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span> Sistem manajemen aset</p>
                <h1>Kelola aset organisasi dengan tertib, transparan, dan dapat diaudit.</h1>
                <p class="hero-lead">
                    {{ $settings['app_name'] }} memusatkan pencatatan aset, transaksi masuk dan keluar,
                    serial number, stock opname, laporan, serta jejak audit dalam satu alur kerja yang terkendali.
                    Cocok untuk organisasi, kampus, hingga proyek Kerja Praktik dan Tugas Akhir.
                </p>
                <div class="hero-actions">
                    <a class="btn btn-primary" href="/app/masuk">Masuk ke aplikasi</a>
                    <a class="btn btn-secondary" href="#modul">Lihat modul</a>
                </div>
                <ul class="trust-list" aria-label="Prinsip sistem">
                    <li><span aria-hidden="true">✓</span> Akses berbasis peran</li>
                    <li><span aria-hidden="true">✓</span> Jejak audit tindakan penting</li>
                    <li><span aria-hidden="true">✓</span> Transaksi stok terkendali</li>
                </ul>
            </div>

            <div class="hero-visual" aria-hidden="true">
                <div class="preview-window">
                    <div class="preview-bar">
                        <span class="preview-dots"><i></i><i></i><i></i></span>
                        <span class="preview-address">aset.example.com</span>
                    </div>
                    <div class="preview-body">
                        <div class="preview-sidebar">
                            <span class="preview-logo">S</span>
                            <span class="preview-nav active"></span>
                            <span class="preview-nav"></span>
                            <span class="preview-nav"></span>
                            <span class="preview-nav short"></span>
                        </div>
                        <div class="preview-main">
                            <div class="preview-heading">
                                <span class="preview-title"></span>
                                <span class="preview-pill"></span>
                            </div>
                            <div class="preview-stats">
                                <div class="preview-stat"><span></span><b></b></div>
                                <div class="preview-stat"><span></span><b></b></div>
                                <div class="preview-stat"><span></span><b></b></div>
                            </div>
                            <div class="preview-chart">
                                <span style="--h: 38%"></span>
                                <span style="--h: 56%"></span>
                                <span style="--h: 44%"></span>
                                <span style="--h: 72%"></span>
                                <span style="--h: 64%"></span>
                                <span style="--h: 86%"></span>
                                <span style="--h: 58%"></span>
                            </div>
                            <div class="preview-table">
                                <span></span><span></span><span></span>
                                <span></span><span></span><span></span>
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="visual-badge">
                    <span class="badge-icon" aria-hidden="true">✓</span>
                    <span><strong>Audit trail</strong>Aktivitas penting tercatat</span>
                </div>
            </div>
        </div>
    </section>

    <section class="section" id="tentang">
        <div class="container">
            <div class="section-heading">
                <p class="eyebrow">Satu sumber data</p>
                <h2>Dari penerimaan barang sampai laporan manajer.</h2>
                <p>
                    Alur kerja disusun mengikuti kebutuhan organisasi: pencatatan yang konsisten,
                    stok yang dapat dipertanggungjawabkan, dan riwayat yang tidak hilang.
                </p>
            </div>

            <div class="feature-grid">
                <article class="feature-card">
                    <span class="feature-icon" aria-hidden="true">01</span>
                    <h3>Master aset terpusat</h3>
                    <p>Kode unik, kategori, satuan, batas stok minimum, dan penanda serial number dalam satu katalog.</p>
                </article>
                <article class="feature-card">
                    <span class="feature-icon" aria-hidden="true">02</span>
                    <h3>Transaksi terkendali</h3>
                    <p>Aset masuk dan keluar dicatat melalui akun pengguna. Stok diperbarui oleh server, bukan dari browser.</p>
                </article>
                <article class="feature-card">
                    <span class="feature-icon" aria-hidden="true">03</span>
                    <h3>Pelacakan per unit</h3>
                    <p>Serial number unik menghubungkan setiap unit dengan riwayat penerimaan dan pengeluarannya.</p>
                </article>
            </div>
        </div>
    </section>

    <section class="section section-soft" id="modul">
        <div class="container">
            <div class="section-heading narrow">
                <p class="eyebrow">Modul utama</p>
                <h2>Fokus pada pekerjaan, bukan pencatatan berulang.</h2>
            </div>

            <div class="module-grid">
                <article class="module-card"><h3>Dashboard</h3><p>Ringkasan aset, tren transaksi, stok kritis, dan pekerjaan opname yang menunggu.</p></article>
                <article class="module-card"><h3>Aset masuk</h3><p>Penerimaan barang, sumber pengadaan, kuantitas, dan serial number yang tervalidasi.</p></article>
                <article class="module-card"><h3>Aset keluar</h3><p>Pengeluaran ke unit tujuan dengan pemeriksaan stok dan ketersediaan serial number.</p></article>
                <article class="module-card"><h3>Serial number</h3><p>Pencarian unit, status ketersediaan, dan keterkaitan dengan transaksi asal.</p></article>
                <article class="module-card"><h3>Stock opname</h3><p>Snapshot stok sistem, pengisian stok fisik, selisih, dan pengesahan sesi.</p></article>
                <article class="module-card"><h3>Laporan</h3><p>Inventaris, aset masuk, aset keluar, dan opname dengan filter yang konsisten saat dicetak.</p></article>
                <article class="module-card"><h3>Pengguna dan peran</h3><p>Manajer dan Admin dengan batas akses yang diperiksa pada setiap endpoint.</p></article>
                <article class="module-card"><h3>Jejak audit</h3><p>Pelaku, waktu, tindakan, dan referensi peristiwa penting untuk kebutuhan pemeriksaan.</p></article>
            </div>
        </div>
    </section>

    <section class="section" id="keamanan">
        <div class="container security-grid">
            <div>
                <p class="eyebrow">Keamanan berlapis</p>
                <h2>Dirancang untuk data yang perlu dipertanggungjawabkan.</h2>
                <p class="section-lead">
                    Kontrol keamanan diterapkan pada autentikasi, otorisasi, validasi, transaksi database,
                    dan infrastruktur. Tidak ada sistem yang dapat dijamin kebal sepenuhnya; karena itu
                    pemantauan, pencatatan, backup, dan pemulihan juga disiapkan.
                </p>
                <ul class="check-list">
                    <li>Sesi berbasis cookie <strong>HttpOnly</strong> dengan perlindungan CSRF.</li>
                    <li>Pemeriksaan izin di backend untuk setiap endpoint dan objek.</li>
                    <li>Pembatasan laju permintaan pada login dan tindakan sensitif.</li>
                    <li>Transaksi database atomik dengan penguncian baris untuk perubahan stok.</li>
                    <li>Pesan kesalahan aman tanpa stack trace, SQL, atau detail internal.</li>
                    <li>Security header, CSP, dan kebijakan indeks untuk halaman internal.</li>
                </ul>
            </div>

            <aside class="security-panel" aria-label="Ringkasan prinsip keamanan">
                <h3>Prinsip akses</h3>
                <dl>
                    <div><dt>Autentikasi</dt><dd>Akun organisasi dan sesi terbatas</dd></div>
                    <div><dt>Otorisasi</dt><dd>Least privilege per peran</dd></div>
                    <div><dt>Integritas</dt><dd>Transaksi dan audit trail</dd></div>
                    <div><dt>Privasi</dt><dd>Halaman internal tidak diindeks</dd></div>
                </dl>
                <p class="panel-note">Data operasional hanya dapat diakses setelah login dengan akun yang terdaftar.</p>
            </aside>
        </div>
    </section>

    <section class="cta-section">
        <div class="container cta-inner">
            <div>
                <h2>Sudah memiliki akun organisasi?</h2>
                <p>Masuk untuk mencatat transaksi, menjalankan opname, atau meninjau laporan sesuai peran Anda.</p>
            </div>
            <a class="btn btn-light" href="/app/masuk">Masuk ke aplikasi</a>
        </div>
    </section>
</main>

<footer class="site-footer">
    <div class="container footer-inner">
        <div class="footer-brand">
            <span class="brand-mark small" aria-hidden="true">{{ mb_strtoupper(mb_substr($settings['organization_short_name'], 0, 1)) }}</span>
            <div>
                <strong>{{ $settings['organization_name'] }}</strong>
                <p>{{ $settings['footer_text'] }}</p>
            </div>
        </div>
        <div class="footer-meta">
            @if (! empty($settings['contact_email']))
                <a href="mailto:{{ $settings['contact_email'] }}">{{ $settings['contact_email'] }}</a>
            @endif
            <span>&copy; {{ date('Y') }} {{ $settings['organization_name'] }}</span>
        </div>
    </div>
</footer>
</body>
</html>
