<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\StockOpnameItem */
class StockOpnameItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_id' => $this->asset_id,
            'asset' => new AssetResource($this->whenLoaded('asset')),
            'system_qty_snapshot' => $this->system_qty_snapshot,
            'physical_qty' => $this->physical_qty,
            'difference' => $this->difference,
            'notes' => $this->notes,
        ];
    }
}
