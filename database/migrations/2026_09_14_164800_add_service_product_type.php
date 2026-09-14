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
        Schema::create('product_service_types', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $now = now();

        foreach (['vision glaze'] as $name) {
            DB::table('product_service_types')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::table('products', function (Blueprint $table) {
            $table->string('service_product_name')->nullable()->after('name');
            $table->foreignId('product_service_type_id')
                ->nullable()
                ->after('service_product_name')
                ->constrained('product_service_types')
                ->nullOnDelete();
        });

        $service = DB::table('product_types')
            ->whereRaw('LOWER(name) = ?', ['service'])
            ->first();

        if ($service) {
            DB::table('product_types')
                ->where('id', $service->id)
                ->update([
                    'allows_parts' => false,
                    'sort_order' => 4,
                    'updated_at' => $now,
                ]);

            DB::table('products')
                ->where('product_type_id', $service->id)
                ->update(['kind' => 'service']);

            return;
        }

        DB::table('product_types')->insert([
            'uuid' => (string) Str::uuid(),
            'name' => 'Service',
            'allows_parts' => false,
            'sort_order' => 4,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_service_type_id');
            $table->dropColumn('service_product_name');
        });

        $serviceId = DB::table('product_types')
            ->whereRaw('LOWER(name) = ?', ['service'])
            ->value('id');

        if ($serviceId) {
            $partId = DB::table('product_types')
                ->whereRaw('LOWER(name) = ?', ['part'])
                ->value('id');

            if ($partId) {
                DB::table('products')
                    ->where('product_type_id', $serviceId)
                    ->update([
                        'product_type_id' => $partId,
                        'kind' => 'part',
                    ]);
            }

            DB::table('product_types')->where('id', $serviceId)->delete();
        }

        Schema::dropIfExists('product_service_types');
    }
};
