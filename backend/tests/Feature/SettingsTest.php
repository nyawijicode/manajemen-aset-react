<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_settings_endpoint_returns_defaults_when_nothing_is_stored(): void
    {
        $pimpinan = User::factory()->pimpinan()->create();

        $this->actingAs($pimpinan)
            ->getJson('/api/v1/settings')
            ->assertOk()
            ->assertJsonPath('data.organization_name', 'Organisasi Anda')
            ->assertJsonPath('data.contact_email', null);
    }

    public function test_pimpinan_can_update_settings_and_public_page_reflects_them(): void
    {
        $pimpinan = User::factory()->pimpinan()->create();

        $payload = [
            'organization_name' => 'Organisasi Contoh',
            'organization_short_name' => 'Org Contoh',
            'app_name' => 'Sistem Manajemen Aset Contoh',
            'public_tagline' => 'Aset organisasi yang tertib dan transparan.',
            'footer_text' => 'Layanan internal Organisasi Contoh.',
            'contact_email' => 'aset@example.com',
        ];

        $this->actingAs($pimpinan)
            ->putJson('/api/v1/settings', $payload)
            ->assertOk()
            ->assertJsonPath('data.organization_name', 'Organisasi Contoh')
            ->assertJsonPath('data.contact_email', 'aset@example.com');

        $this->assertSame('Organisasi Contoh', Setting::value('organization_name'));

        $this->get('/')
            ->assertOk()
            ->assertSee('Organisasi Contoh')
            ->assertSee('Sistem Manajemen Aset Contoh');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'settings.updated',
            'actor_user_id' => $pimpinan->id,
        ]);
    }

    public function test_settings_update_validates_required_fields_and_email(): void
    {
        $pimpinan = User::factory()->pimpinan()->create();

        $this->actingAs($pimpinan)
            ->putJson('/api/v1/settings', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'organization_name',
                'organization_short_name',
                'app_name',
                'public_tagline',
                'footer_text',
            ]);

        $this->actingAs($pimpinan)
            ->putJson('/api/v1/settings', [
                'organization_name' => 'Organisasi',
                'organization_short_name' => 'Organisasi',
                'app_name' => 'Aplikasi',
                'public_tagline' => 'Tagline',
                'footer_text' => 'Footer',
                'contact_email' => 'bukan-email',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('contact_email');
    }
}
