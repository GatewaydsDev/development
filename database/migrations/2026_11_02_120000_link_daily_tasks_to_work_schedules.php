<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_task_work_schedule', function (Blueprint $table) {
            $table->id();
            $table->foreignId('daily_task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_work_schedule_id')
                ->constrained('employee_work_schedules', 'id', 'dtws_schedule_fk')
                ->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['daily_task_id', 'employee_work_schedule_id'], 'dtws_unique');
        });

        Schema::table('daily_task_completions', function (Blueprint $table) {
            $table->foreignId('employee_work_schedule_id')
                ->nullable()
                ->constrained('employee_work_schedules', 'id', 'dtc_schedule_fk')
                ->cascadeOnDelete();
            $table->string('status', 20)->default('completed');
            $table->unsignedTinyInteger('progress')->default(100);
            $table->text('notes')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamp('completed_at')->nullable()->change();
        });

        // The new unique key keeps daily_task_id as its first column, so it can back the foreign key.
        Schema::table('daily_task_completions', function (Blueprint $table) {
            $table->unique(
                ['daily_task_id', 'user_id', 'work_date', 'employee_work_schedule_id'],
                'dtc_task_user_date_schedule_unique',
            );
            $table->dropUnique('daily_task_completion_unique');
        });

        Schema::create('daily_task_photos', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('daily_task_completion_id')
                ->constrained('daily_task_completions', 'id', 'dtp_completion_fk')
                ->cascadeOnDelete();
            $table->string('path');
            $table->string('original_name')->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->unsignedInteger('size')->default(0);
            $table->string('caption')->nullable();
            $table->timestamp('taken_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_task_photos');

        Schema::table('daily_task_completions', function (Blueprint $table) {
            $table->dropUnique('dtc_task_user_date_schedule_unique');
            $table->unique(['daily_task_id', 'user_id', 'work_date'], 'daily_task_completion_unique');
            $table->dropConstrainedForeignId('employee_work_schedule_id');
            $table->dropColumn(['status', 'progress', 'notes', 'latitude', 'longitude']);
        });

        Schema::dropIfExists('daily_task_work_schedule');
    }
};
