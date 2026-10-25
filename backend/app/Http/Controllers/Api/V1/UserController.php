<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ResetUserPasswordRequest;
use App\Http\Requests\SaveUserRequest;
use App\Http\Requests\UpdateUserStatusRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'role' => ['nullable', Rule::in(\App\Enums\Role::values())],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'all'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $users = User::query()
            ->when(! empty($validated['q']), function ($query) use ($validated): void {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($validated['q'])).'%';
                $query->where(function ($builder) use ($term): void {
                    $builder->where('name', 'like', $term)->orWhere('email', 'like', $term);
                });
            })
            ->when(! empty($validated['role']), fn ($query) => $query->where('role', $validated['role']))
            ->when(($validated['status'] ?? 'all') !== 'all', fn ($query) => $query->where('is_active', ($validated['status'] ?? 'all') === 'active'))
            ->orderBy('name')
            ->paginate($validated['per_page'] ?? 25)
            ->withQueryString();

        return UserResource::collection($users);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($user),
        ]);
    }

    public function store(SaveUserRequest $request): JsonResponse
    {
        $user = User::query()->create([
            ...$request->validated(),
            'is_active' => true,
            'must_change_password' => true,
            'created_by' => $request->user()?->id,
        ]);

        $this->auditLogger->log('user.created', $user, [
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
        ]);

        return response()->json([
            'message' => 'Pengguna berhasil ditambahkan. Kata sandi awal wajib diganti saat pertama masuk.',
            'data' => new UserResource($user),
        ], 201);
    }

    public function update(SaveUserRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();
        $actor = $request->user();

        if ($actor?->id === $user->id && $validated['role'] !== $user->role->value) {
            throw ValidationException::withMessages([
                'role' => 'Anda tidak dapat mengubah peran akun sendiri.',
            ]);
        }

        if ($user->role->value === 'pimpinan'
            && $validated['role'] !== 'pimpinan'
            && $this->activePimpinanCount() <= 1) {
            throw ValidationException::withMessages([
                'role' => 'Minimal harus ada satu akun Manajer yang aktif.',
            ]);
        }

        $before = $user->only(['name', 'email', 'role', 'is_active']);
        $passwordChanged = ! empty($validated['password']);

        if (! $passwordChanged) {
            unset($validated['password']);
        } else {
            $validated['must_change_password'] = true;
        }

        $user->update($validated);

        if ($passwordChanged) {
            $this->invalidateSessions($user);
        }

        $this->auditLogger->log('user.updated', $user, [
            'before' => $before,
            'after' => $user->only(['name', 'email', 'role', 'is_active']),
            'password_changed' => $passwordChanged,
        ]);

        return response()->json([
            'message' => 'Data pengguna berhasil diperbarui.',
            'data' => new UserResource($user->fresh()),
        ]);
    }

    public function updateStatus(UpdateUserStatusRequest $request, User $user): JsonResponse
    {
        $isActive = (bool) $request->validated('is_active');

        if (! $isActive && $request->user()?->id === $user->id) {
            throw ValidationException::withMessages([
                'is_active' => 'Anda tidak dapat menonaktifkan akun sendiri.',
            ]);
        }

        if (! $isActive && $user->role->value === 'pimpinan' && $this->activePimpinanCount() <= 1) {
            throw ValidationException::withMessages([
                'is_active' => 'Minimal harus ada satu akun Manajer yang aktif.',
            ]);
        }

        $user->is_active = $isActive;
        $user->deactivated_at = $isActive ? null : now();
        $user->save();

        if (! $isActive) {
            $this->invalidateSessions($user);
        }

        $this->auditLogger->log($isActive ? 'user.activated' : 'user.deactivated', $user, [
            'name' => $user->name,
            'email' => $user->email,
        ]);

        return response()->json([
            'message' => $isActive ? 'Akun berhasil diaktifkan.' : 'Akun berhasil dinonaktifkan.',
            'data' => new UserResource($user->fresh()),
        ]);
    }

    public function resetPassword(ResetUserPasswordRequest $request, User $user): JsonResponse
    {
        $user->password = Hash::make((string) $request->validated('password'));
        $user->must_change_password = true;
        $user->save();

        $this->invalidateSessions($user);
        $this->auditLogger->log('user.password_reset', $user, [
            'name' => $user->name,
            'email' => $user->email,
        ]);

        return response()->json([
            'message' => 'Kata sandi pengguna berhasil diatur ulang. Pengguna wajib menggantinya saat masuk.',
        ]);
    }

    private function activePimpinanCount(): int
    {
        return User::query()
            ->where('role', 'pimpinan')
            ->where('is_active', true)
            ->count();
    }

    private function invalidateSessions(User $user): void
    {
        if (config('session.driver') === 'database') {
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }
    }
}
