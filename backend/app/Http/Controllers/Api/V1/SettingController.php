<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSettingsRequest;
use App\Models\Setting;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;

class SettingController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => $this->values(),
        ]);
    }

    public function update(UpdateSettingsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $before = $this->values();

        foreach ($validated as $key => $value) {
            Setting::query()->updateOrCreate(
                ['key' => $key],
                ['value' => $value]
            );
        }

        $this->auditLogger->log('settings.updated', null, [
            'keys' => array_keys($validated),
            'before' => $before,
            'after' => $validated,
        ]);

        return response()->json([
            'message' => 'Pengaturan organisasi berhasil disimpan.',
            'data' => $this->values(),
        ]);
    }

    /**
     * @return array<string, string|null>
     */
    private function values(): array
    {
        $stored = Setting::allValues();

        return [
            'organization_name' => $stored['organization_name'] ?? 'Organisasi Anda',
            'organization_short_name' => $stored['organization_short_name'] ?? 'Organisasi',
            'app_name' => $stored['app_name'] ?? 'Sistem Informasi Manajemen Aset',
            'public_tagline' => $stored['public_tagline'] ?? 'Pengelolaan aset yang tertib, transparan, dan dapat diaudit.',
            'footer_text' => $stored['footer_text'] ?? 'Sistem manajemen aset untuk organisasi, kampus, dan tim kerja.',
            'contact_email' => $stored['contact_email'] ?? null,
        ];
    }
}
