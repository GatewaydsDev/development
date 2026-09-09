<?php

use App\Models\TaxState;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tax_states', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->decimal('rate', 6, 3)->nullable();
            $table->timestamps();
        });

        $now = now();
        $idsByName = [];
        $idsByLegacyCode = [];

        foreach (TaxState::DEFAULTS as $state) {
            $id = DB::table('tax_states')->insertGetId([
                'uuid' => (string) Str::uuid(),
                'name' => $state['name'],
                'rate' => $state['rate'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $idsByName[$state['name']] = $id;
        }

        $idsByLegacyCode['NJ'] = $idsByName['New Jersey'] ?? null;
        $idsByLegacyCode['NY'] = $idsByName['New York'] ?? null;
        $idsByLegacyCode['PA'] = $idsByName['Pennsylvania'] ?? null;

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('tax_state_id')
                ->nullable()
                ->after('min_markup_percent')
                ->constrained('tax_states')
                ->nullOnDelete();
        });

        if (Schema::hasColumn('products', 'tax_state')) {
            foreach (DB::table('products')->whereNotNull('tax_state')->get(['id', 'tax_state']) as $product) {
                $taxStateId = $idsByLegacyCode[$product->tax_state] ?? null;

                if ($taxStateId) {
                    DB::table('products')
                        ->where('id', $product->id)
                        ->update(['tax_state_id' => $taxStateId]);
                }
            }

            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('tax_state');
            });
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tax_state_id');
        });

        Schema::dropIfExists('tax_states');
    }
};
