<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Asset extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'category_id',
        'unit',
        'has_serial_number',
        'description',
        'minimum_stock',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'has_serial_number' => 'boolean',
            'minimum_stock' => 'integer',
            'stock' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'category_id');
    }

    public function serialNumbers(): HasMany
    {
        return $this->hasMany(AssetSerialNumber::class);
    }

    public function availableSerialNumbers(): HasMany
    {
        return $this->hasMany(AssetSerialNumber::class)->where('status', 'available');
    }

    public function ins(): HasMany
    {
        return $this->hasMany(AssetIn::class);
    }

    public function outs(): HasMany
    {
        return $this->hasMany(AssetOut::class);
    }

    public function opnameItems(): HasMany
    {
        return $this->hasMany(StockOpnameItem::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeCritical(Builder $query): Builder
    {
        return $query->whereColumn('stock', '<=', 'minimum_stock')->where('minimum_stock', '>', 0);
    }

    public function scopeNormalStock(Builder $query): Builder
    {
        return $query->where('stock', '>', 0)
            ->where(function (Builder $builder): void {
                $builder->where('minimum_stock', 0)
                    ->orWhereColumn('stock', '>', 'minimum_stock');
            });
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if ($term === null || trim($term) === '') {
            return $query;
        }

        $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($term)).'%';

        return $query->where(function (Builder $builder) use ($term): void {
            $builder->where('code', 'like', $term)->orWhere('name', 'like', $term);
        });
    }

    public function isCritical(): bool
    {
        return $this->minimum_stock > 0 && $this->stock <= $this->minimum_stock;
    }

    public function hasTransactionHistory(): bool
    {
        return $this->ins()->exists() || $this->outs()->exists() || $this->serialNumbers()->exists();
    }
}
