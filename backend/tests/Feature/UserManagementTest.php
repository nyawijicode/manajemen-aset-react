<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Rahasia#2026!';

    public function test_pimpinan_can_create_user_who_must_change_initial_password(): void
    {
        $pimpinan = User::factory()->pimpinan()->create();

        $response = $this->actingAs($pimpinan)->postJson('/api/v1/users', [
            'name' => 'Operator Aset',
            'email' => 'operator@example.com',
            'role' => 'admin',
            'password' => self::PASSWORD,
            'password_confirmation' => self::PASSWORD,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'operator@example.com')
            ->assertJsonPath('data.must_change_password', true)
            ->assertJsonPath('data.is_active', true);

        $created = User::query()->where('email', 'operator@example.com')->firstOrFail();
        $this->assertTrue(Hash::check(self::PASSWORD, $created->password));
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.created',
            'entity_id' => $created->id,
            'actor_user_id' => $pimpinan->id,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'operator@example.com',
            'password' => self::PASSWORD,
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/dashboard')
            ->assertStatus(409)
            ->assertJsonPath('code', 'PASSWORD_CHANGE_REQUIRED');
    }

    public function test_pimpinan_cannot_change_own_role_or_deactivate_self(): void
    {
        $pimpinan = User::factory()->pimpinan()->create();

        $this->actingAs($pimpinan)->putJson('/api/v1/users/'.$pimpinan->id, [
            'name' => $pimpinan->name,
            'email' => $pimpinan->email,
            'role' => 'admin',
        ])->assertStatus(422)->assertJsonValidationErrors('role');

        $this->actingAs($pimpinan)->patchJson('/api/v1/users/'.$pimpinan->id.'/status', [
            'is_active' => false,
        ])->assertStatus(422)->assertJsonValidationErrors('is_active');

        $pimpinan->refresh();
        $this->assertSame('pimpinan', $pimpinan->role->value);
        $this->assertTrue($pimpinan->is_active);
    }

    public function test_password_reset_flags_the_account_and_invalidates_old_password(): void
    {
        $pimpinan = User::factory()->pimpinan()->create();
        $target = User::factory()->admin()->create(['password' => self::PASSWORD]);

        $this->actingAs($pimpinan)->postJson('/api/v1/users/'.$target->id.'/reset-password', [
            'password' => 'Reset#Sekali2026!',
            'password_confirmation' => 'Reset#Sekali2026!',
        ])->assertOk();

        $target->refresh();
        $this->assertTrue($target->must_change_password);
        $this->assertTrue(Hash::check('Reset#Sekali2026!', $target->password));
        $this->assertFalse(Hash::check(self::PASSWORD, $target->password));

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.password_reset',
            'entity_id' => $target->id,
        ]);
    }

    public function test_user_update_without_password_keeps_existing_password(): void
    {
        $pimpinan = User::factory()->pimpinan()->create();
        $target = User::factory()->admin()->create(['password' => self::PASSWORD]);

        $this->actingAs($pimpinan)->putJson('/api/v1/users/'.$target->id, [
            'name' => 'Nama Diperbarui',
            'email' => $target->email,
            'role' => 'admin',
        ])->assertOk()->assertJsonPath('data.name', 'Nama Diperbarui');

        $target->refresh();
        $this->assertTrue(Hash::check(self::PASSWORD, $target->password));
        $this->assertFalse($target->must_change_password);
    }
}
