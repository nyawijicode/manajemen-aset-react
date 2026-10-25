<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAssetOutRequest;
use App\Http\Resources\AssetOutResource;
use App\Models\AssetOut;
use App\Models\User;
use App\Services\StockService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class AssetOutController extends Controller
{
    public function __construct(private readonly StockService $stockService) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $items = AssetOut::query()
            ->with(['asset.category', 'creator'])
            ->withCount('serialNumbers')
            ->when(! empty($validated['asset_id']), fn ($query) => $query->where('asset_id', $validated['asset_id']))
            ->when(! empty($validated['date_from']), fn ($query) => $query->where('transaction_date', '>=', $validated['date_from']))
            ->when(! empty($validated['date_to']), fn ($query) => $query->where('transaction_date', '<=', $validated['date_to']))
            ->when(! empty($validated['q']), function ($query) use ($validated): void {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($validated['q'])).'%';
                $query->where(function ($builder) use ($term): void {
                    $builder->where('reference', 'like', $term)
                        ->orWhere('recipient', 'like', $term);
                });
            })
            ->latest('transaction_date')
            ->latest('id')
            ->paginate($validated['per_page'] ?? 15)
            ->withQueryString();

        return AssetOutResource::collection($items);
    }

    public function show(AssetOut $assetOut): JsonResponse
    {
        $assetOut->load(['asset.category', 'creator', 'serialNumbers']);

        return response()->json([
            'data' => new AssetOutResource($assetOut),
        ]);
    }

    public function store(StoreAssetOutRequest $request): JsonResponse
    {
        $key = $this->idempotencyKey($request);

        if ($key !== null) {
            $existing = AssetOut::query()->where('idempotency_key', $key)->first();

            if ($existing !== null) {
                $existing->load(['asset.category', 'creator', 'serialNumbers']);

                return response()->json([
                    'message' => 'Transaksi keluar ini sudah tersimpan sebelumnya.',
                    'data' => new AssetOutResource($existing),
                ]);
            }
        }

        /** @var User $user */
        $user = $request->user();

        try {
            $assetOut = $this->stockService->recordOut($user, [
                ...$request->validated(),
                'idempotency_key' => $key,
            ]);
        } catch (UniqueConstraintViolationException $exception) {
            if ($key === null) {
                throw $exception;
            }

            $existing = AssetOut::query()->where('idempotency_key', $key)->firstOrFail();
            $existing->load(['asset.category', 'creator', 'serialNumbers']);

            return response()->json([
                'message' => 'Transaksi keluar ini sudah tersimpan sebelumnya.',
                'data' => new AssetOutResource($existing),
            ]);
        }

        return response()->json([
            'message' => 'Aset keluar berhasil dicatat dengan nomor '.$assetOut->reference.'.',
            'data' => new AssetOutResource($assetOut),
        ], 201);
    }

    private function idempotencyKey(Request $request): ?string
    {
        $key = $request->header('Idempotency-Key');

        if (! is_string($key) || trim($key) === '') {
            return null;
        }

        $key = trim($key);

        if (preg_match('/^[A-Za-z0-9._-]{8,80}$/', $key) !== 1) {
            throw ValidationException::withMessages([
                'idempotency_key' => 'Idempotency-Key tidak valid. Gunakan 8–80 karakter huruf, angka, titik, garis bawah, atau strip.',
            ]);
        }

        return $key;
    }
}
