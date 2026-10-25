<?php

namespace App\Enums;

enum OpnameStatus: string
{
    case Draft = 'draft';
    case Finalized = 'finalized';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draf',
            self::Finalized => 'Disahkan',
        };
    }
}
