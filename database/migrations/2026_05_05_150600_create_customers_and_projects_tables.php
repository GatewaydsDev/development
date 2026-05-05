<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name');
            $table->string('company_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone_number')->nullable();
            $table->string('address_line_1')->nullable();
            $table->string('address_line_2')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('postal_code')->nullable();
            $table->string('country')->nullable();
            $table->timestamps();
        });

        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('project_number')->nullable()->unique();
            $table->string('name');
            $table->foreignId('customer_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('service_type')->nullable();
            $table->string('status')->default('lead');
            $table->string('priority')->default('normal');
            $table->string('site_address_line_1')->nullable();
            $table->string('site_address_line_2')->nullable();
            $table->string('site_city')->nullable();
            $table->string('site_state')->nullable();
            $table->string('site_postal_code')->nullable();
            $table->string('site_country')->nullable();
            $table->date('estimated_start_date')->nullable();
            $table->date('estimated_end_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->decimal('budget_amount', 12, 2)->nullable();
            $table->text('public_notes')->nullable();
            $table->text('internal_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
    }
};

