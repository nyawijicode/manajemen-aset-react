<?php

namespace Tests\Feature;

use App\Enums\OpnameStatus;
use App\Models\Asset;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockOpnameTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $pimpinan;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
        $this->pimpinan = User::factory()->pimpinan()->create();
    }

    public function test_draft_opname_snapshots_all_active_assets(): void
    {
        $activeOne = Asset::factory()->create(['stock' => 4]);
        $activeTwo = Asset::factory()->create(['stock' => 7]);
        $inactive = Asset::factory()->inactive()->create(['stock' => 9]);

        $response = $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
            'description' => 'Opname akhir bulan',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.status_label', 'Draf')
            ->assertJsonPath('data.items_count', 2)
            ->assertJsonPath('data.description', 'Opname akhir bulan');

        $this->assertStringStartsWith('OPN-', (string) $response->json('data.reference'));
        $this->assertDatabaseHas('stock_opname_items', [
            'asset_id' => $activeOne->id,
            'system_qty_snapshot' => 4,
            'physical_qty' => null,
            'difference' => null,
        ]);
        $this->assertDatabaseHas('stock_opname_items', [
            'asset_id' => $activeTwo->id,
            'system_qty_snapshot' => 7,
        ]);
        $this->assertDatabaseMissing('stock_opname_items', ['asset_id' => $inactive->id]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'stock_opname.created',
            'entity_id' => $response->json('data.id'),
        ]);
    }

    public function test_opname_can_be_limited_to_selected_assets(): void
    {
        $selected = Asset::factory()->create(['stock' => 3]);
        Asset::factory()->create(['stock' => 8]);

        $response = $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
            'asset_ids' => [$selected->id],
        ]);

        $response->assertCreated()->assertJsonPath('data.items_count', 1);
        $this->assertDatabaseCount('stock_opname_items', 1);
        $this->assertDatabaseHas('stock_opname_items', ['asset_id' => $selected->id]);
    }

    public function test_opname_snapshot_is_not_affected_by_later_stock_movements(): void
    {
        $asset = Asset::factory()->create(['stock' => 4]);

        $opnameId = $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
        ])->assertCreated()->json('data.id');

        $this->actingAs($this->admin)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 6,
            'supplier_or_source' => 'Gudang Pusat',
        ])->assertCreated();

        $this->assertSame(10, $asset->fresh()->stock);

        $item = StockOpnameItem::query()->where('stock_opname_id', $opnameId)->firstOrFail();
        $this->assertSame(4, $item->system_qty_snapshot);
    }

    public function test_update_records_physical_quantity_and_difference(): void
    {
        $asset = Asset::factory()->create(['stock' => 4]);
        $secondAsset = Asset::factory()->create(['stock' => 5]);

        $opname = $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
        ])->assertCreated()->json('data');

        $items = collect($opname['items'])->keyBy('asset_id');

        $response = $this->actingAs($this->admin)->putJson('/api/v1/stock-opnames/'.$opname['id'], [
            'description' => 'Dihitung ulang',
            'items' => [
                [
                    'id' => $items[$asset->id]['id'],
                    'physical_qty' => 3,
                    'notes' => 'Kurang satu',
                ],
                [
                    'id' => $items[$secondAsset->id]['id'],
                    'physical_qty' => 7,
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.description', 'Dihitung ulang')
            ->assertJsonPath('data.summary.filled', 2)
            ->assertJsonPath('data.summary.match', 0)
            ->assertJsonPath('data.summary.less', 1)
            ->assertJsonPath('data.summary.more', 1);

        $this->assertDatabaseHas('stock_opname_items', [
            'stock_opname_id' => $opname['id'],
            'asset_id' => $asset->id,
            'physical_qty' => 3,
            'difference' => -1,
            'notes' => 'Kurang satu',
        ]);
        $this->assertDatabaseHas('stock_opname_items', [
            'stock_opname_id' => $opname['id'],
            'asset_id' => $secondAsset->id,
            'physical_qty' => 7,
            'difference' => 2,
        ]);

        $this->assertSame(4, $asset->fresh()->stock);
        $this->assertSame(5, $secondAsset->fresh()->stock);
    }

    public function test_finalize_requires_every_line_to_be_counted(): void
    {
        Asset::factory()->create(['stock' => 2]);

        $opnameId = $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
        ])->assertCreated()->json('data.id');

        $this->actingAs($this->pimpinan)->postJson('/api/v1/stock-opnames/'.$opnameId.'/finalize')
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');

        $this->assertSame(OpnameStatus::Draft, StockOpname::query()->findOrFail($opnameId)->status);
    }

    public function test_pimpinan_can_finalize_opname_without_changing_stock(): void
    {
        $asset = Asset::factory()->create(['stock' => 4]);

        $opname = $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
        ])->assertCreated()->json('data');

        $this->actingAs($this->admin)->putJson('/api/v1/stock-opnames/'.$opname['id'], [
            'items' => [
                [
                    'id' => $opname['items'][0]['id'],
                    'physical_qty' => 6,
                ],
            ],
        ])->assertOk();

        $response = $this->actingAs($this->pimpinan)->postJson('/api/v1/stock-opnames/'.$opname['id'].'/finalize');

        $response->assertOk()
            ->assertJsonPath('data.status', 'finalized')
            ->assertJsonPath('data.approved_by', $this->pimpinan->id)
            ->assertJsonPath('data.summary.more', 1);

        $stored = StockOpname::query()->findOrFail($opname['id']);
        $this->assertSame(OpnameStatus::Finalized, $stored->status);
        $this->assertNotNull($stored->approved_at);
        $this->assertSame($this->pimpinan->id, $stored->approved_by);

        $this->assertSame(4, $asset->fresh()->stock);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'stock_opname.finalized',
            'entity_id' => $opname['id'],
            'actor_user_id' => $this->pimpinan->id,
        ]);
    }

    public function test_admin_cannot_finalize_opname(): void
    {
        Asset::factory()->create(['stock' => 2]);

        $opnameId = $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
        ])->assertCreated()->json('data.id');

        $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames/'.$opnameId.'/finalize')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN');

        $this->assertSame(OpnameStatus::Draft, StockOpname::query()->findOrFail($opnameId)->status);
    }

    public function test_finalized_opname_is_immutable(): void
    {
        $asset = Asset::factory()->create(['stock' => 4]);

        $opname = $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
        ])->assertCreated()->json('data');

        $this->actingAs($this->admin)->putJson('/api/v1/stock-opnames/'.$opname['id'], [
            'items' => [
                ['id' => $opname['items'][0]['id'], 'physical_qty' => 4],
            ],
        ])->assertOk();

        $this->actingAs($this->pimpinan)->postJson('/api/v1/stock-opnames/'.$opname['id'].'/finalize')
            ->assertOk();

        $this->actingAs($this->admin)->putJson('/api/v1/stock-opnames/'.$opname['id'], [
            'description' => 'Percobaan ubah',
        ])->assertStatus(409);

        $this->actingAs($this->pimpinan)->postJson('/api/v1/stock-opnames/'.$opname['id'].'/finalize')
            ->assertStatus(409);

        $stored = StockOpname::query()->findOrFail($opname['id']);
        $this->assertNotSame('Percobaan ubah', $stored->description);
        $this->assertSame(4, $asset->fresh()->stock);
    }

    public function test_update_rejects_unknown_opname_item(): void
    {
        Asset::factory()->create(['stock' => 2]);

        $opnameId = $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
        ])->assertCreated()->json('data.id');

        $this->actingAs($this->admin)->putJson('/api/v1/stock-opnames/'.$opnameId, [
            'items' => [
                ['id' => 999999, 'physical_qty' => 1],
            ],
        ])->assertStatus(422)->assertJsonValidationErrors('items');
    }

    public function test_opname_rejects_invalid_or_empty_asset_selection(): void
    {
        Asset::factory()->inactive()->create();

        $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
            'asset_ids' => [999999],
        ])->assertStatus(422)->assertJsonValidationErrors('asset_ids.0');

        $this->actingAs($this->admin)->postJson('/api/v1/stock-opnames', [
            'opname_date' => now()->toDateString(),
        ])->assertStatus(422)->assertJsonValidationErrors('asset_ids');
    }
}
