<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_login_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users', 'id', 'user_login_logs_user_fk')->nullOnDelete();
            $table->string('event', 10);
            $table->string('guard', 20)->nullable();
            $table->string('device_type', 20)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('country', 100)->nullable();
            $table->string('region', 100)->nullable();
            $table->string('city', 100)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at'], 'user_login_logs_user_created_idx');
            $table->index('created_at', 'user_login_logs_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_login_logs');
    }
};
