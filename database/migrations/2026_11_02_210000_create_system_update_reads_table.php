<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_update_reads', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('system_update_id');
            $table->timestamp('read_at')->nullable();
            $table->unique(['user_id', 'system_update_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_update_reads');
    }
};
