<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * @var list<string>
     */
    private const NAMES = [
        'Openings',
        'Acoustic rating',
        'Door size',
        'Frame throat / wall',
        'Handing / swing',
        'Fire rating',
        'Location / opening',
    ];

    public function up(): void
    {
        $now = now();

        foreach (self::NAMES as $name) {
            $exists = DB::table('quotation_fields')
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->exists();

            if ($exists) {
                continue;
            }

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
        $seeded = ['Openings', 'Acoustic rating', 'Frame throat / wall', 'Handing / swing'];

        DB::table('quotation_fields')
            ->whereIn('name', $seeded)
            ->delete();
    }
};
