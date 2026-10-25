<?php

namespace Tests\Feature;

use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_landing_exposes_seo_metadata_and_security_headers(): void
    {
        Setting::query()->create(['key' => 'organization_name', 'value' => 'Organisasi Contoh']);
        Setting::query()->create(['key' => 'organization_short_name', 'value' => 'Organisasi']);
        Setting::query()->create(['key' => 'app_name', 'value' => 'Sistem Aset Organisasi']);
        Setting::query()->create(['key' => 'public_tagline', 'value' => 'Aset tertib dan akuntabel.']);

        $response = $this->get('/');

        $response->assertOk()
            ->assertSee('Organisasi Contoh')
            ->assertSee('Sistem Aset Organisasi')
            ->assertSee('name="robots" content="index, follow, max-image-preview:large"', false)
            ->assertSee('rel="canonical"', false)
            ->assertSee('og:image', false)
            ->assertSee('application/ld+json', false)
            ->assertSee('"@context": "https://schema.org"', false)
            ->assertSee('"@type": "Organization"', false)
            ->assertSee('inLanguage', false);

        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        $csp = (string) $response->headers->get('Content-Security-Policy');
        $this->assertStringContainsString("default-src 'self'", $csp);
        $this->assertStringContainsString("script-src 'self'", $csp);
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);
    }

    public function test_internal_spa_is_marked_noindex_and_not_cached(): void
    {
        $response = $this->get('/app/masuk');

        $response->assertOk()
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');

        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));

        $file = $response->getFile();
        $shell = (string) file_get_contents($file->getPathname());
        $this->assertStringContainsString('noindex, nofollow', $shell);
        $this->assertStringContainsString('/ui/assets/', $shell);
    }

    public function test_robots_txt_blocks_internal_and_api_paths(): void
    {
        $response = $this->get('/robots.txt');

        $response->assertOk();
        $response->assertSee('Disallow: /app', false);
        $response->assertSee('Disallow: /ui', false);
        $response->assertSee('Disallow: /api', false);
        $response->assertSee('Disallow: /sanctum', false);
        $response->assertSee('Sitemap: '.url('/sitemap.xml'), false);
    }

    public function test_sitemap_lists_only_the_public_landing(): void
    {
        $response = $this->get('/sitemap.xml');

        $response->assertOk();
        $response->assertSee('<loc>'.url('/').'</loc>', false);
        $this->assertStringNotContainsString('/app', $response->getContent());
    }

    public function test_api_responses_are_noindex_and_have_strict_api_csp(): void
    {
        $response = $this->getJson('/api/v1/assets');

        $response->assertUnauthorized()
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');

        $this->assertSame(
            "default-src 'none'; frame-ancestors 'none'",
            (string) $response->headers->get('Content-Security-Policy')
        );
        $this->assertNotEmpty($response->headers->get('X-Request-ID'));
    }

    public function test_login_page_redirects_to_internal_spa(): void
    {
        $this->get('/login')->assertRedirect('/app/masuk');
        $this->get('/masuk')->assertRedirect('/app/masuk');
    }

    public function test_public_landing_escapes_user_controlled_seo_values(): void
    {
        Setting::query()->create([
            'key' => 'organization_name',
            'value' => 'Organisasi </script><script>alert(1)</script>',
        ]);
        Setting::query()->create([
            'key' => 'app_name',
            'value' => 'Aplikasi </script><script>alert(1)</script>',
        ]);

        $response = $this->get('/');

        $response->assertOk();
        $response->assertDontSee('</script><script>alert(1)</script>', false);
    }
}
