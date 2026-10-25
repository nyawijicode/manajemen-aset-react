<?php

namespace App\Http\Requests;

use App\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreAssetInRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('transactions.create') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'transaction_date' => ['required', 'date', 'before_or_equal:today'],
            'qty' => ['required', 'integer', 'min:1', 'max:10000'],
            'supplier_or_source' => ['required', 'string', 'max:180'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'serial_numbers' => ['nullable', 'array', 'max:10000'],
            'serial_numbers.*' => ['required', 'string', 'max:120', 'distinct'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $asset = Asset::query()->find($this->input('asset_id'));

            if (! $asset) {
                return;
            }

            $serials = $this->input('serial_numbers', []);

            if ($asset->has_serial_number) {
                if (! is_array($serials) || count($serials) !== (int) $this->input('qty')) {
                    $validator->errors()->add('serial_numbers', 'Jumlah serial number harus sama dengan kuantitas masuk.');
                }
            } elseif (is_array($serials) && $serials !== []) {
                $validator->errors()->add('serial_numbers', 'Aset ini tidak menggunakan serial number.');
            }
        });
    }

    public function prepareForValidation(): void
    {
        $serials = $this->input('serial_numbers');

        if (is_array($serials)) {
            $this->merge([
                'serial_numbers' => array_map(
                    fn ($value): string => strtoupper(trim((string) $value)),
                    $serials
                ),
            ]);
        }

        $this->merge([
            'supplier_or_source' => trim((string) $this->input('supplier_or_source')),
        ]);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'transaction_date.before_or_equal' => 'Tanggal transaksi tidak boleh melebihi hari ini.',
            'serial_numbers.*.distinct' => 'Terdapat serial number duplikat pada daftar.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'asset_id' => 'aset',
            'transaction_date' => 'tanggal transaksi',
            'qty' => 'jumlah',
            'supplier_or_source' => 'sumber atau supplier',
            'serial_numbers' => 'serial number',
        ];
    }
}
