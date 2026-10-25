<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('settings.manage') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'organization_name' => ['required', 'string', 'max:120'],
            'organization_short_name' => ['required', 'string', 'max:30'],
            'app_name' => ['required', 'string', 'max:80'],
            'public_tagline' => ['required', 'string', 'max:200'],
            'footer_text' => ['required', 'string', 'max:200'],
            'contact_email' => ['nullable', 'email', 'max:190'],
        ];
    }
}
