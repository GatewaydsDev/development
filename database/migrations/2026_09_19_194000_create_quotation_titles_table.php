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
        Schema::create('quotation_titles', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $names = DB::table('quotations')
            ->whereNotNull('title')
            ->where('title', '!=', '')
            ->distinct()
            ->orderBy('title')
            ->pluck('title');

        $seen = [];

        foreach ($names as $name) {
            $trimmed = trim((string) $name);
            $key = mb_strtolower($trimmed);

            if ($trimmed === '' || isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;

            DB::table('quotation_titles')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $trimmed,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('quotation_titles');
    }
};
