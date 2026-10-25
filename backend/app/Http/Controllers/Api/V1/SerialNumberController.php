<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\SerialNumberResource;
use App\Models\AssetSerialNumber;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class SerialNumberController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],
            'status' => ['nullable', Rule::in(['available', 'out', 'all'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $serials = AssetSerialNumber::query()
            ->with(['asset.category'])
            ->when(! empty($validated['asset_id']), fn ($query) => $query->where('asset_id', $validated['asset_id']))
            ->when(($validated['status'] ?? 'all') !== 'all', fn ($query) => $query->where('status', $validated['status']))
            ->when(! empty($validated['q']), function ($query) use ($validated): void {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($validated['q'])).'%';
                $query->where('serial_number', 'like', $term);
            })
            ->orderBy('serial_number')
            ->paginate($validated['per_page'] ?? 25)
            ->withQueryString();

        return SerialNumberResource::collection($serials);
    }
}
