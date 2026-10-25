<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\StockOpname */
class StockOpnameResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'opname_date' => $this->opname_date?->format('Y-m-d'),
            'description' => $this->description,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'created_by' => $this->created_by,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'approved_by' => $this->approved_by,
            'approver' => new UserResource($this->whenLoaded('approver')),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'items_count' => $this->when(
                array_key_exists('items_count', $this->getAttributes()) || $this->relationLoaded('items'),
                fn (): int => (int) ($this->getAttribute('items_count') ?? $this->items->count())
            ),
            'items' => $this->whenLoaded('items', fn () => StockOpnameItemResource::collection($this->items)),
            'summary' => $this->when($this->relationLoaded('items'), function (): array {
                $items = $this->items;

                return [
                    'total' => $items->count(),
                    'filled' => $items->whereNotNull('physical_qty')->count(),
                    'match' => $items->where('difference', 0)->count(),
                    'more' => $items->filter(fn ($item): bool => $item->difference !== null && $item->difference > 0)->count(),
                    'less' => $items->filter(fn ($item): bool => $item->difference !== null && $item->difference < 0)->count(),
                ];
            }),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
