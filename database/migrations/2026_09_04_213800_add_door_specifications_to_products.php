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
        Schema::create('door_constructions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('product_door_construction', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('door_construction_id')->constrained('door_constructions')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['product_id', 'door_construction_id']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('rf_shielding')->nullable()->after('notes');
            $table->string('stc_rating')->nullable()->after('rf_shielding');
            $table->boolean('ada')->nullable()->after('stc_rating');
            $table->string('fire_label')->nullable()->after('ada');
            $table->string('thickness')->nullable()->after('fire_label');
            $table->string('spec_pdf_path')->nullable()->after('thickness');
        });

        $now = now();

        foreach (['Metal', 'Wood'] as $name) {
            DB::table('door_constructions')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'rf_shielding',
                'stc_rating',
                'ada',
                'fire_label',
                'thickness',
                'spec_pdf_path',
            ]);
        });

        Schema::dropIfExists('product_door_construction');
        Schema::dropIfExists('door_constructions');
    }
};
