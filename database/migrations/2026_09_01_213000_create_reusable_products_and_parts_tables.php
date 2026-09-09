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
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->string('kind');
            $table->text('description')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('product_part', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('part_id')->constrained('products')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['product_id', 'part_id']);
        });

        Schema::table('bid_scope_products', function (Blueprint $table) {
            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->nullOnDelete();
        });

        $now = now();

        foreach (DB::table('bid_scope_products')->orderBy('id')->get() as $row) {
            $name = trim((string) $row->description);

            if ($name === '') {
                continue;
            }

            $productId = DB::table('products')
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->value('id');

            if (! $productId) {
                $productId = DB::table('products')->insertGetId([
                    'uuid' => (string) Str::uuid(),
                    'name' => $name,
                    'kind' => 'part',
                    'description' => null,
                    'notes' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('bid_scope_products')
                ->where('id', $row->id)
                ->update(['product_id' => $productId]);
        }
    }

    public function down(): void
    {
        Schema::table('bid_scope_products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_id');
        });

        Schema::dropIfExists('product_part');
        Schema::dropIfExists('products');
    }
};
