<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaveAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('assets.manage') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $assetId = $this->route('asset')?->id;

        return [
            'code' => ['required', 'string', 'max:40', 'regex:/^[A-Z0-9][A-Z0-9._\-\/]*$/', 'unique:assets,code'.($assetId ? ','.$assetId : '')],
            'name' => ['required', 'string', 'max:180'],
            'category_id' => ['required', 'integer', 'exists:asset_categories,id'],
            'unit' => ['required', 'string', 'max:30'],
            'has_serial_number' => ['required', 'boolean'],
            'description' => ['nullable', 'string', 'max:2000'],
            'minimum_stock' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function prepareForValidation(): void
    {
        $this->merge([
            'code' => strtoupper(trim((string) $this->input('code'))),
            'name' => trim((string) $this->input('name')),
            'unit' => trim((string) $this->input('unit')),
        ]);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.regex' => 'Kode aset hanya boleh berisi huruf, angka, titik, garis bawah, strip, dan garis miring.',
            'code.unique' => 'Kode aset sudah digunakan. Gunakan kode lain.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'code' => 'kode aset',
            'name' => 'nama aset',
            'category_id' => 'kategori',
            'unit' => 'satuan',
            'has_serial_number' => 'penggunaan serial number',
            'minimum_stock' => 'stok minimum',
        ];
    }
}
