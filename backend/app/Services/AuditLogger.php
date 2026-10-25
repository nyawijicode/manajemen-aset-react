<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class AuditLogger
{
    private const SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'current_password',
        'token',
        'access_token',
        'refresh_token',
        'secret',
        'authorization',
        'cookie',
        'session',
        'remember_token',
    ];

    /**
     * Catat tindakan penting. Metadata wajib bersih dari rahasia.
     *
     * @param  array<string, mixed>  $metadata
     */
    public function log(string $action, ?Model $entity = null, array $metadata = [], ?User $actor = null): void
    {
        $request = app()->bound('request') ? request() : null;

        AuditLog::query()->create([
            'actor_user_id' => ($actor ?? Auth::user())?->getKey(),
            'action' => $action,
            'entity_type' => $entity?->getMorphClass(),
            'entity_id' => $entity?->getKey(),
            'correlation_id' => $request?->attributes->get('correlation_id'),
            'ip_address' => $request?->ip(),
            'user_agent' => $request ? Str::limit((string) $request->userAgent(), 250, '') : null,
            'metadata' => $this->sanitize($metadata),
            'created_at' => now(),
        ]);
    }

    public function logFailedLogin(string $email): void
    {
        $this->log('auth.login_failed', null, [
            'email' => $this->maskEmail($email),
        ]);
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function sanitize(array $metadata): array
    {
        $clean = Arr::except($metadata, self::SENSITIVE_KEYS);

        foreach ($clean as $key => $value) {
            if (is_array($value)) {
                $clean[$key] = $this->sanitize($value);
            } elseif (is_string($value)) {
                $clean[$key] = Str::limit($value, 500, '…');
            }
        }

        return $clean;
    }

    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $visible = Str::substr($local, 0, 2);

        return $visible.str_repeat('*', max(2, Str::length($local) - 2)).($domain !== '' ? '@'.$domain : '');
    }
}
