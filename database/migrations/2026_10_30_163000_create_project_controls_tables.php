<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_controls', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('job_code', 40)->unique();
            $table->string('name');
            $table->string('customer')->nullable();
            $table->string('location')->nullable();
            $table->date('bid_date')->nullable();
            $table->decimal('current_value', 14, 2)->nullable();
            $table->string('pipeline_status', 20)->default('active')->index();
            $table->text('status_note')->nullable();
            $table->string('award_status')->nullable();
            $table->string('probability', 40)->nullable();
            $table->text('scope_summary')->nullable();
            $table->unsignedInteger('assembly_count')->nullable();
            $table->string('pricing_class', 120)->nullable();
            $table->decimal('material_cost', 14, 2)->nullable();
            $table->decimal('freight_cost', 14, 2)->nullable();
            $table->decimal('labor_cost', 14, 2)->nullable();
            $table->decimal('other_cost', 14, 2)->nullable();
            $table->decimal('deposit_percent', 5, 2)->nullable();
            $table->date('bid_due_date')->nullable();
            $table->date('next_follow_up_date')->nullable()->index();
            $table->date('material_payment_date')->nullable();
            $table->date('customer_payment_date')->nullable();
            $table->string('lead_time')->nullable();
            $table->string('bonding_required', 80)->nullable();
            $table->text('payment_plan')->nullable();
            $table->string('cash_flag')->nullable();
            $table->text('next_step')->nullable();
            $table->text('bid_document')->nullable();
            $table->boolean('counts_in_demonstrated')->default(false);
            $table->timestamps();
        });

        Schema::create('project_control_bids', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_control_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('name');
            $table->date('quoted_on')->nullable();
            $table->decimal('amount', 14, 2)->nullable();
            $table->string('standing', 20)->default('current');
            $table->string('count_rule')->nullable();
            $table->text('document')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('project_control_openings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_control_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('category', 120)->nullable();
            $table->string('description', 500);
            $table->string('mark', 120)->nullable();
            $table->string('size', 120)->nullable();
            $table->decimal('quantity', 10, 2)->nullable();
            $table->string('requirement')->nullable();
            $table->text('hardware')->nullable();
            $table->text('additional_needed')->nullable();
            $table->string('procurement_status')->nullable();
            $table->string('supplier')->nullable();
            $table->decimal('unit_sell', 14, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('project_control_procurements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_control_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('assembly', 500);
            $table->decimal('quantity', 10, 2)->nullable();
            $table->string('manufacturer')->nullable();
            $table->string('quote_number', 80)->nullable();
            $table->date('quoted_on')->nullable();
            $table->decimal('supplier_cost', 14, 2)->nullable();
            $table->string('order_status')->nullable();
            $table->string('po_number', 80)->nullable();
            $table->string('lead_time')->nullable();
            $table->text('next_action')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_control_procurements');
        Schema::dropIfExists('project_control_openings');
        Schema::dropIfExists('project_control_bids');
        Schema::dropIfExists('project_controls');
    }
};
