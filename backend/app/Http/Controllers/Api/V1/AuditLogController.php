<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AuditLogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'action' => ['nullable', 'string', 'max:80'],
            'actor_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $logs = AuditLog::query()
            ->with('actor')
            ->when(! empty($validated['action']), fn ($query) => $query->where('action', $validated['action']))
            ->when(! empty($validated['actor_user_id']), fn ($query) => $query->where('actor_user_id', $validated['actor_user_id']))
            ->when(! empty($validated['date_from']), fn ($query) => $query->where('created_at', '>=', $validated['date_from'].' 00:00:00'))
            ->when(! empty($validated['date_to']), fn ($query) => $query->where('created_at', '<=', $validated['date_to'].' 23:59:59'))
            ->when(! empty($validated['q']), function ($query) use ($validated): void {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($validated['q'])).'%';
                $query->where(function ($builder) use ($term): void {
                    $builder->where('action', 'like', $term)
                        ->orWhere('entity_type', 'like', $term)
                        ->orWhere('correlation_id', 'like', $term);
                });
            })
            ->latest('id')
            ->paginate($validated['per_page'] ?? 25)
            ->withQueryString();

        return AuditLogResource::collection($logs);
    }
}
