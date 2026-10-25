<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Rahasia#2026!';

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => self::PASSWORD,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => ' ADMIN@example.com ',
            'password' => self::PASSWORD,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.email', 'admin@example.com')
            ->assertJsonPath('data.role', 'admin');

        $this->assertAuthenticatedAs($user);
        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.login',
            'actor_user_id' => $user->id,
        ]);
    }

    public function test_login_rejects_invalid_credentials_with_generic_message(): void
    {
        $user = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => self::PASSWORD,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'salah-total',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('email')
            ->assertJsonPath('errors.email.0', 'Email atau kata sandi tidak sesuai.');

        $this->assertGuest();

        $log = AuditLog::query()->where('action', 'auth.login_failed')->firstOrFail();
        $this->assertSame('ad***@example.com', $log->metadata['email'] ?? null);
        $this->assertNull($log->actor_user_id);
    }

    public function test_inactive_account_cannot_login(): void
    {
        User::factory()->inactive()->create([
            'email' => 'nonaktif@example.com',
            'password' => self::PASSWORD,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'nonaktif@example.com',
            'password' => self::PASSWORD,
        ])->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Email atau kata sandi tidak sesuai.');

        $this->assertGuest();
    }

    public function test_repeated_failed_logins_are_throttled(): void
    {
        User::factory()->create([
            'email' => 'admin@example.com',
            'password' => self::PASSWORD,
        ]);

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'admin@example.com',
                'password' => 'salah-'.$attempt,
            ])->assertStatus(422);
        }

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.com',
            'password' => self::PASSWORD,
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Terlalu banyak', (string) $response->json('errors.email.0'));
        $this->assertGuest();
    }

    public function test_unauthenticated_requests_receive_json_401(): void
    {
        $this->getJson('/api/v1/auth/me')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'UNAUTHENTICATED');

        $this->getJson('/api/v1/assets')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_user_with_initial_password_must_change_it_before_using_the_api(): void
    {
        $user = User::factory()->admin()->create([
            'password' => self::PASSWORD,
            'must_change_password' => true,
        ]);

        $this->actingAs($user);

        $this->getJson('/api/v1/auth/me')->assertOk();
        $this->getJson('/api/v1/dashboard')
            ->assertStatus(409)
            ->assertJsonPath('code', 'PASSWORD_CHANGE_REQUIRED');

        $this->putJson('/api/v1/auth/password', [
            'current_password' => self::PASSWORD,
            'password' => 'Baru#Sekali2026!',
            'password_confirmation' => 'Baru#Sekali2026!',
        ])->assertOk();

        $this->assertFalse($user->fresh()->must_change_password);
        $this->getJson('/api/v1/dashboard')->assertOk();
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.password_changed',
            'actor_user_id' => $user->id,
        ]);
    }

    public function test_password_change_requires_current_password_and_strong_new_password(): void
    {
        $user = User::factory()->admin()->create([
            'password' => self::PASSWORD,
            'must_change_password' => true,
        ]);

        $this->actingAs($user);

        $this->putJson('/api/v1/auth/password', [
            'current_password' => 'bukan-sandi-saya',
            'password' => 'Baru#Sekali2026!',
            'password_confirmation' => 'Baru#Sekali2026!',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->putJson('/api/v1/auth/password', [
            'current_password' => self::PASSWORD,
            'password' => 'pendek',
            'password_confirmation' => 'pendek',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->assertTrue($user->fresh()->must_change_password);
    }

    public function test_logout_invalidates_the_session(): void
    {
        $user = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => self::PASSWORD,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => self::PASSWORD,
        ])->assertOk();

        $this->assertAuthenticatedAs($user);

        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->assertGuest('web');
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.logout',
            'actor_user_id' => $user->id,
        ]);
    }
}
