<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_audit_trail_records_stock_movements_with_actor_and_request_id(): void
    {
        $pimpinan = User::factory()->pimpinan()->create();
        $asset = \App\Models\Asset::factory()->create();

        $this->actingAs($pimpinan)->postJson('/api/v1/asset-ins', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 2,
            'supplier_or_source' => 'Gudang Pusat',
        ], ['X-Request-ID' => 'req-audit-0001'])->assertCreated();

        $this->actingAs($pimpinan)->postJson('/api/v1/asset-outs', [
            'asset_id' => $asset->id,
            'transaction_date' => now()->toDateString(),
            'qty' => 1,
            'recipient' => 'Divisi Umum',
        ], ['X-Request-ID' => 'req-audit-0002'])->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'asset_in.created',
            'actor_user_id' => $pimpinan->id,
            'correlation_id' => 'req-audit-0001',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'asset_out.created',
            'actor_user_id' => $pimpinan->id,
            'correlation_id' => 'req-audit-0002',
        ]);
    }

    public function test_pimpinan_can_filter_audit_logs(): void
    {
        $pimpinan = User::factory()->pimpinan()->create();
        $logger = app(AuditLogger::class);

        $logger->log('category.created', null, ['name' => 'Elektronik'], $pimpinan);
        $logger->log('asset.created', null, ['code' => 'AST-001'], $pimpinan);
        $logger->log('category.created', null, ['name' => 'Furnitur'], $pimpinan);

        $this->actingAs($pimpinan);

        $this->getJson('/api/v1/audit-logs?action=category.created')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.metadata.name', 'Furnitur');

        $this->getJson('/api/v1/audit-logs?actor_user_id='.$pimpinan->id)
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $this->getJson('/api/v1/audit-logs?q=asset.created')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'asset.created');
    }

    public function test_audit_metadata_is_sanitized_and_truncated(): void
    {
        $actor = User::factory()->pimpinan()->create();
        $logger = app(AuditLogger::class);

        $logger->log('test.sensitive', null, [
            'password' => 'jangan-disimpan',
            'note' => 'terlihat',
            'nested' => [
                'access_token' => 'rahasia',
                'detail' => 'aman',
            ],
            'long' => str_repeat('a', 800),
        ], $actor);

        $log = AuditLog::query()->where('action', 'test.sensitive')->firstOrFail();

        $this->assertArrayNotHasKey('password', $log->metadata);
        $this->assertArrayNotHasKey('access_token', $log->metadata['nested']);
        $this->assertSame('aman', $log->metadata['nested']['detail']);
        $this->assertSame('terlihat', $log->metadata['note']);
        $this->assertSame(501, mb_strlen($log->metadata['long']));
    }
}
