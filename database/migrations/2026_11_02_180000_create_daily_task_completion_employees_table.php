<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_task_completion_employees', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('daily_task_completion_id');
            $table->unsignedBigInteger('employee_id');
            $table->timestamps();

            $table->unique(['daily_task_completion_id', 'employee_id'], 'completion_employee_unique');
        });

        DB::table('daily_task_completions')->whereNotNull('performed_by_employee_id')->get()
            ->each(fn ($row) => DB::table('daily_task_completion_employees')->insert([
                'daily_task_completion_id' => $row->id,
                'employee_id' => $row->performed_by_employee_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]));
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_task_completion_employees');
    }
};
