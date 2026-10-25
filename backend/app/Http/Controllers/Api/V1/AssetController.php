<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveAssetRequest;
use App\Http\Requests\UpdateAssetStatusRequest;
use App\Http\Resources\AssetResource;
use App\Http\Resources\SerialNumberResource;
use App\Models\Asset;
use App\Models\AssetIn;
use App\Models\AssetOut;
use App\Models\AssetSerialNumber;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AssetController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'category_id' => ['nullable', 'integer', 'exists:asset_categories,id'],
            'has_serial_number' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'stock_status' => ['nullable', Rule::in(['critical', 'empty', 'normal', 'all'])],
            'sort' => ['nullable', Rule::in(['code', 'name', 'stock', 'updated_at', 'created_at'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $assets = Asset::query()
            ->with('category')
            ->withCount(['serialNumbers', 'availableSerialNumbers'])
            ->search($validated['q'] ?? null)
            ->when(isset($validated['category_id']), fn ($query) => $query->where('category_id', $validated['category_id']))
            ->when(array_key_exists('has_serial_number', $validated), fn ($query) => $query->where('has_serial_number', (bool) $validated['has_serial_number']))
            ->when(array_key_exists('is_active', $validated), fn ($query) => $query->where('is_active', (bool) $validated['is_active']))
            ->when(($validated['stock_status'] ?? 'all') === 'critical', fn ($query) => $query->critical())
            ->when(($validated['stock_status'] ?? 'all') === 'empty', fn ($query) => $query->where('stock', 0))
            ->when(($validated['stock_status'] ?? 'all') === 'normal', fn ($query) => $query->normalStock())
            ->orderBy($validated['sort'] ?? 'code', $validated['direction'] ?? 'asc')
            ->paginate($validated['per_page'] ?? 15)
            ->withQueryString();

        return AssetResource::collection($assets);
    }

    public function show(Request $request, Asset $asset): JsonResponse
    {
        $asset->load('category')->loadCount(['serialNumbers', 'availableSerialNumbers']);

        $serialSummary = AssetSerialNumber::query()
            ->where('asset_id', $asset->id)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        $transactions = collect();

        AssetIn::query()
            ->with('creator')
            ->where('asset_id', $asset->id)
            ->latest('transaction_date')
            ->latest('id')
            ->limit(5)
            ->get()
            ->each(function (AssetIn $item) use ($transactions): void {
                $transactions->push([
                    'type' => 'in',
                    'id' => $item->id,
                    'reference' => $item->reference,
                    'date' => $item->transaction_date?->format('Y-m-d'),
                    'qty' => $item->qty,
                    'party' => $item->supplier_or_source,
                    'creator' => $item->creator?->name,
                ]);
            });

        AssetOut::query()
            ->with('creator')
            ->where('asset_id', $asset->id)
            ->latest('transaction_date')
            ->latest('id')
            ->limit(5)
            ->get()
            ->each(function (AssetOut $item) use ($transactions): void {
                $transactions->push([
                    'type' => 'out',
                    'id' => $item->id,
                    'reference' => $item->reference,
                    'date' => $item->transaction_date?->format('Y-m-d'),
                    'qty' => $item->qty,
                    'party' => $item->recipient,
                    'creator' => $item->creator?->name,
                ]);
            });

        return response()->json([
            'data' => array_merge(
                (new AssetResource($asset))->resolve($request),
                [
                    'serial_summary' => [
                        'available' => (int) ($serialSummary['available'] ?? 0),
                        'out' => (int) ($serialSummary['out'] ?? 0),
                    ],
                    'recent_transactions' => $transactions
                        ->sortByDesc(fn (array $row): string => $row['date'].'-'.$row['reference'])
                        ->take(8)
                        ->values()
                        ->all(),
                ]
            ),
        ]);
    }

    public function store(SaveAssetRequest $request): JsonResponse
    {
        $asset = Asset::query()->create($request->validated());

        $this->auditLogger->log('asset.created', $asset, [
            'code' => $asset->code,
            'name' => $asset->name,
        ]);

        return response()->json([
            'message' => 'Aset berhasil ditambahkan.',
            'data' => new AssetResource($asset->load('category')->loadCount(['serialNumbers', 'availableSerialNumbers'])),
        ], 201);
    }

    public function update(SaveAssetRequest $request, Asset $asset): JsonResponse
    {
        $validated = $request->validated();
        $newSerialFlag = (bool) $validated['has_serial_number'];

        if ($asset->has_serial_number !== $newSerialFlag && $asset->hasTransactionHistory()) {
            abort(409, 'Pengaturan serial number tidak dapat diubah karena aset sudah memiliki riwayat transaksi.');
        }

        $before = $asset->only(['code', 'name', 'category_id', 'unit', 'has_serial_number', 'description', 'minimum_stock', 'is_active']);
        $asset->update($validated);

        $this->auditLogger->log('asset.updated', $asset, [
            'code' => $asset->code,
            'before' => $before,
            'after' => $asset->only(['code', 'name', 'category_id', 'unit', 'has_serial_number', 'description', 'minimum_stock', 'is_active']),
        ]);

        return response()->json([
            'message' => 'Data aset berhasil diperbarui.',
            'data' => new AssetResource($asset->fresh()->load('category')->loadCount(['serialNumbers', 'availableSerialNumbers'])),
        ]);
    }

    public function updateStatus(UpdateAssetStatusRequest $request, Asset $asset): JsonResponse
    {
        $wasActive = $asset->is_active;
        $asset->update(['is_active' => (bool) $request->validated('is_active')]);

        $this->auditLogger->log($asset->is_active ? 'asset.activated' : 'asset.archived', $asset, [
            'code' => $asset->code,
            'was_active' => $wasActive,
        ]);

        return response()->json([
            'message' => $asset->is_active ? 'Aset berhasil diaktifkan kembali.' : 'Aset berhasil dinonaktifkan.',
            'data' => new AssetResource($asset->load('category')->loadCount(['serialNumbers', 'availableSerialNumbers'])),
        ]);
    }

    public function destroy(Asset $asset): JsonResponse
    {
        if ($asset->hasTransactionHistory()) {
            abort(409, 'Aset sudah memiliki riwayat transaksi atau serial number. Nonaktifkan aset agar riwayat tetap utuh.');
        }

        DB::transaction(function () use ($asset): void {
            $this->auditLogger->log('asset.deleted', $asset, [
                'code' => $asset->code,
                'name' => $asset->name,
            ]);

            $asset->delete();
        });

        return response()->json([
            'message' => 'Aset berhasil dihapus.',
        ]);
    }

    public function serialNumbers(Request $request, Asset $asset): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['available', 'out', 'all'])],
            'q' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $serials = $asset->serialNumbers()
            ->with('asset:id,code,name,unit')
            ->when(($validated['status'] ?? 'all') !== 'all', fn ($query) => $query->where('status', $validated['status']))
            ->when(! empty($validated['q']), function ($query) use ($validated): void {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($validated['q'])).'%';
                $query->where('serial_number', 'like', $term);
            })
            ->orderBy('serial_number')
            ->paginate($validated['per_page'] ?? 50)
            ->withQueryString();

        return SerialNumberResource::collection($serials);
    }
}
