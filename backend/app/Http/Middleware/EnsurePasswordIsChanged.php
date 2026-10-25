<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordIsChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && $user->must_change_password) {
            return response()->json([
                'message' => 'Untuk keamanan akun, ganti kata sandi awal sebelum melanjutkan.',
                'code' => 'PASSWORD_CHANGE_REQUIRED',
                'request_id' => $request->attributes->get('correlation_id'),
            ], 409);
        }

        return $next($request);
    }
}
