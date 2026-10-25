<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreStockOpnameRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('opname.manage') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'opname_date' => ['required', 'date', 'before_or_equal:today'],
            'description' => ['nullable', 'string', 'max:255'],
            'asset_ids' => ['nullable', 'array', 'max:5000'],
            'asset_ids.*' => ['integer', 'distinct', 'exists:assets,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'opname_date' => 'tanggal opname',
            'description' => 'keterangan',
            'asset_ids' => 'daftar aset',
        ];
    }
}
