<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotation_revision_reviews', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quotation_revision_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sent_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('recipient_email');
            $table->string('sender_mailbox');
            $table->text('message')->nullable();
            $table->timestamp('sent_at');
            $table->timestamps();

            $table->index(['quotation_revision_id', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotation_revision_reviews');
    }
};
