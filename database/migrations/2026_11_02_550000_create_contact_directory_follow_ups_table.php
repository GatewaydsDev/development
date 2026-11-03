<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_directory_follow_ups', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('contact_id')->constrained('contact_directory_contacts')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('inquiry_id')->nullable()->constrained('contact_directory_inquiries')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignId('assigned_user_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->timestamp('due_at');
            $table->timestamp('reminder_at')->nullable();
            $table->string('priority')->default('normal');
            $table->string('status')->default('pending');
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('snoozed_reason')->nullable();
            $table->timestamp('snoozed_until')->nullable();
            $table->timestamp('reminder_last_notified_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['assigned_user_id', 'status', 'due_at']);
            $table->index(['inquiry_id', 'status']);
            $table->index('reminder_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_directory_follow_ups');
    }
};
