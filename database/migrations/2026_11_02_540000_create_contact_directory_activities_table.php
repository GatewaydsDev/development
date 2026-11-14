<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_directory_activities', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('contact_id')->constrained('contact_directory_contacts')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('inquiry_id')->nullable()->constrained('contact_directory_inquiries')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('activity_type');
            $table->string('direction');
            $table->string('subject');
            $table->text('content')->nullable();
            $table->timestamp('occurred_at');
            $table->foreignId('created_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('mail_provider_message_id')->nullable();
            $table->string('mail_provider_status')->nullable();
            $table->json('mail_recipients')->nullable();
            $table->string('mail_sender')->nullable();
            $table->boolean('mail_delivered')->default(false);
            $table->timestamps();

            $table->index(['contact_id', 'occurred_at']);
            $table->index(['inquiry_id', 'occurred_at']);
            $table->unique('mail_provider_message_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_directory_activities');
    }
};
