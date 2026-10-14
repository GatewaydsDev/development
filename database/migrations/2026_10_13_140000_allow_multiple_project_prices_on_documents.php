<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotation_project_price', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_price_id')->constrained('project_prices')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['quotation_id', 'project_price_id']);
        });

        Schema::create('bid_project_price', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('bid_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_price_id')->constrained('project_prices')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['bid_id', 'project_price_id']);
        });

        $now = now();

        if (Schema::hasColumn('quotations', 'project_price_id')) {
            foreach (DB::table('quotations')->whereNotNull('project_price_id')->orderBy('id')->get(['id', 'project_price_id']) as $quotation) {
                DB::table('quotation_project_price')->insert([
                    'quotation_id' => $quotation->id,
                    'project_price_id' => $quotation->project_price_id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            Schema::table('quotations', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('project_price_id');
            });
        }

        if (Schema::hasColumn('bids', 'project_price_id')) {
            foreach (DB::table('bids')->whereNotNull('project_price_id')->orderBy('id')->get(['id', 'project_price_id']) as $bid) {
                DB::table('bid_project_price')->insert([
                    'bid_id' => $bid->id,
                    'project_price_id' => $bid->project_price_id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            Schema::table('bids', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('project_price_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->foreignId('project_price_id')
                ->nullable()
                ->after('project_amount')
                ->constrained('project_prices')
                ->nullOnDelete();
        });

        Schema::table('bids', function (Blueprint $table): void {
            $table->foreignId('project_price_id')
                ->nullable()
                ->after('project_id')
                ->constrained('project_prices')
                ->nullOnDelete();
        });

        foreach (DB::table('quotation_project_price')->orderBy('id')->get(['quotation_id', 'project_price_id']) as $row) {
            DB::table('quotations')
                ->where('id', $row->quotation_id)
                ->whereNull('project_price_id')
                ->update(['project_price_id' => $row->project_price_id]);
        }

        foreach (DB::table('bid_project_price')->orderBy('id')->get(['bid_id', 'project_price_id']) as $row) {
            DB::table('bids')
                ->where('id', $row->bid_id)
                ->whereNull('project_price_id')
                ->update(['project_price_id' => $row->project_price_id]);
        }

        Schema::dropIfExists('bid_project_price');
        Schema::dropIfExists('quotation_project_price');
    }
};
