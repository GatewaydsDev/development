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
        Schema::table('product_types', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(10)->after('allows_parts');
        });

        DB::table('product_types')
            ->whereRaw('LOWER(name) = ?', ['door'])
            ->update([
                'allows_parts' => true,
                'sort_order' => 1,
                'updated_at' => now(),
            ]);

        DB::table('product_types')
            ->whereRaw('LOWER(name) = ?', ['part'])
            ->update([
                'allows_parts' => false,
                'sort_order' => 3,
                'updated_at' => now(),
            ]);

        $window = DB::table('product_types')
            ->whereRaw('LOWER(name) = ?', ['window'])
            ->first();

        if ($window) {
            DB::table('product_types')
                ->where('id', $window->id)
                ->update([
                    'allows_parts' => true,
                    'sort_order' => 2,
                    'updated_at' => now(),
                ]);

            DB::table('products')
                ->where('product_type_id', $window->id)
                ->update(['kind' => 'window']);

            return;
        }

        $now = now();

        DB::table('product_types')->insert([
            'uuid' => (string) Str::uuid(),
            'name' => 'Window',
            'allows_parts' => true,
            'sort_order' => 2,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        $windowId = DB::table('product_types')
            ->whereRaw('LOWER(name) = ?', ['window'])
            ->value('id');

        if ($windowId) {
            $partId = DB::table('product_types')
                ->whereRaw('LOWER(name) = ?', ['part'])
                ->value('id');

            if ($partId) {
                DB::table('products')
                    ->where('product_type_id', $windowId)
                    ->update(['product_type_id' => $partId]);
            }

            DB::table('product_types')->where('id', $windowId)->delete();
        }

        Schema::table('product_types', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
