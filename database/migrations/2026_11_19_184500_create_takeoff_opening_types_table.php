<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('takeoff_opening_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $now = now();
        $names = ['Door', 'Window'];

        if (Schema::hasTable('takeoff_openings')) {
            $used = DB::table('takeoff_openings')
                ->whereNotNull('opening_type')
                ->distinct()
                ->pluck('opening_type');

            foreach ($used as $type) {
                $trimmed = trim((string) $type);
                $lower = mb_strtolower($trimmed);
                $names[] = match ($lower) {
                    'door', 'doors' => 'Door',
                    'window', 'windows' => 'Window',
                    default => $trimmed,
                };
            }
        }

        $saved = [];

        foreach (array_filter($names) as $name) {
            $key = mb_strtolower($name);

            if (isset($saved[$key])) {
                continue;
            }

            $saved[$key] = true;
            DB::table('takeoff_opening_types')->insert([
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('takeoff_opening_types');
    }
};
