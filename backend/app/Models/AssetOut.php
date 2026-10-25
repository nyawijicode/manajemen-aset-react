<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetOut extends Model
{
    use HasFactory;

    protected $table = 'asset_outs';

    protected $fillable = [
        'reference',
        'asset_id',
        'transaction_date',
        'qty',
        'recipient',
        'notes',
        'created_by',
        'idempotency_key',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date:Y-m-d',
            'qty' => 'integer',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function serialNumbers(): HasMany
    {
        return $this->hasMany(AssetSerialNumber::class);
    }
}
