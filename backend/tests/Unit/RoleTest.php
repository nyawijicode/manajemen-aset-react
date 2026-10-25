<?php

namespace Tests\Unit;

use App\Enums\Role;
use PHPUnit\Framework\TestCase;

class RoleTest extends TestCase
{
    public function test_pimpinan_has_every_defined_permission(): void
    {
        $pimpinan = Role::Pimpinan->permissions();
        $admin = Role::Admin->permissions();

        $this->assertCount(14, $pimpinan);
        $this->assertCount(8, $admin);
        $this->assertSame([], array_values(array_diff($admin, $pimpinan)));
    }

    public function test_admin_lacks_privileged_permissions(): void
    {
        foreach ([
            'assets.manage',
            'categories.manage',
            'opname.approve',
            'users.manage',
            'audit.view',
            'settings.manage',
        ] as $permission) {
            $this->assertFalse(Role::Admin->hasPermission($permission), $permission);
            $this->assertTrue(Role::Pimpinan->hasPermission($permission), $permission);
        }
    }

    public function test_role_labels_and_values_are_stable(): void
    {
        $this->assertSame(['pimpinan', 'admin'], Role::values());
        $this->assertSame('Manajer', Role::Pimpinan->label());
        $this->assertSame('Admin', Role::Admin->label());
    }
}
