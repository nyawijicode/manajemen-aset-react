<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->default('admin')->index()->after('email');
            $table->boolean('is_active')->default(true)->index()->after('role');
            $table->boolean('must_change_password')->default(true)->after('is_active');
            $table->timestamp('last_login_at')->nullable()->after('must_change_password');
            $table->timestamp('deactivated_at')->nullable()->after('last_login_at');
            $table->unsignedBigInteger('created_by')->nullable()->after('deactivated_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'role',
                'is_active',
                'must_change_password',
                'last_login_at',
                'deactivated_at',
                'created_by',
            ]);
        });
    }
};
