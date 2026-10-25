<?php

namespace App\Services;

use App\Enums\SerialStatus;
use App\Models\Asset;
use App\Models\AssetIn;
use App\Models\AssetOut;
use App\Models\AssetSerialNumber;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockService
{
    public function __construct(
        private readonly DocumentNumber $documentNumber,
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array{asset_id:int, transaction_date:string, qty:int, supplier_or_source:string, notes?:string|null, serial_numbers?:array<int, string>|null, idempotency_key?:string|null}  $data
     */
    public function recordIn(User $actor, array $data): AssetIn
    {
        return DB::transaction(function () use ($actor, $data): AssetIn {
            $asset = Asset::query()->whereKey($data['asset_id'])->lockForUpdate()->firstOrFail();

            if (! $asset->is_active) {
                abort(409, 'Aset tidak aktif sehingga tidak dapat menerima transaksi masuk.');
            }

            $serialNumbers = $this->normalizeSerialNumbers($data['serial_numbers'] ?? []);
            $this->assertSerialNumbersForIn($asset, $serialNumbers, (int) $data['qty']);

            $assetIn = AssetIn::query()->create([
                'reference' => $this->documentNumber->make('IN', AssetIn::class),
                'asset_id' => $asset->id,
                'transaction_date' => $data['transaction_date'],
                'qty' => $data['qty'],
                'supplier_or_source' => trim($data['supplier_or_source']),
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->id,
                'idempotency_key' => $data['idempotency_key'] ?? null,
            ]);

            foreach ($serialNumbers as $serialNumber) {
                AssetSerialNumber::query()->create([
                    'asset_id' => $asset->id,
                    'asset_in_id' => $assetIn->id,
                    'serial_number' => $serialNumber,
                    'status' => SerialStatus::Available,
                ]);
            }

            $asset->stock = $asset->stock + (int) $data['qty'];
            $asset->save();

            $this->auditLogger->log('asset_in.created', $assetIn, [
                'reference' => $assetIn->reference,
                'asset_code' => $asset->code,
                'qty' => $assetIn->qty,
                'serial_count' => count($serialNumbers),
            ], $actor);

            return $assetIn->load(['asset.category', 'creator', 'serialNumbers']);
        }, 3);
    }

    /**
     * @param  array{asset_id:int, transaction_date:string, qty:int, recipient:string, notes?:string|null, serial_ids?:array<int, int>|null, idempotency_key?:string|null}  $data
     */
    public function recordOut(User $actor, array $data): AssetOut
    {
        return DB::transaction(function () use ($actor, $data): AssetOut {
            $asset = Asset::query()->whereKey($data['asset_id'])->lockForUpdate()->firstOrFail();

            if (! $asset->is_active) {
                abort(409, 'Aset tidak aktif sehingga tidak dapat dikeluarkan.');
            }

            $qty = (int) $data['qty'];

            if ($qty > $asset->stock) {
                abort(409, 'Stok tidak mencukupi. Stok tersedia saat ini '.$asset->stock.' '.$asset->unit.'.');
            }

            $serialIds = collect($data['serial_ids'] ?? [])->map(fn ($id): int => (int) $id)->unique()->values();
            $selectedSerials = collect();

            if ($asset->has_serial_number) {
                if ($serialIds->count() !== $qty) {
                    throw ValidationException::withMessages([
                        'serial_ids' => 'Jumlah serial number yang dipilih harus sama dengan kuantitas keluar.',
                    ]);
                }

                $selectedSerials = AssetSerialNumber::query()
                    ->whereIn('id', $serialIds)
                    ->where('asset_id', $asset->id)
                    ->lockForUpdate()
                    ->get();

                if ($selectedSerials->count() !== $qty || $selectedSerials->contains(fn (AssetSerialNumber $sn): bool => $sn->status !== SerialStatus::Available)) {
                    abort(409, 'Salah satu serial number sudah tidak tersedia. Muat ulang data lalu pilih kembali.');
                }
            } elseif ($serialIds->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'serial_ids' => 'Aset ini tidak menggunakan serial number.',
                ]);
            }

            $assetOut = AssetOut::query()->create([
                'reference' => $this->documentNumber->make('OUT', AssetOut::class),
                'asset_id' => $asset->id,
                'transaction_date' => $data['transaction_date'],
                'qty' => $qty,
                'recipient' => trim($data['recipient']),
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->id,
                'idempotency_key' => $data['idempotency_key'] ?? null,
            ]);

            foreach ($selectedSerials as $serial) {
                $serial->status = SerialStatus::Out;
                $serial->asset_out_id = $assetOut->id;
                $serial->save();
            }

            $asset->stock = $asset->stock - $qty;
            $asset->save();

            $this->auditLogger->log('asset_out.created', $assetOut, [
                'reference' => $assetOut->reference,
                'asset_code' => $asset->code,
                'qty' => $qty,
                'serial_numbers' => $selectedSerials->pluck('serial_number')->all(),
            ], $actor);

            return $assetOut->load(['asset.category', 'creator', 'serialNumbers']);
        }, 3);
    }

    /**
     * @param  array<int, mixed>  $serialNumbers
     * @return list<string>
     */
    private function normalizeSerialNumbers(array $serialNumbers): array
    {
        return collect($serialNumbers)
            ->map(function ($value): string {
                return Str::upper(Str::squish(trim((string) $value)));
            })
            ->filter(fn (string $value): bool => $value !== '')
            ->values()
            ->all();
    }

    /**
     * @param  list<string>  $serialNumbers
     */
    private function assertSerialNumbersForIn(Asset $asset, array $serialNumbers, int $qty): void
    {
        if (! $asset->has_serial_number) {
            if ($serialNumbers !== []) {
                throw ValidationException::withMessages([
                    'serial_numbers' => 'Aset ini tidak menggunakan serial number.',
                ]);
            }

            return;
        }

        if (count($serialNumbers) !== $qty) {
            throw ValidationException::withMessages([
                'serial_numbers' => 'Jumlah serial number harus sama dengan kuantitas masuk.',
            ]);
        }

        if (count(array_unique($serialNumbers)) !== count($serialNumbers)) {
            throw ValidationException::withMessages([
                'serial_numbers' => 'Terdapat serial number duplikat pada daftar yang dikirim.',
            ]);
        }

        $existing = AssetSerialNumber::query()
            ->whereIn('serial_number', $serialNumbers)
            ->pluck('serial_number');

        if ($existing->isNotEmpty()) {
            throw ValidationException::withMessages([
                'serial_numbers' => 'Serial number berikut sudah terdaftar: '.$existing->take(5)->implode(', ').(count($existing) > 5 ? ', dan lainnya.' : '.'),
            ]);
        }
    }
}
