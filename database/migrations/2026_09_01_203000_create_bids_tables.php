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
        Schema::create('bid_stage_types', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('bid_scopes', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('bid_pricing_statuses', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('bids', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('bid_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bid_stage_type_id')->constrained('bid_stage_types')->restrictOnDelete();
            $table->date('stage_date')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('bid_scope', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bid_scope_id')->constrained('bid_scopes')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['bid_id', 'bid_scope_id']);
        });

        Schema::create('bid_pricings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->date('revision_date')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('bid_pricing_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_pricing_id')->constrained('bid_pricings')->cascadeOnDelete();
            $table->string('description');
            $table->text('pricing_basis')->nullable();
            $table->foreignId('bid_pricing_status_id')->nullable()->constrained('bid_pricing_statuses')->nullOnDelete();
            $table->decimal('amount', 12, 2)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $now = now();

        foreach (['Preliminary Bid', 'Revised Bid', 'Final Bid'] as $name) {
            DB::table('bid_stage_types')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (['Budget allowance', 'Firm', 'Allowance', 'Estimate', 'Not included'] as $name) {
            DB::table('bid_pricing_statuses')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bid_pricing_items');
        Schema::dropIfExists('bid_pricings');
        Schema::dropIfExists('bid_scope');
        Schema::dropIfExists('bid_stages');
        Schema::dropIfExists('bids');
        Schema::dropIfExists('bid_pricing_statuses');
        Schema::dropIfExists('bid_scopes');
        Schema::dropIfExists('bid_stage_types');
    }
};
