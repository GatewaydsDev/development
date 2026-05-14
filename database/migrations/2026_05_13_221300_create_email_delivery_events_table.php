<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_delivery_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('postmark');
            $table->string('event_type')->nullable()->index();
            $table->string('recipient')->nullable()->index();
            $table->string('message_id')->nullable()->index();
            $table->string('tag')->nullable()->index();
            $table->json('metadata')->nullable();
            $table->json('payload');
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_delivery_events');
    }
};
