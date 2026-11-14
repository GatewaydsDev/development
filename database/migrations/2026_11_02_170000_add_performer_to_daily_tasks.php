<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_tasks', function (Blueprint $table) {
            $table->string('performed_by', 30)->default('anyone');
        });

        Schema::table('daily_task_completions', function (Blueprint $table) {
            $table->unsignedBigInteger('performed_by_employee_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('daily_task_completions', function (Blueprint $table) {
            $table->dropColumn('performed_by_employee_id');
        });

        Schema::table('daily_tasks', function (Blueprint $table) {
            $table->dropColumn('performed_by');
        });
    }
};
