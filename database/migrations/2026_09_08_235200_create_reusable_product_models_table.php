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
        Schema::create('product_models', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $now = now();

        foreach (DB::table('products')->orderBy('id')->get(['id', 'name']) as $product) {
            $name = trim((string) $product->name);

            if ($name === '') {
                continue;
            }

            $modelId = DB::table('product_models')
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->value('id');

            if (! $modelId) {
                $modelId = DB::table('product_models')->insertGetId([
                    'uuid' => (string) Str::uuid(),
                    'name' => $name,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('products')
                ->where('id', $product->id)
                ->update(['name' => $name]);
        }

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('product_model_id')
                ->nullable()
                ->unique()
                ->after('manufacturer_id')
                ->constrained('product_models')
                ->nullOnDelete();
        });

        foreach (DB::table('products')->orderBy('id')->get(['id', 'name']) as $product) {
            $modelId = DB::table('product_models')
                ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim((string) $product->name))])
                ->value('id');

            if ($modelId) {
                DB::table('products')
                    ->where('id', $product->id)
                    ->update(['product_model_id' => $modelId]);
            }
        }

    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_model_id');
        });

        Schema::dropIfExists('product_models');
    }
};
