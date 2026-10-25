<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ];
    }

    public function prepareForValidation(): void
    {
        $this->merge([
            'email' => Str::lower(trim((string) $this->input('email'))),
        ]);
    }

    public function authenticate(): User
    {
        if (! $this->hasSession()) {
            throw ValidationException::withMessages([
                'email' => 'Permintaan masuk harus berasal dari antarmuka aplikasi.',
            ]);
        }

        $key = 'login:'.Str::lower($this->input('email')).'|'.$this->ip();

        if (RateLimiter::tooManyAttempts($key, 5)) {
            event(new Lockout($this));
            $seconds = RateLimiter::availableIn($key);

            throw ValidationException::withMessages([
                'email' => 'Terlalu banyak percobaan masuk. Coba lagi dalam '.$seconds.' detik.',
            ]);
        }

        $user = User::query()->where('email', $this->input('email'))->first();
        $valid = $user !== null
            && Hash::check((string) $this->input('password'), $user->password)
            && $user->is_active;

        if (! $valid) {
            RateLimiter::hit($key, 60);
            app(AuditLogger::class)->logFailedLogin((string) $this->input('email'));

            // Pesan generik: tidak membocorkan keberadaan akun atau statusnya.
            throw ValidationException::withMessages([
                'email' => 'Email atau kata sandi tidak sesuai.',
            ]);
        }

        RateLimiter::clear($key);
        Auth::guard('web')->login($user);
        $this->session()->regenerate();

        return $user;
    }
}
