<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('internal_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body')->nullable();
            $table->timestamps();

            $table->index(['id', 'user_id']);
        });

        Schema::create('internal_message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('internal_message_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->string('mime', 120);
            $table->unsignedInteger('size');
            $table->boolean('is_image')->default(false);
            $table->timestamps();
        });

        Schema::create('internal_message_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('last_read_message_id')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('internal_message_reads');
        Schema::dropIfExists('internal_message_attachments');
        Schema::dropIfExists('internal_messages');
    }
};
