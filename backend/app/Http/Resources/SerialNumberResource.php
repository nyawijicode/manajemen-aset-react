<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AssetSerialNumber */
class SerialNumberResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'serial_number' => $this->serial_number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'asset_id' => $this->asset_id,
            'asset' => new AssetResource($this->whenLoaded('asset')),
            'asset_in_id' => $this->asset_in_id,
            'asset_out_id' => $this->asset_out_id,
            'asset_in' => new AssetInResource($this->whenLoaded('assetIn')),
            'asset_out' => new AssetOutResource($this->whenLoaded('assetOut')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
