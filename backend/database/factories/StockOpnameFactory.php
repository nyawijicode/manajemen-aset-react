<?php

namespace Database\Factories;

use App\Enums\OpnameStatus;
use App\Models\StockOpname;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<StockOpname>
 */
class StockOpnameFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'reference' => 'OPN-'.now()->format('Ymd').'-'.Str::upper(Str::random(8)),
            'opname_date' => now()->toDateString(),
            'description' => fake()->optional()->sentence(),
            'status' => OpnameStatus::Draft,
            'created_by' => User::factory(),
            'approved_by' => null,
            'approved_at' => null,
        ];
    }

    public function finalized(?User $approver = null): static
    {
        return $this->state(fn (): array => [
            'status' => OpnameStatus::Finalized,
            'approved_by' => $approver?->id ?? User::factory(),
            'approved_at' => now(),
        ]);
    }
}
