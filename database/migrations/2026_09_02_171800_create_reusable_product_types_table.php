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
        Schema::create('product_types', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->boolean('allows_parts')->default(false);
            $table->timestamps();
        });

        $now = now();
        $doorId = DB::table('product_types')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'name' => 'Door',
            'allows_parts' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $partId = DB::table('product_types')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'name' => 'Part',
            'allows_parts' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('product_type_id')
                ->nullable()
                ->constrained('product_types')
                ->nullOnDelete();
        });

        if (Schema::hasColumn('products', 'kind')) {
            DB::table('products')->where('kind', 'door')->update(['product_type_id' => $doorId]);
            DB::table('products')->whereNull('product_type_id')->update(['product_type_id' => $partId]);
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_type_id');
        });

        Schema::dropIfExists('product_types');
    }
};
