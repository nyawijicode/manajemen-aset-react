<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AssetIn */
class AssetInResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'asset_id' => $this->asset_id,
            'asset' => new AssetResource($this->whenLoaded('asset')),
            'transaction_date' => $this->transaction_date?->format('Y-m-d'),
            'qty' => $this->qty,
            'supplier_or_source' => $this->supplier_or_source,
            'notes' => $this->notes,
            'created_by' => $this->created_by,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'serial_numbers' => SerialNumberResource::collection($this->whenLoaded('serialNumbers')),
            'serial_numbers_count' => $this->whenCounted('serialNumbers'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
