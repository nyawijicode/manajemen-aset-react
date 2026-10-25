<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_use_operational_endpoints_but_not_privileged_ones(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin);

        foreach ([
            '/api/v1/dashboard',
            '/api/v1/assets',
            '/api/v1/categories',
            '/api/v1/serial-numbers',
            '/api/v1/asset-ins',
            '/api/v1/asset-outs',
            '/api/v1/stock-opnames',
            '/api/v1/reports/assets',
            '/api/v1/reports/asset-ins',
            '/api/v1/reports/asset-outs',
            '/api/v1/reports/stock-opnames',
        ] as $uri) {
            $this->getJson($uri)->assertOk();
        }

        foreach ([
            '/api/v1/users',
            '/api/v1/audit-logs',
            '/api/v1/settings',
        ] as $uri) {
            $this->getJson($uri)
                ->assertForbidden()
                ->assertJsonPath('code', 'FORBIDDEN');
        }
    }

    public function test_admin_cannot_manage_assets_categories_users_or_settings(): void
    {
        $admin = User::factory()->admin()->create();
        $asset = Asset::factory()->create();
        $category = AssetCategory::factory()->create();
        $otherUser = User::factory()->create();

        $this->actingAs($admin);

        $this->postJson('/api/v1/assets', [])->assertForbidden();
        $this->putJson('/api/v1/assets/'.$asset->id, [])->assertForbidden();
        $this->deleteJson('/api/v1/assets/'.$asset->id)->assertForbidden();

        $this->postJson('/api/v1/categories', ['name' => 'Kategori Baru'])->assertForbidden();
        $this->putJson('/api/v1/categories/'.$category->id, ['name' => 'Ubah'])->assertForbidden();
        $this->deleteJson('/api/v1/categories/'.$category->id)->assertForbidden();

        $this->postJson('/api/v1/users', [])->assertForbidden();
        $this->putJson('/api/v1/users/'.$otherUser->id, [])->assertForbidden();
        $this->patchJson('/api/v1/users/'.$otherUser->id.'/status', ['is_active' => false])->assertForbidden();
        $this->postJson('/api/v1/users/'.$otherUser->id.'/reset-password', [])->assertForbidden();

        $this->putJson('/api/v1/settings', [])->assertForbidden();
    }

    public function test_pimpinan_can_access_privileged_endpoints(): void
    {
        $pimpinan = User::factory()->pimpinan()->create();
        $category = AssetCategory::factory()->create();

        $this->actingAs($pimpinan);

        $this->getJson('/api/v1/users')->assertOk();
        $this->getJson('/api/v1/audit-logs')->assertOk();
        $this->getJson('/api/v1/settings')->assertOk();

        $this->postJson('/api/v1/assets', [
            'code' => 'AST/TEST/001',
            'name' => 'Laptop Uji',
            'category_id' => $category->id,
            'unit' => 'unit',
            'has_serial_number' => false,
            'minimum_stock' => 1,
        ])->assertCreated()->assertJsonPath('data.code', 'AST/TEST/001');

        $this->postJson('/api/v1/categories', [
            'name' => 'Kategori Uji',
        ])->assertCreated();
    }

    public function test_inactive_user_existing_session_is_rejected(): void
    {
        $user = User::factory()->admin()->inactive()->create();

        $this->actingAs($user)
            ->getJson('/api/v1/dashboard')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'ACCOUNT_INACTIVE');
    }
}
