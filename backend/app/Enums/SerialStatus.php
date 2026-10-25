<?php

namespace App\Enums;

enum SerialStatus: string
{
    case Available = 'available';
    case Out = 'out';

    public function label(): string
    {
        return match ($this) {
            self::Available => 'Tersedia',
            self::Out => 'Keluar',
        };
    }
}
