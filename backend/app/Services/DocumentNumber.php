<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DocumentNumber
{
    /**
     * Nomor referensi manusiawi dan unik. Constraint unique di database
     * tetap menjadi penjaga terakhir bila terjadi tabrakan.
     */
    public function make(string $prefix, string $modelClass): string
    {
        /** @var class-string<Model> $modelClass */
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $reference = $prefix.'-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));

            if (! $modelClass::query()->where('reference', $reference)->exists()) {
                return $reference;
            }
        }

        return $prefix.'-'.now()->format('YmdHis').'-'.Str::upper(Str::random(8));
    }
}
