<?php

namespace App\Enums;

enum Role: string
{
    case Pimpinan = 'pimpinan';
    case Admin = 'admin';

    public function label(): string
    {
        return match ($this) {
            self::Pimpinan => 'Manajer',
            self::Admin => 'Admin',
        };
    }

    /**
     * Daftar izin mengikuti prinsip least privilege.
     * Backend tetap menjadi otoritas final pada setiap endpoint.
     *
     * @return list<string>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::Pimpinan => [
                'dashboard.view',
                'assets.view',
                'assets.manage',
                'categories.manage',
                'transactions.view',
                'transactions.create',
                'serial.view',
                'opname.view',
                'opname.manage',
                'opname.approve',
                'reports.view',
                'users.manage',
                'audit.view',
                'settings.manage',
            ],
            self::Admin => [
                'dashboard.view',
                'assets.view',
                'transactions.view',
                'transactions.create',
                'serial.view',
                'opname.view',
                'opname.manage',
                'reports.view',
            ],
        };
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $role): string => $role->value, self::cases());
    }
}
