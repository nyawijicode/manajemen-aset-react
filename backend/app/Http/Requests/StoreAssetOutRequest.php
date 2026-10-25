<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAssetOutRequest extends FormRequest
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
            'recipient' => ['required', 'string', 'max:180'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'serial_ids' => ['nullable', 'array', 'max:10000'],
            'serial_ids.*' => ['required', 'integer', 'distinct', 'exists:asset_serial_numbers,id'],
        ];
    }

    public function prepareForValidation(): void
    {
        $this->merge([
            'recipient' => trim((string) $this->input('recipient')),
        ]);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'transaction_date.before_or_equal' => 'Tanggal transaksi tidak boleh melebihi hari ini.',
            'serial_ids.*.exists' => 'Serial number yang dipilih tidak valid.',
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
            'recipient' => 'penerima atau unit tujuan',
            'serial_ids' => 'serial number',
        ];
    }
}
