<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotation_fields', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('quotation_product_fields', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('quotation_field_id')->constrained('quotation_fields')->cascadeOnDelete();
            $table->text('value')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $now = now();

        foreach ([
            'Qty',
            'Location',
            'Door size',
            'Fire rating',
            'Configuration',
            'Door handing',
            'Construction',
            'Thickness',
            'STC rating',
            'RF shielding',
            'ADA',
            'Description',
            'Weight',
            'Area tested',
            'Glass type',
            'Glazing type',
            'Seal',
            'Manufacturer',
            'Abbreviation',
            'Product',
        ] as $name) {
            DB::table('quotation_fields')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('quotation_product_fields');
        Schema::dropIfExists('quotation_fields');
    }
};
