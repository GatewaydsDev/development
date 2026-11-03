<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users', 'id', 'push_subscriptions_user_fk')->cascadeOnDelete();
            $table->string('endpoint_hash', 64)->unique('push_subscriptions_endpoint_uq');
            $table->text('endpoint');
            $table->string('public_key');
            $table->string('auth_token');
            $table->string('content_encoding', 20)->default('aesgcm');
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
