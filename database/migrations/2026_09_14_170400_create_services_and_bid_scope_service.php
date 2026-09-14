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
        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        $now = now();
        $serviceNames = [];

        if (Schema::hasTable('product_service_types')) {
            foreach (DB::table('product_service_types')->orderBy('name')->get(['name']) as $row) {
                $name = trim((string) $row->name);

                if ($name !== '') {
                    $serviceNames[mb_strtolower($name)] = $name;
                }
            }
        }

        $serviceNames[mb_strtolower('Assembly w/ vision glazing')] = 'Assembly w/ vision glazing';

        foreach ($serviceNames as $name) {
            DB::table('services')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'description' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::table('bid_scope_products', function (Blueprint $table) {
            $table->foreignId('service_id')
                ->nullable()
                ->after('product_id')
                ->constrained('services')
                ->restrictOnDelete();
        });

        if (Schema::hasColumn('products', 'product_service_type_id')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropConstrainedForeignId('product_service_type_id');
            });
        }

        if (Schema::hasColumn('products', 'service_product_name')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('service_product_name');
            });
        }

        Schema::dropIfExists('product_service_types');

        $serviceTypeId = DB::table('product_types')
            ->whereRaw('LOWER(name) = ?', ['service'])
            ->value('id');

        if ($serviceTypeId) {
            $partId = DB::table('product_types')
                ->whereRaw('LOWER(name) = ?', ['part'])
                ->value('id');

            if ($partId) {
                DB::table('products')
                    ->where(function ($query) use ($serviceTypeId): void {
                        $query
                            ->where('product_type_id', $serviceTypeId)
                            ->orWhere('kind', 'service');
                    })
                    ->update([
                        'product_type_id' => $partId,
                        'kind' => 'part',
                        'updated_at' => $now,
                    ]);
            }

            DB::table('product_types')->where('id', $serviceTypeId)->delete();
        }
    }

    public function down(): void
    {
        Schema::table('bid_scope_products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('service_id');
        });

        Schema::dropIfExists('services');
    }
};
