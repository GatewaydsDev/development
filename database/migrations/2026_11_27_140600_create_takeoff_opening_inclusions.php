<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('takeoff_opening_inclusions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('takeoff_id')->constrained()->cascadeOnDelete();
            $table->foreignId('opening_id')->constrained('takeoff_openings')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('supplier_quote_id')->nullable()->constrained('takeoff_supplier_quotes')->nullOnDelete();
            $table->string('supplier_name')->nullable();
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->string('inclusion')->default('pending');
            $table->timestamp('confirmed_at')->nullable();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['opening_id', 'inclusion']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('takeoff_opening_inclusions');
    }
};
