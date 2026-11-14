<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_directory_inquiries', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('contact_id')->constrained('contact_directory_contacts')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('price_request_id')->nullable()->constrained('contact_directory_price_requests')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('priority')->default('normal');
            $table->string('status')->default('draft');
            $table->string('waiting_on')->nullable();
            $table->foreignId('waiting_on_user_id')->nullable()->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->timestamp('waiting_since')->nullable();
            $table->date('expected_response_date')->nullable();
            $table->text('waiting_explanation')->nullable();
            $table->date('requested_date')->nullable();
            $table->date('response_due_date')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->string('supplier_reference_number')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'response_due_date']);
            $table->index(['contact_id', 'status']);
            $table->index('price_request_id');
            $table->index('assigned_user_id');
            $table->index('waiting_on');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_directory_inquiries');
    }
};
