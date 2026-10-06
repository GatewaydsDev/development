<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_work_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->date('work_date');
            $table->foreignId('foreman_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'work_date'], 'employee_work_schedules_project_date_unique');
        });

        Schema::create('work_schedule_employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_work_schedule_id')
                ->constrained('employee_work_schedules', 'id', 'ws_crew_schedule_fk')
                ->cascadeOnDelete();
            $table->foreignId('employee_id')
                ->constrained('employees', 'id', 'ws_crew_employee_fk')
                ->cascadeOnDelete();
            $table->timestamps();

            $table->unique(
                ['employee_work_schedule_id', 'employee_id'],
                'schedule_employee_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_schedule_employees');
        Schema::dropIfExists('employee_work_schedules');
    }
};
