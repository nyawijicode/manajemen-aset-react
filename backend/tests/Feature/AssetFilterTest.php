<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssetFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_normal_stock_filter_excludes_empty_and_critical_assets(): void
    {
        $actor = User::factory()->admin()->create();

        $normal = Asset::factory()->create([
            'code' => 'AST-NORMAL',
            'minimum_stock' => 2,
            'stock' => 3,
        ]);
        $critical = Asset::factory()->create([
            'code' => 'AST-CRITICAL',
            'minimum_stock' => 2,
            'stock' => 2,
        ]);
        $empty = Asset::factory()->create([
            'code' => 'AST-EMPTY',
            'minimum_stock' => 0,
            'stock' => 0,
        ]);

        $response = $this->actingAs($actor)->getJson('/api/v1/assets?stock_status=normal');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $normal->id);

        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertNotContains($critical->id, $ids);
        $this->assertNotContains($empty->id, $ids);
    }
}
