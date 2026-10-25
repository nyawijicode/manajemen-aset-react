<?php

namespace Database\Seeders;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetIn;
use App\Models\AssetOut;
use App\Models\AssetSerialNumber;
use App\Models\User;
use App\Services\StockService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        if (AssetIn::query()->exists()) {
            return;
        }

        $pimpinan = User::query()->where('role', 'pimpinan')->first();
        $admin = User::query()->where('role', 'admin')->first();

        if (! $pimpinan || ! $admin) {
            return;
        }

        $stockService = app(StockService::class);

        $assets = [
            ['AST-ELK-001', 'Laptop Kantor', 'Elektronik dan Komputer', 'unit', true, 2],
            ['AST-ELK-002', 'Monitor LED 24 Inci', 'Elektronik dan Komputer', 'unit', true, 2],
            ['AST-JRG-001', 'Switch Jaringan 24 Port', 'Perlengkapan Jaringan', 'unit', true, 1],
            ['AST-PRB-001', 'Meja Kerja Staf', 'Perabot dan Furnitur', 'unit', false, 3],
            ['AST-PRB-002', 'Kursi Kerja Ergonomis', 'Perabot dan Furnitur', 'unit', false, 5],
            ['AST-ATK-001', 'Kertas HVS A4 80 gsm', 'Alat Tulis Kantor', 'rim', false, 20],
            ['AST-ATK-002', 'Pulpen Gel Hitam', 'Alat Tulis Kantor', 'kotak', false, 5],
            ['AST-KND-001', 'Sepeda Motor Operasional', 'Kendaraan', 'unit', true, 1],
        ];

        $created = [];

        foreach ($assets as [$code, $name, $categoryName, $unit, $serial, $minimum]) {
            $category = AssetCategory::query()->where('name', $categoryName)->firstOrFail();

            $created[$code] = Asset::query()->create([
                'code' => $code,
                'name' => $name,
                'category_id' => $category->id,
                'unit' => $unit,
                'has_serial_number' => $serial,
                'description' => null,
                'minimum_stock' => $minimum,
                'is_active' => true,
            ]);
        }

        $incoming = [
            ['AST-ELK-001', 4, 'Pengadaan TIK Tahun 2026', '2026-08-05', 'INV/2026/0801'],
            ['AST-ELK-002', 6, 'Pengadaan TIK Tahun 2026', '2026-08-05', 'INV/2026/0802'],
            ['AST-JRG-001', 3, 'Pengadaan Jaringan', '2026-08-12', 'INV/2026/0810'],
            ['AST-PRB-001', 12, 'Pengadaan Perabot', '2026-09-02', 'INV/2026/0902'],
            ['AST-PRB-002', 20, 'Pengadaan Perabot', '2026-09-02', 'INV/2026/0903'],
            ['AST-ATK-001', 60, 'Belanja Rutin', '2026-09-10', 'KAS/2026/091'],
            ['AST-ATK-002', 15, 'Belanja Rutin', '2026-09-10', 'KAS/2026/092'],
            ['AST-KND-001', 2, 'Pengadaan Kendaraan', '2026-09-18', 'INV/2026/0918'],
        ];

        foreach ($incoming as [$code, $qty, $supplier, $date, $prefix]) {
            $asset = $created[$code];
            $serialNumbers = [];

            if ($asset->has_serial_number) {
                for ($i = 1; $i <= $qty; $i++) {
                    $serialNumbers[] = strtoupper($prefix.'-'.Str::padLeft((string) $i, 3, '0'));
                }
            }

            $stockService->recordIn($admin, [
                'asset_id' => $asset->id,
                'transaction_date' => $date,
                'qty' => $qty,
                'supplier_or_source' => $supplier,
                'notes' => 'Data contoh untuk lingkungan pengembangan.',
                'serial_numbers' => $serialNumbers,
            ]);
        }

        $outgoing = [
            ['AST-ELK-001', 2, 'Divisi Perencanaan', '2026-10-02'],
            ['AST-ELK-002', 1, 'Tim Administrasi', '2026-10-06'],
            ['AST-ATK-001', 8, 'Divisi Keuangan', '2026-10-08'],
            ['AST-PRB-002', 4, 'Ruang Rapat Utama', '2026-10-12'],
            ['AST-KND-001', 1, 'Divisi Umum', '2026-10-15'],
            ['AST-JRG-001', 1, 'Ruang Server', '2026-10-18'],
        ];

        foreach ($outgoing as [$code, $qty, $recipient, $date]) {
            $asset = $created[$code];
            $serialIds = [];

            if ($asset->has_serial_number) {
                $serialIds = AssetSerialNumber::query()
                    ->where('asset_id', $asset->id)
                    ->where('status', 'available')
                    ->orderBy('id')
                    ->limit($qty)
                    ->pluck('id')
                    ->all();
            }

            $stockService->recordOut($admin, [
                'asset_id' => $asset->id,
                'transaction_date' => $date,
                'qty' => $qty,
                'recipient' => $recipient,
                'notes' => 'Data contoh untuk lingkungan pengembangan.',
                'serial_ids' => $serialIds,
            ]);
        }
    }
}
