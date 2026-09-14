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
        Schema::create('window_glass_types', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('window_glazing_types', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('window_seals', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $now = now();

        foreach (['1/2" LAM x 1/4" LAM'] as $name) {
            DB::table('window_glass_types')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (['Neoprene'] as $name) {
            DB::table('window_glazing_types')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (['NC3'] as $name) {
            DB::table('window_seals')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('window_glass_type_id')
                ->nullable()
                ->after('weight')
                ->constrained('window_glass_types')
                ->nullOnDelete();
            $table->foreignId('window_glazing_type_id')
                ->nullable()
                ->after('window_glass_type_id')
                ->constrained('window_glazing_types')
                ->nullOnDelete();
            $table->foreignId('window_seal_id')
                ->nullable()
                ->after('window_glazing_type_id')
                ->constrained('window_seals')
                ->nullOnDelete();
        });

        $this->moveNamedValues('glass_type', 'window_glass_types', 'window_glass_type_id');
        $this->moveNamedValues('glazing_type', 'window_glazing_types', 'window_glazing_type_id');
        $this->moveNamedValues('seal', 'window_seals', 'window_seal_id');

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['glass_type', 'glazing_type', 'seal']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('glass_type')->nullable()->after('weight');
            $table->string('glazing_type')->nullable()->after('area_tested');
            $table->string('seal')->nullable()->after('glass_type');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('window_glass_type_id');
            $table->dropConstrainedForeignId('window_glazing_type_id');
            $table->dropConstrainedForeignId('window_seal_id');
        });

        Schema::dropIfExists('window_seals');
        Schema::dropIfExists('window_glazing_types');
        Schema::dropIfExists('window_glass_types');
    }

    private function moveNamedValues(string $column, string $table, string $foreignKey): void
    {
        if (! Schema::hasColumn('products', $column)) {
            return;
        }

        $now = now();

        foreach (DB::table('products')->whereNotNull($column)->where($column, '!=', '')->get(['id', $column]) as $product) {
            $name = trim((string) $product->{$column});

            if ($name === '') {
                continue;
            }

            $existingId = DB::table($table)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->value('id');

            if (! $existingId) {
                $existingId = DB::table($table)->insertGetId([
                    'uuid' => (string) Str::uuid(),
                    'name' => $name,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('products')->where('id', $product->id)->update([
                $foreignKey => $existingId,
            ]);
        }
    }
};
