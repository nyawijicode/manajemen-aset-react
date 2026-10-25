<?php

use App\Http\Middleware\CorrelationId;
use App\Http\Middleware\EnsurePasswordIsChanged;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\RequireHttps;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->throttleApi();

        $middleware->append(CorrelationId::class);
        $middleware->append(SecurityHeaders::class);
        $middleware->append(RequireHttps::class);

        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'password.changed' => EnsurePasswordIsChanged::class,
        ]);

        if (is_string($proxies = env('TRUSTED_PROXIES')) && $proxies !== '') {
            $middleware->trustProxies(at: $proxies);
        }
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, Throwable $e): bool => $request->is('api/*') || $request->expectsJson()
        );

        $exceptions->render(function (ValidationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
                'code' => 'VALIDATION_ERROR',
                'request_id' => $request->attributes->get('correlation_id'),
            ], 422);
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'Sesi Anda telah berakhir. Silakan masuk kembali.',
                'code' => 'UNAUTHENTICATED',
                'request_id' => $request->attributes->get('correlation_id'),
            ], 401);
        });

        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'Anda tidak memiliki akses untuk melakukan tindakan ini.',
                'code' => 'FORBIDDEN',
                'request_id' => $request->attributes->get('correlation_id'),
            ], 403);
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'Permintaan terlalu sering. Tunggu sebentar lalu coba lagi.',
                'code' => 'TOO_MANY_REQUESTS',
                'request_id' => $request->attributes->get('correlation_id'),
            ], 429, $e->getHeaders());
        });

        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'Data yang diminta tidak ditemukan.',
                'code' => 'NOT_FOUND',
                'request_id' => $request->attributes->get('correlation_id'),
            ], 404);
        });

        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = $e->getStatusCode();

            if ($status === 403) {
                return response()->json([
                    'message' => 'Anda tidak memiliki akses untuk melakukan tindakan ini.',
                    'code' => 'FORBIDDEN',
                    'request_id' => $request->attributes->get('correlation_id'),
                ], 403);
            }

            if ($status >= 500) {
                report($e);

                return response()->json([
                    'message' => 'Terjadi kendala pada server. Silakan coba lagi atau hubungi administrator.',
                    'code' => 'SERVER_ERROR',
                    'request_id' => $request->attributes->get('correlation_id'),
                ], 500);
            }

            return response()->json([
                'message' => $e->getMessage() !== '' ? $e->getMessage() : 'Permintaan tidak dapat diproses.',
                'code' => 'REQUEST_REJECTED',
                'request_id' => $request->attributes->get('correlation_id'),
            ], $status, $e->getHeaders());
        });

        $exceptions->render(function (QueryException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            report($e);

            return response()->json([
                'message' => 'Terjadi kendala saat memproses data. Silakan coba lagi.',
                'code' => 'SERVER_ERROR',
                'request_id' => $request->attributes->get('correlation_id'),
            ], 500);
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            report($e);

            return response()->json([
                'message' => 'Terjadi kendala pada server. Silakan coba lagi atau hubungi administrator.',
                'code' => 'SERVER_ERROR',
                'request_id' => $request->attributes->get('correlation_id'),
            ], 500);
        });
    })->create();
