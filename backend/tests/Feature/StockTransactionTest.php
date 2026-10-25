<?php

namespace Tests\Feature;

use App\Enums\SerialStatus;
use App\Models\Asset;
use App\Models\AssetIn;
use App\Models\AssetOut;
use App\Models\AssetSerialNumber;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockTransactionTest extends TestCase
{
    use RefreshDatabase;

    private User $actor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actor = User::factory()->admin()->create();
    }

    public function test_incoming_transaction_increases_stock_and_writes_audit_trail(): void
    {
        $asset = Asset::factory()->create(['stock' => 2, 'unit' => 'unit']);

        $response = $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 3,
            'supplier_or_source' => '  Gudang Pusat  ',
            'notes' => 'Pengadaan rutin',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.qty', 3)
            ->assertJsonPath('data.supplier_or_source', 'Gudang Pusat')
            ->assertJsonPath('data.asset.id', $asset->id);

        $this->assertStringStartsWith('IN-', (string) $response->json('data.reference'));
        $this->assertSame(5, $asset->fresh()->stock);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'asset_in.created',
            'entity_type' => AssetIn::class,
            'entity_id' => $response->json('data.id'),
            'actor_user_id' => $this->actor->id,
        ]);
    }

    public function test_incoming_serial_numbers_are_normalized_unique_and_available(): void
    {
        $asset = Asset::factory()->withSerialNumber()->create();

        $response = $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 2,
            'supplier_or_source' => 'PT Sumber Komputer',
            'serial_numbers' => [' sn-aaa-001 ', 'SN-AAA-002'],
        ]);

        $response->assertCreated();

        $this->assertSame(2, $asset->fresh()->stock);
        $this->assertDatabaseHas('asset_serial_numbers', [
            'asset_id' => $asset->id,
            'serial_number' => 'SN-AAA-001',
            'status' => SerialStatus::Available->value,
        ]);
        $this->assertDatabaseHas('asset_serial_numbers', [
            'asset_id' => $asset->id,
            'serial_number' => 'SN-AAA-002',
        ]);
    }

    public function test_serial_asset_requires_one_serial_number_per_unit(): void
    {
        $asset = Asset::factory()->withSerialNumber()->create();

        $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 2,
            'supplier_or_source' => 'PT Sumber Komputer',
            'serial_numbers' => ['SN-HANYA-SATU'],
        ])->assertStatus(422)->assertJsonValidationErrors('serial_numbers');

        $this->assertSame(0, $asset->fresh()->stock);
        $this->assertDatabaseCount('asset_ins', 0);
    }

    public function test_serial_numbers_are_globally_unique_across_assets(): void
    {
        $first = Asset::factory()->withSerialNumber()->create();
        $second = Asset::factory()->withSerialNumber()->create();

        $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $first->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'supplier_or_source' => 'PT Sumber Komputer',
            'serial_numbers' => ['SN-GLOBAL-01'],
        ])->assertCreated();

        $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $second->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'supplier_or_source' => 'PT Sumber Komputer',
            'serial_numbers' => ['SN-GLOBAL-01'],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('serial_numbers')
            ->assertJsonPath('errors.serial_numbers.0', 'Serial number berikut sudah terdaftar: SN-GLOBAL-01.');

        $this->assertSame(0, $second->fresh()->stock);
        $this->assertSame(1, AssetIn::query()->count());
    }

    public function test_asset_without_serial_number_rejects_serial_numbers(): void
    {
        $asset = Asset::factory()->create(['has_serial_number' => false]);

        $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'supplier_or_source' => 'Gudang Pusat',
            'serial_numbers' => ['SN-TIDAK-BOLEH'],
        ])->assertStatus(422)->assertJsonValidationErrors('serial_numbers');
    }

    public function test_inactive_asset_cannot_receive_incoming_transaction(): void
    {
        $asset = Asset::factory()->inactive()->create();

        $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'supplier_or_source' => 'Gudang Pusat',
        ])->assertStatus(409);

        $this->assertSame(0, $asset->fresh()->stock);
    }

    public function test_future_transaction_date_is_rejected(): void
    {
        $asset = Asset::factory()->create();

        $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->addDay()->toDateString(),
            'qty' => 1,
            'supplier_or_source' => 'Gudang Pusat',
        ])->assertStatus(422)->assertJsonValidationErrors('transaction_date');
    }

    public function test_idempotency_key_prevents_duplicate_incoming_transactions(): void
    {
        $asset = Asset::factory()->create();
        $payload = [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 3,
            'supplier_or_source' => 'Gudang Pusat',
        ];
        $headers = ['Idempotency-Key' => 'incoming-key-0001'];

        $first = $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', $payload, $headers);
        $first->assertCreated();

        $second = $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', $payload, $headers);
        $second->assertOk()->assertJsonPath('data.id', $first->json('data.id'));

        $this->assertSame(3, $asset->fresh()->stock);
        $this->assertSame(1, AssetIn::query()->count());
    }

    public function test_malformed_idempotency_key_is_rejected(): void
    {
        $asset = Asset::factory()->create();

        $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'supplier_or_source' => 'Gudang Pusat',
        ], ['Idempotency-Key' => 'bad key!'])->assertStatus(422)
            ->assertJsonValidationErrors('idempotency_key');
    }

    public function test_outgoing_transaction_decreases_stock(): void
    {
        $asset = Asset::factory()->create(['stock' => 5]);

        $response = $this->actingAs($this->actor)->postJson('/api/v1/asset-outs', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 2,
            'recipient' => 'Divisi Umum',
        ]);

        $response->assertCreated()->assertJsonPath('data.qty', 2);

        $this->assertStringStartsWith('OUT-', (string) $response->json('data.reference'));
        $this->assertSame(3, $asset->fresh()->stock);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'asset_out.created',
            'entity_id' => $response->json('data.id'),
        ]);
    }

    public function test_outgoing_transaction_rejects_insufficient_stock(): void
    {
        $asset = Asset::factory()->create(['stock' => 2, 'unit' => 'unit']);

        $this->actingAs($this->actor)->postJson('/api/v1/asset-outs', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 3,
            'recipient' => 'Divisi Umum',
        ])->assertStatus(409)
            ->assertJsonPath('message', 'Stok tidak mencukupi. Stok tersedia saat ini 2 unit.');

        $this->assertSame(2, $asset->fresh()->stock);
        $this->assertSame(0, AssetOut::query()->count());
    }

    public function test_inactive_asset_cannot_be_issued(): void
    {
        $asset = Asset::factory()->inactive()->create(['stock' => 5]);

        $this->actingAs($this->actor)->postJson('/api/v1/asset-outs', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'recipient' => 'Divisi Umum',
        ])->assertStatus(409);

        $this->assertSame(5, $asset->fresh()->stock);
    }

    public function test_outgoing_serial_number_is_marked_out_and_cannot_be_reused(): void
    {
        $asset = Asset::factory()->withSerialNumber()->create();

        $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 2,
            'supplier_or_source' => 'PT Sumber Komputer',
            'serial_numbers' => ['SN-OUT-001', 'SN-OUT-002'],
        ])->assertCreated();

        $serial = AssetSerialNumber::query()->where('serial_number', 'SN-OUT-001')->firstOrFail();

        $response = $this->actingAs($this->actor)->postJson('/api/v1/asset-outs', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'recipient' => 'Divisi Umum',
            'serial_ids' => [$serial->id],
        ]);

        $response->assertCreated();

        $serial->refresh();
        $this->assertSame(SerialStatus::Out, $serial->status);
        $this->assertSame($response->json('data.id'), $serial->asset_out_id);
        $this->assertSame(1, $asset->fresh()->stock);

        $this->actingAs($this->actor)->postJson('/api/v1/asset-outs', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'recipient' => 'Divisi Umum',
            'serial_ids' => [$serial->id],
        ])->assertStatus(409);

        $this->assertSame(1, $asset->fresh()->stock);
        $this->assertSame(1, AssetOut::query()->count());
    }

    public function test_serial_quantity_must_match_outgoing_quantity(): void
    {
        $asset = Asset::factory()->withSerialNumber()->create();

        $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 2,
            'supplier_or_source' => 'PT Sumber Komputer',
            'serial_numbers' => ['SN-QTY-001', 'SN-QTY-002'],
        ])->assertCreated();

        $serial = AssetSerialNumber::query()->where('serial_number', 'SN-QTY-001')->firstOrFail();

        $this->actingAs($this->actor)->postJson('/api/v1/asset-outs', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 2,
            'recipient' => 'Divisi Umum',
            'serial_ids' => [$serial->id],
        ])->assertStatus(422)->assertJsonValidationErrors('serial_ids');

        $this->assertSame(2, $asset->fresh()->stock);
    }

    public function test_asset_without_serial_number_rejects_serial_ids_on_outgoing(): void
    {
        $serialAsset = Asset::factory()->withSerialNumber()->create();
        $plainAsset = Asset::factory()->create(['stock' => 1]);

        $this->actingAs($this->actor)->postJson('/api/v1/asset-ins', [
            'asset_id' => $serialAsset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'supplier_or_source' => 'PT Sumber Komputer',
            'serial_numbers' => ['SN-LAIN-001'],
        ])->assertCreated();

        $serial = AssetSerialNumber::query()->where('serial_number', 'SN-LAIN-001')->firstOrFail();

        $this->actingAs($this->actor)->postJson('/api/v1/asset-outs', [
            'asset_id' => $plainAsset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'recipient' => 'Divisi Umum',
            'serial_ids' => [$serial->id],
        ])->assertStatus(422)->assertJsonValidationErrors('serial_ids');
    }
}
