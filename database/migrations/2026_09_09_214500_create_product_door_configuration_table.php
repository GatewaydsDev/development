<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_door_configuration', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('door_configuration_id')->constrained('door_configurations')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['product_id', 'door_configuration_id'], 'product_door_config_unique');
        });

        if (Schema::hasColumn('products', 'door_configuration_id')) {
            $now = now();

            foreach (DB::table('products')->whereNotNull('door_configuration_id')->get(['id', 'door_configuration_id']) as $product) {
                DB::table('product_door_configuration')->insert([
                    'product_id' => $product->id,
                    'door_configuration_id' => $product->door_configuration_id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            Schema::table('products', function (Blueprint $table) {
                $table->dropConstrainedForeignId('door_configuration_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('door_configuration_id')
                ->nullable()
                ->constrained('door_configurations')
                ->nullOnDelete();
        });

        $firstByProduct = DB::table('product_door_configuration')
            ->orderBy('id')
            ->get(['product_id', 'door_configuration_id'])
            ->unique('product_id');

        foreach ($firstByProduct as $row) {
            DB::table('products')
                ->where('id', $row->product_id)
                ->update(['door_configuration_id' => $row->door_configuration_id]);
        }

        Schema::dropIfExists('product_door_configuration');
    }
};
