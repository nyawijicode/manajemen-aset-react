<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_ins', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 40)->unique();
            $table->foreignId('asset_id')->constrained('assets')->restrictOnDelete();
            $table->date('transaction_date');
            $table->unsignedInteger('qty');
            $table->string('supplier_or_source', 180);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('idempotency_key', 80)->nullable()->unique();
            $table->timestamps();

            $table->index(['transaction_date', 'asset_id']);
            $table->index('supplier_or_source');
        });

        Schema::create('asset_outs', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 40)->unique();
            $table->foreignId('asset_id')->constrained('assets')->restrictOnDelete();
            $table->date('transaction_date');
            $table->unsignedInteger('qty');
            $table->string('recipient', 180);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('idempotency_key', 80)->nullable()->unique();
            $table->timestamps();

            $table->index(['transaction_date', 'asset_id']);
            $table->index('recipient');
        });

        Schema::create('asset_serial_numbers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->restrictOnDelete();
            $table->foreignId('asset_in_id')->constrained('asset_ins')->restrictOnDelete();
            $table->foreignId('asset_out_id')->nullable()->constrained('asset_outs')->restrictOnDelete();
            $table->string('serial_number', 120)->unique();
            $table->string('status', 20)->default('available');
            $table->timestamps();

            $table->index(['asset_id', 'status']);
            $table->index('asset_out_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_serial_numbers');
        Schema::dropIfExists('asset_outs');
        Schema::dropIfExists('asset_ins');
    }
};
