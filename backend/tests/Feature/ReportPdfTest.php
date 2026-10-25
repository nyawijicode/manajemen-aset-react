<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetIn;
use App\Models\AssetOut;
use App\Models\AuditLog;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ReportPdfTest extends TestCase
{
    use RefreshDatabase;

    private User $actor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actor = User::factory()->admin()->create();
    }

    public function test_pdf_export_requires_authentication(): void
    {
        $this->getJson('/api/v1/reports/assets/pdf')->assertUnauthorized();
    }

    public function test_inventory_pdf_is_returned_as_download_and_recorded_in_audit_trail(): void
    {
        Asset::factory()->create([
            'code' => 'AST-PDF-001',
            'name' => 'Laptop Uji Laporan',
            'stock' => 4,
            'minimum_stock' => 1,
        ]);

        $response = $this->actingAs($this->actor)
            ->get('/api/v1/reports/assets/pdf', ['Accept' => 'application/pdf']);

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));

        $disposition = (string) $response->headers->get('Content-Disposition');
        $this->assertStringContainsString('attachment', $disposition);
        $this->assertStringContainsString('laporan-inventaris-aset-', $disposition);
        $this->assertStringContainsString('.pdf', $disposition);
        $this->assertStringStartsWith('%PDF-', (string) $response->getContent());
        $this->assertGreaterThan(1000, strlen((string) $response->getContent()));

        $log = AuditLog::query()->where('action', 'report.assets_exported')->firstOrFail();

        $this->assertSame($this->actor->id, $log->actor_user_id);
        $this->assertSame('pdf', $log->metadata['format']);
        $this->assertSame('assets', $log->metadata['report']);
        $this->assertSame(1, $log->metadata['rows']);
    }

    public function test_transaction_pdf_applies_date_filters_and_audits_the_scope(): void
    {
        $asset = Asset::factory()->create(['code' => 'AST-TRX-001', 'name' => 'Printer Uji']);

        AssetIn::factory()->create([
            'asset_id' => $asset->id,
            'transaction_date' => '2026-09-01',
            'qty' => 2,
            'created_by' => $this->actor->id,
        ]);

        AssetIn::factory()->create([
            'asset_id' => $asset->id,
            'transaction_date' => '2026-09-20',
            'qty' => 5,
            'created_by' => $this->actor->id,
        ]);

        $response = $this->actingAs($this->actor)->get(
            '/api/v1/reports/asset-ins/pdf?date_from=2026-09-10&date_to=2026-09-30',
            ['Accept' => 'application/pdf'],
        );

        $response->assertOk();
        $this->assertStringStartsWith('%PDF-', (string) $response->getContent());

        $log = AuditLog::query()->where('action', 'report.asset_ins_exported')->firstOrFail();
        $expectedDate = Carbon::parse('2026-09-10')->translatedFormat('d M Y');

        $this->assertSame(1, $log->metadata['rows']);
        $this->assertSame(1, $log->metadata['total_rows']);
        $this->assertSame($expectedDate, $log->metadata['filters']['Dari tanggal']);
        $this->assertSame('asset-ins', $log->metadata['report']);
    }

    public function test_long_report_spans_multiple_pages(): void
    {
        Asset::factory()->count(45)->create([
            'stock' => 3,
            'minimum_stock' => 1,
        ]);

        $response = $this->actingAs($this->actor)
            ->get('/api/v1/reports/assets/pdf', ['Accept' => 'application/pdf']);

        $response->assertOk();
        $content = (string) $response->getContent();

        $this->assertStringStartsWith('%PDF-', $content);
        $this->assertGreaterThanOrEqual(2, preg_match_all('/\/Type\s*\/Page[^s]/', $content));
    }

    public function test_all_report_types_can_be_exported_to_pdf(): void
    {
        $asset = Asset::factory()->create(['code' => 'AST-ALL-001', 'name' => 'Aset Lengkap']);

        AssetIn::factory()->create([
            'asset_id' => $asset->id,
            'created_by' => $this->actor->id,
        ]);

        AssetOut::factory()->create([
            'asset_id' => $asset->id,
            'created_by' => $this->actor->id,
        ]);

        $opname = StockOpname::factory()->create(['created_by' => $this->actor->id]);

        StockOpnameItem::query()->create([
            'stock_opname_id' => $opname->id,
            'asset_id' => $asset->id,
            'system_qty_snapshot' => 5,
            'physical_qty' => 4,
            'difference' => -1,
            'notes' => 'Kurang satu unit',
        ]);

        $routes = [
            '/api/v1/reports/assets/pdf',
            '/api/v1/reports/asset-ins/pdf',
            '/api/v1/reports/asset-outs/pdf',
            '/api/v1/reports/stock-opnames/pdf',
        ];

        foreach ($routes as $route) {
            $response = $this->actingAs($this->actor)->get($route, ['Accept' => 'application/pdf']);

            $response->assertOk();
            $this->assertSame('application/pdf', $response->headers->get('Content-Type'), $route);
            $this->assertStringStartsWith('%PDF-', (string) $response->getContent(), $route);
        }

        $this->assertDatabaseHas('audit_logs', ['action' => 'report.asset_outs_exported']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'report.stock_opnames_exported']);
    }
}
