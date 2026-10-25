<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\AssetCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Asset>
 */
class AssetFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => 'AST-'.strtoupper(Str::random(8)),
            'name' => Str::title(fake()->words(3, true)),
            'category_id' => AssetCategory::factory(),
            'unit' => fake()->randomElement(['unit', 'buah', 'set', 'rim', 'kotak']),
            'has_serial_number' => false,
            'description' => fake()->optional()->sentence(),
            'minimum_stock' => fake()->numberBetween(0, 5),
            'stock' => 0,
            'is_active' => true,
        ];
    }

    public function withSerialNumber(): static
    {
        return $this->state(fn (): array => ['has_serial_number' => true]);
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['is_active' => false]);
    }
}
