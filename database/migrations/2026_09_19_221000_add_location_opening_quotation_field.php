<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $name = 'Location / opening';
        $exists = DB::table('quotation_fields')
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->exists();

        if ($exists) {
            return;
        }

        $now = now();

        DB::table('quotation_fields')->insert([
            'uuid' => (string) Str::uuid(),
            'name' => $name,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('quotation_fields')
            ->whereRaw('LOWER(name) = ?', [mb_strtolower('Location / opening')])
            ->delete();
    }
};
