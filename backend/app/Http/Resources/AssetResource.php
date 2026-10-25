<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Asset */
class AssetResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'category_id' => $this->category_id,
            'category' => new CategoryResource($this->whenLoaded('category')),
            'unit' => $this->unit,
            'has_serial_number' => $this->has_serial_number,
            'description' => $this->description,
            'minimum_stock' => $this->minimum_stock,
            'stock' => $this->stock,
            'is_active' => $this->is_active,
            'is_critical' => $this->isCritical(),
            'serial_numbers_count' => $this->whenCounted('serialNumbers'),
            'available_serial_numbers_count' => $this->whenCounted('availableSerialNumbers'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
