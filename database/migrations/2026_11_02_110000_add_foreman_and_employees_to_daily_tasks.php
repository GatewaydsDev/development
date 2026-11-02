<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_tasks', function (Blueprint $table) {
            $table->foreignId('foreman_user_id')
                ->nullable()
                ->after('is_active')
                ->constrained('users')
                ->nullOnDelete();
        });

        Schema::create('daily_task_employee', function (Blueprint $table) {
            $table->id();
            $table->foreignId('daily_task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['daily_task_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_task_employee');

        Schema::table('daily_tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('foreman_user_id');
        });
    }
};
