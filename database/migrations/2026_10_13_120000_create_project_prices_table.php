<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_prices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->decimal('amount', 15, 2);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $now = now();

        foreach (DB::table('projects')->whereNotNull('budget_amount')->orderBy('id')->get(['id', 'budget_amount']) as $project) {
            DB::table('project_prices')->insert([
                'project_id' => $project->id,
                'label' => 'Budget',
                'amount' => $project->budget_amount,
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

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
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('project_price_id');
        });

        Schema::table('quotations', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('project_price_id');
        });

        Schema::dropIfExists('project_prices');
    }
};
