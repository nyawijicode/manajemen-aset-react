<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateStockOpnameRequest extends FormRequest
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
            'opname_date' => ['sometimes', 'date', 'before_or_equal:today'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'items' => ['sometimes', 'array', 'max:5000'],
            'items.*.id' => ['required', 'integer', 'distinct'],
            'items.*.physical_qty' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'opname_date' => 'tanggal opname',
            'items.*.physical_qty' => 'jumlah fisik',
            'items.*.notes' => 'catatan baris',
        ];
    }
}
