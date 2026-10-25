<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\AssetCategory;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedSettings();
        $this->seedUsers();
        $this->seedCategories();

        if (app()->isLocal() && env('SEED_DEMO', true)) {
            $this->call(DemoDataSeeder::class);
        }
    }

    private function seedSettings(): void
    {
        $settings = [
            'organization_name' => env('ORGANIZATION_NAME', 'Organisasi Anda'),
            'organization_short_name' => env('ORGANIZATION_SHORT_NAME', 'Organisasi'),
            'app_name' => 'Sistem Informasi Manajemen Aset',
            'public_tagline' => 'Pengelolaan aset yang tertib, transparan, dan dapat diaudit.',
            'footer_text' => 'Sistem manajemen aset untuk organisasi, kampus, dan tim kerja.',
            'contact_email' => env('ORGANIZATION_EMAIL'),
        ];

        foreach ($settings as $key => $value) {
            Setting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }

    private function seedUsers(): void
    {
        $accounts = [
            [
                'name' => env('SEED_PIMPINAN_NAME', 'Manajer Organisasi'),
                'email' => env('SEED_PIMPINAN_EMAIL', 'pimpinan@example.com'),
                'role' => Role::Pimpinan,
                'password' => env('SEED_PIMPINAN_PASSWORD'),
            ],
            [
                'name' => env('SEED_ADMIN_NAME', 'Admin Aset'),
                'email' => env('SEED_ADMIN_EMAIL', 'admin@example.com'),
                'role' => Role::Admin,
                'password' => env('SEED_ADMIN_PASSWORD'),
            ],
        ];

        foreach ($accounts as $account) {
            if (User::query()->where('email', $account['email'])->exists()) {
                continue;
            }

            $password = $account['password'];
            $generated = false;

            if (! is_string($password) || strlen($password) < 12) {
                $password = 'Aa1!'.Str::random(14);
                $generated = true;
            }

            User::query()->create([
                'name' => $account['name'],
                'email' => $account['email'],
                'password' => Hash::make($password),
                'role' => $account['role'],
                'is_active' => true,
                'must_change_password' => true,
            ]);

            if ($generated) {
                $this->command?->warn("Kata sandi awal {$account['email']}: {$password} (hanya ditampilkan sekali)");
            }
        }
    }

    private function seedCategories(): void
    {
        $categories = [
            'Elektronik dan Komputer' => 'Perangkat komputer, laptop, monitor, dan elektronik kantor.',
            'Perabot dan Furnitur' => 'Meja, kursi, lemari, dan perabot kantor lainnya.',
            'Kendaraan' => 'Kendaraan operasional roda dua dan roda empat.',
            'Alat Tulis Kantor' => 'Bahan habis pakai dan alat tulis kantor.',
            'Perlengkapan Jaringan' => 'Router, switch, access point, dan perlengkapan jaringan.',
            'Peralatan Laboratorium' => 'Peralatan pendukung laboratorium dan pengukuran.',
            'Dokumen dan Arsip' => 'Dokumen, arsip, dan bahan referensi.',
            'Lainnya' => 'Aset yang belum dikelompokkan pada kategori lain.',
        ];

        foreach ($categories as $name => $description) {
            AssetCategory::query()->updateOrCreate(
                ['name' => $name],
                ['description' => $description]
            );
        }
    }
}
