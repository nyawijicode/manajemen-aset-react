<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\AssetCategory;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

class AssetCategoryController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $categories = AssetCategory::query()
            ->withCount('assets')
            ->when(! empty($validated['q']), function ($query) use ($validated): void {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($validated['q'])).'%';
                $query->where(function ($builder) use ($term): void {
                    $builder->where('name', 'like', $term)->orWhere('description', 'like', $term);
                });
            })
            ->orderBy('name')
            ->paginate($validated['per_page'] ?? 50)
            ->withQueryString();

        return CategoryResource::collection($categories);
    }

    public function store(SaveCategoryRequest $request): JsonResponse
    {
        $category = AssetCategory::query()->create($request->validated());
        $this->auditLogger->log('category.created', $category, ['name' => $category->name]);

        return response()->json([
            'message' => 'Kategori berhasil ditambahkan.',
            'data' => new CategoryResource($category->loadCount('assets')),
        ], 201);
    }

    public function update(SaveCategoryRequest $request, AssetCategory $category): JsonResponse
    {
        $before = $category->only(['name', 'description']);
        $category->update($request->validated());

        $this->auditLogger->log('category.updated', $category, [
            'before' => $before,
            'after' => $category->only(['name', 'description']),
        ]);

        return response()->json([
            'message' => 'Kategori berhasil diperbarui.',
            'data' => new CategoryResource($category->loadCount('assets')),
        ]);
    }

    public function destroy(AssetCategory $category): JsonResponse
    {
        if ($category->assets()->exists()) {
            abort(409, 'Kategori masih digunakan oleh aset. Pindahkan aset ke kategori lain terlebih dahulu.');
        }

        $this->auditLogger->log('category.deleted', $category, ['name' => $category->name]);
        $category->delete();

        return response()->json([
            'message' => 'Kategori berhasil dihapus.',
        ]);
    }
}
