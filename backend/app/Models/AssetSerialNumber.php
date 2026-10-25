<?php

namespace App\Models;

use App\Enums\SerialStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetSerialNumber extends Model
{
    use HasFactory;

    protected $fillable = [
        'asset_id',
        'asset_in_id',
        'asset_out_id',
        'serial_number',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => SerialStatus::class,
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function assetIn(): BelongsTo
    {
        return $this->belongsTo(AssetIn::class);
    }

    public function assetOut(): BelongsTo
    {
        return $this->belongsTo(AssetOut::class);
    }

    public function isAvailable(): bool
    {
        return $this->status === SerialStatus::Available;
    }
}
