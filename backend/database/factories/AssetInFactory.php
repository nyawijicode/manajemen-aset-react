<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\AssetIn;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<AssetIn>
 */
class AssetInFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'reference' => 'IN-'.now()->format('Ymd').'-'.Str::upper(Str::random(8)),
            'asset_id' => Asset::factory(),
            'transaction_date' => now()->toDateString(),
            'qty' => fake()->numberBetween(1, 20),
            'supplier_or_source' => fake()->company(),
            'notes' => fake()->optional()->sentence(),
            'created_by' => User::factory(),
            'idempotency_key' => null,
        ];
    }
}
