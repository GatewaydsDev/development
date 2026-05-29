<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_submission_contact', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_submission_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->timestamp('emailed_at')->nullable();
            $table->timestamps();

            $table->unique(['contact_submission_id', 'contact_id'], 'csc_submission_contact_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_submission_contact');
    }
};
