<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_door_handing', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('door_handing_id')->constrained('door_handings')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['product_id', 'door_handing_id'], 'product_door_handing_unique');
        });

        if (Schema::hasColumn('products', 'door_handing_id')) {
            $now = now();

            foreach (DB::table('products')->whereNotNull('door_handing_id')->get(['id', 'door_handing_id']) as $product) {
                DB::table('product_door_handing')->insert([
                    'product_id' => $product->id,
                    'door_handing_id' => $product->door_handing_id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            Schema::table('products', function (Blueprint $table) {
                $table->dropConstrainedForeignId('door_handing_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('door_handing_id')
                ->nullable()
                ->constrained('door_handings')
                ->nullOnDelete();
        });

        $firstByProduct = DB::table('product_door_handing')
            ->orderBy('id')
            ->get(['product_id', 'door_handing_id'])
            ->unique('product_id');

        foreach ($firstByProduct as $row) {
            DB::table('products')
                ->where('id', $row->product_id)
                ->update(['door_handing_id' => $row->door_handing_id]);
        }

        Schema::dropIfExists('product_door_handing');
    }
};
