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
        $now = now();

        if (! DB::table('door_configurations')->whereRaw('LOWER(name) = ?', ['pair'])->exists()) {
            DB::table('door_configurations')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => 'Pair',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::create('opening_categories', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $known = [];

        foreach (DB::table('takeoff_openings')->whereNotNull('product_category')->distinct()->pluck('product_category') as $name) {
            $trimmed = trim((string) $name);
            $key = mb_strtolower($trimmed);

            if ($trimmed === '' || isset($known[$key])) {
                continue;
            }

            $known[$key] = true;

            DB::table('opening_categories')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $trimmed,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::table('takeoff_openings', function (Blueprint $table) {
            $table->foreignId('door_configuration_id')
                ->nullable()
                ->after('opening_type')
                ->constrained('door_configurations')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_openings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('door_configuration_id');
        });

        Schema::dropIfExists('opening_categories');
    }
};
