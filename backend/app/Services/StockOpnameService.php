<?php

namespace App\Services;

use App\Enums\OpnameStatus;
use App\Models\Asset;
use App\Models\StockOpname;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockOpnameService
{
    public function __construct(
        private readonly DocumentNumber $documentNumber,
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array{opname_date:string, description?:string|null, asset_ids?:array<int, int>|null}  $data
     */
    public function create(User $actor, array $data): StockOpname
    {
        return DB::transaction(function () use ($actor, $data): StockOpname {
            $assetsQuery = Asset::query()->active()->orderBy('code');

            if (! empty($data['asset_ids'])) {
                $assetsQuery->whereIn('id', $data['asset_ids']);
            }

            $assets = $assetsQuery->lockForUpdate()->get();

            if ($assets->isEmpty()) {
                throw ValidationException::withMessages([
                    'asset_ids' => 'Tidak ada aset aktif yang dapat dimasukkan ke sesi opname.',
                ]);
            }

            $opname = StockOpname::query()->create([
                'reference' => $this->documentNumber->make('OPN', StockOpname::class),
                'opname_date' => $data['opname_date'],
                'description' => $data['description'] ?? null,
                'status' => OpnameStatus::Draft,
                'created_by' => $actor->id,
            ]);

            foreach ($assets as $asset) {
                $opname->items()->create([
                    'asset_id' => $asset->id,
                    'system_qty_snapshot' => $asset->stock,
                ]);
            }

            $this->auditLogger->log('stock_opname.created', $opname, [
                'reference' => $opname->reference,
                'item_count' => $assets->count(),
            ], $actor);

            return $opname->load(['creator', 'items.asset.category']);
        }, 3);
    }

    /**
     * @param  array{opname_date?:string, description?:string|null, items?:array<int, array{id:int, physical_qty?:int|null, notes?:string|null}>}  $data
     */
    public function update(User $actor, StockOpname $opname, array $data): StockOpname
    {
        return DB::transaction(function () use ($actor, $opname, $data): StockOpname {
            $locked = StockOpname::query()->whereKey($opname->id)->lockForUpdate()->firstOrFail();

            if (! $locked->isDraft()) {
                abort(409, 'Sesi opname yang sudah disahkan tidak dapat diubah.');
            }

            if (isset($data['opname_date'])) {
                $locked->opname_date = $data['opname_date'];
            }

            if (array_key_exists('description', $data)) {
                $locked->description = $data['description'];
            }

            $locked->save();

            foreach ($data['items'] ?? [] as $itemData) {
                $item = $locked->items()->whereKey($itemData['id'])->first();

                if (! $item) {
                    throw ValidationException::withMessages([
                        'items' => 'Terdapat baris opname yang tidak valid.',
                    ]);
                }

                $physicalQty = $itemData['physical_qty'] ?? null;
                $item->physical_qty = $physicalQty;
                $item->difference = $physicalQty === null
                    ? null
                    : (int) $physicalQty - (int) $item->system_qty_snapshot;

                if (array_key_exists('notes', $itemData)) {
                    $item->notes = $itemData['notes'];
                }

                $item->save();
            }

            $this->auditLogger->log('stock_opname.updated', $locked, [
                'reference' => $locked->reference,
            ], $actor);

            return $locked->load(['creator', 'approver', 'items.asset.category']);
        }, 3);
    }

    public function finalize(User $actor, StockOpname $opname): StockOpname
    {
        return DB::transaction(function () use ($actor, $opname): StockOpname {
            $locked = StockOpname::query()->whereKey($opname->id)->lockForUpdate()->firstOrFail();

            if (! $locked->isDraft()) {
                abort(409, 'Sesi opname ini sudah disahkan.');
            }

            $incomplete = $locked->items()->whereNull('physical_qty')->exists();

            if ($incomplete) {
                throw ValidationException::withMessages([
                    'items' => 'Seluruh baris harus memiliki jumlah fisik sebelum sesi disahkan.',
                ]);
            }

            $locked->status = OpnameStatus::Finalized;
            $locked->approved_by = $actor->id;
            $locked->approved_at = Carbon::now();
            $locked->save();

            $this->auditLogger->log('stock_opname.finalized', $locked, [
                'reference' => $locked->reference,
                'item_count' => $locked->items()->count(),
            ], $actor);

            return $locked->load(['creator', 'approver', 'items.asset.category']);
        }, 3);
    }
}
