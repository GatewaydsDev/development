<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_control_reminders', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_control_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('remind_at')->index();
            $table->text('note')->nullable();
            $table->boolean('notify_popup')->default(true);
            $table->boolean('notify_email')->default(false);
            $table->timestamp('popup_sent_at')->nullable();
            $table->timestamp('email_sent_at')->nullable();
            $table->unsignedTinyInteger('email_attempts')->default(0);
            $table->string('email_error')->nullable();
            $table->timestamp('dismissed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_control_reminders');
    }
};
