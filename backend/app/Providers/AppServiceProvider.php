<?php

namespace App\Providers;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->configureSecurity();
        $this->configureAuthorization();
        $this->configureRateLimiting();
    }

    private function configureSecurity(): void
    {
        Password::defaults(fn () => Password::min(12)
            ->letters()
            ->mixedCase()
            ->numbers()
            ->symbols());

        if (config('app.force_https')) {
            URL::forceScheme('https');
        }
    }

    private function configureAuthorization(): void
    {
        $permissions = collect(Role::cases())
            ->flatMap(fn (Role $role): array => $role->permissions())
            ->unique();

        foreach ($permissions as $permission) {
            Gate::define(
                $permission,
                fn (User $user): bool => $user->hasPermission($permission)
            );
        }
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(10)
                ->by(strtolower((string) $request->input('email')).'|'.$request->ip())
                ->response(fn (Request $request, array $headers) => response()->json([
                    'message' => 'Terlalu banyak percobaan masuk. Coba lagi beberapa saat lagi.',
                    'code' => 'TOO_MANY_REQUESTS',
                    'request_id' => $request->attributes->get('correlation_id'),
                ], 429, $headers));
        });

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(180)
                ->by($request->user()?->getAuthIdentifier() !== null
                    ? 'user:'.$request->user()->getAuthIdentifier()
                    : 'ip:'.$request->ip())
                ->response(fn (Request $request, array $headers) => response()->json([
                    'message' => 'Permintaan terlalu sering. Tunggu sebentar lalu coba lagi.',
                    'code' => 'TOO_MANY_REQUESTS',
                    'request_id' => $request->attributes->get('correlation_id'),
                ], 429, $headers));
        });

        RateLimiter::for('sensitive', function (Request $request) {
            return Limit::perMinute(20)
                ->by(($request->user()?->getAuthIdentifier() ?? 'guest').'|'.$request->ip())
                ->response(fn (Request $request, array $headers) => response()->json([
                    'message' => 'Terlalu banyak permintaan untuk tindakan ini. Coba lagi nanti.',
                    'code' => 'TOO_MANY_REQUESTS',
                    'request_id' => $request->attributes->get('correlation_id'),
                ], 429, $headers));
        });
    }
}
