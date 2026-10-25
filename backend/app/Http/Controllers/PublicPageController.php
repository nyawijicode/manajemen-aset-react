<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Response;
use Illuminate\View\View;

class PublicPageController extends Controller
{
    public function landing(): View
    {
        $settings = [
            'organization_name' => Setting::value('organization_name', 'Organisasi Anda'),
            'organization_short_name' => Setting::value('organization_short_name', 'Organisasi'),
            'app_name' => Setting::value('app_name', 'Sistem Informasi Manajemen Aset'),
            'public_tagline' => Setting::value('public_tagline', 'Pengelolaan aset yang tertib, transparan, dan dapat diaudit.'),
            'footer_text' => Setting::value('footer_text', 'Sistem manajemen aset untuk organisasi, kampus, dan tim kerja.'),
            'contact_email' => Setting::value('contact_email'),
        ];

        return view('welcome', [
            'settings' => $settings,
            'canonical' => url('/'),
            'metaDescription' => $settings['app_name'].' — '.$settings['public_tagline'],
        ]);
    }

    public function robots(): Response
    {
        $lines = [
            'User-agent: *',
            'Allow: /$',
            'Disallow: /app',
            'Disallow: /ui',
            'Disallow: /api',
            'Disallow: /sanctum',
            'Disallow: /up',
            '',
            'Sitemap: '.url('/sitemap.xml'),
            '',
        ];

        return response(implode("\n", $lines), 200, [
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    public function sitemap(): Response
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";
        $xml .= '  <url>'."\n";
        $xml .= '    <loc>'.e(url('/')).'</loc>'."\n";
        $xml .= '    <lastmod>'.now()->toDateString().'</lastmod>'."\n";
        $xml .= '    <changefreq>monthly</changefreq>'."\n";
        $xml .= '    <priority>1.0</priority>'."\n";
        $xml .= '  </url>'."\n";
        $xml .= '</urlset>'."\n";

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
