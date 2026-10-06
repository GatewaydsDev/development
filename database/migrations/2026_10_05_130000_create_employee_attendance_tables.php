<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_attendance_weeks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('week_start');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'week_start'], 'employee_attendance_weeks_employee_week_unique');
        });

        Schema::create('employee_attendance_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_attendance_week_id')->constrained()->cascadeOnDelete();
            $table->date('work_date');
            $table->foreignId('profession_id')->constrained()->restrictOnDelete();
            $table->foreignId('employee_pay_rate_id')->nullable()->constrained('employee_pay_rates')->nullOnDelete();
            $table->string('rate_type');
            $table->string('custom_rate_type')->nullable();
            $table->decimal('amount', 10, 2);
            $table->boolean('scheduled')->default(false);
            $table->boolean('worked')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(
                ['employee_attendance_week_id', 'work_date'],
                'employee_attendance_days_week_date_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_attendance_days');
        Schema::dropIfExists('employee_attendance_weeks');
    }
};
