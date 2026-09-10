<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_state_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tax_state_id')->constrained('tax_states')->cascadeOnDelete();
            $table->decimal('price', 12, 2)->nullable();
            $table->decimal('markup_percent', 5, 2)->nullable();
            $table->decimal('min_markup_percent', 5, 2)->nullable();
            $table->timestamps();

            $table->unique(['product_id', 'tax_state_id'], 'product_state_price_unique');
        });

        $now = now();

        foreach (DB::table('products')->where('kind', 'door')->whereNotNull('tax_state_id')->get([
            'id',
            'tax_state_id',
            'price',
            'markup_percent',
            'min_markup_percent',
        ]) as $product) {
            DB::table('product_state_prices')->insert([
                'product_id' => $product->id,
                'tax_state_id' => $product->tax_state_id,
                'price' => $product->price,
                'markup_percent' => $product->markup_percent,
                'min_markup_percent' => $product->min_markup_percent,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('products')->where('kind', 'door')->update([
            'price' => null,
            'markup_percent' => null,
            'min_markup_percent' => null,
            'tax_state_id' => null,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('product_state_prices');
    }
};
