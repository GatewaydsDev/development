<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quality_control_reports', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('employee_work_schedule_id')
                ->constrained('employee_work_schedules', 'id', 'qcr_schedule_fk')
                ->cascadeOnDelete();
            $table->foreignId('daily_task_id')
                ->constrained('daily_tasks', 'id', 'qcr_task_fk')
                ->cascadeOnDelete();
            $table->foreignId('daily_task_completion_id')
                ->nullable()
                ->constrained('daily_task_completions', 'id', 'qcr_completion_fk')
                ->nullOnDelete();
            $table->foreignId('inspector_user_id')
                ->nullable()
                ->constrained('users', 'id', 'qcr_inspector_fk')
                ->nullOnDelete();
            $table->date('inspected_on');
            $table->string('result', 20);
            $table->json('checklist')->nullable();
            $table->text('notes')->nullable();
            $table->text('corrective_action')->nullable();
            $table->timestamps();

            $table->index(['employee_work_schedule_id', 'daily_task_id'], 'qcr_schedule_task_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quality_control_reports');
    }
};
