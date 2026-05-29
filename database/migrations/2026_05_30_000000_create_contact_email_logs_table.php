<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_email_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_submission_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('sent_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('recipient_name')->nullable();
            $table->string('recipient_email');
            $table->string('subject');
            $table->text('message')->nullable();
            $table->timestamps();

            $table->index(['contact_submission_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_email_logs');
    }
};
