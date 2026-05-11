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
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'date_of_birth')) {
                $table->date('date_of_birth')->nullable()->after('email');
            }
        });

        if (Schema::hasTable('languages')) {
            $now = now();

            collect([
                ['name' => 'English', 'abbreviation' => 'en'],
                ['name' => 'Spanish', 'abbreviation' => 'es'],
            ])->each(function (array $language) use ($now): void {
                $existing = DB::table('languages')
                    ->where('abbreviation', $language['abbreviation'])
                    ->orWhere('name', $language['name'])
                    ->first();

                if ($existing) {
                    DB::table('languages')
                        ->where('id', $existing->id)
                        ->update([
                            'name' => $language['name'],
                            'abbreviation' => $language['abbreviation'],
                            'updated_at' => $now,
                        ]);

                    return;
                }

                DB::table('languages')->insert([
                        'uuid' => (string) Str::uuid(),
                        'name' => $language['name'],
                        'abbreviation' => $language['abbreviation'],
                        'updated_at' => $now,
                        'created_at' => $now,
                ]);
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'date_of_birth')) {
                $table->dropColumn('date_of_birth');
            }
        });
    }
};
