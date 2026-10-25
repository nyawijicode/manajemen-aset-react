<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStockOpnameRequest;
use App\Http\Requests\UpdateStockOpnameRequest;
use App\Http\Resources\StockOpnameResource;
use App\Models\StockOpname;
use App\Models\User;
use App\Services\StockOpnameService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class StockOpnameController extends Controller
{
    public function __construct(private readonly StockOpnameService $stockOpnameService) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['draft', 'finalized', 'all'])],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $opnames = StockOpname::query()
            ->with(['creator', 'approver'])
            ->withCount('items')
            ->when(($validated['status'] ?? 'all') !== 'all', fn ($query) => $query->where('status', $validated['status']))
            ->when(! empty($validated['date_from']), fn ($query) => $query->where('opname_date', '>=', $validated['date_from']))
            ->when(! empty($validated['date_to']), fn ($query) => $query->where('opname_date', '<=', $validated['date_to']))
            ->when(! empty($validated['q']), function ($query) use ($validated): void {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($validated['q'])).'%';
                $query->where(function ($builder) use ($term): void {
                    $builder->where('reference', 'like', $term)->orWhere('description', 'like', $term);
                });
            })
            ->latest('opname_date')
            ->latest('id')
            ->paginate($validated['per_page'] ?? 15)
            ->withQueryString();

        return StockOpnameResource::collection($opnames);
    }

    public function show(StockOpname $stockOpname): JsonResponse
    {
        $stockOpname->load(['creator', 'approver', 'items.asset.category']);

        return response()->json([
            'data' => new StockOpnameResource($stockOpname),
        ]);
    }

    public function store(StoreStockOpnameRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $opname = $this->stockOpnameService->create($user, $request->validated());

        return response()->json([
            'message' => 'Sesi stock opname berhasil dibuat dengan nomor '.$opname->reference.'.',
            'data' => new StockOpnameResource($opname),
        ], 201);
    }

    public function update(UpdateStockOpnameRequest $request, StockOpname $stockOpname): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $opname = $this->stockOpnameService->update($user, $stockOpname, $request->validated());

        return response()->json([
            'message' => 'Hasil stock opname berhasil disimpan.',
            'data' => new StockOpnameResource($opname),
        ]);
    }

    public function finalize(StockOpname $stockOpname): JsonResponse
    {
        /** @var User $user */
        $user = request()->user();
        $opname = $this->stockOpnameService->finalize($user, $stockOpname);

        return response()->json([
            'message' => 'Sesi stock opname berhasil disahkan. Stok sistem tidak diubah otomatis.',
            'data' => new StockOpnameResource($opname),
        ]);
    }
}
