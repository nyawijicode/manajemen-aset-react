<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $user = $request->authenticate();
        $user->forceFill(['last_login_at' => now()])->save();

        $this->auditLogger->log('auth.login', $user, [], $user);

        return response()->json([
            'message' => 'Berhasil masuk.',
            'data' => new UserResource($user->fresh()),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($request->user()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->auditLogger->log('auth.logout', $user, [], $user);

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Anda telah keluar dari aplikasi.',
        ]);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->password = Hash::make((string) $request->input('password'));
        $user->must_change_password = false;
        $user->save();

        $request->session()->regenerate();
        $this->auditLogger->log('auth.password_changed', $user, [], $user);

        return response()->json([
            'message' => 'Kata sandi berhasil diperbarui.',
            'data' => new UserResource($user->fresh()),
        ]);
    }
}
