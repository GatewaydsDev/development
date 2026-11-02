<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_block_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('name');
            $table->string('email');
            $table->unsignedSmallInteger('attempts')->default(3);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->unsignedSmallInteger('emails_sent')->default(0);
            $table->timestamp('blocked_at');
            $table->timestamp('released_at')->nullable();
            $table->string('released_by')->nullable();
            $table->string('release_method', 30)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_block_logs');
    }
};
