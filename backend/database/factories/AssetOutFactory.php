<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\AssetOut;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<AssetOut>
 */
class AssetOutFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'reference' => 'OUT-'.now()->format('Ymd').'-'.Str::upper(Str::random(8)),
            'asset_id' => Asset::factory(),
            'transaction_date' => now()->toDateString(),
            'qty' => fake()->numberBetween(1, 5),
            'recipient' => fake()->name(),
            'notes' => fake()->optional()->sentence(),
            'created_by' => User::factory(),
            'idempotency_key' => null,
        ];
    }
}
