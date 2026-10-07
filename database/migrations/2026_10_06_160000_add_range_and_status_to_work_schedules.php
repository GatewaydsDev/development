<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('employee_work_schedules', 'starts_on')) {
            Schema::table('employee_work_schedules', function (Blueprint $table) {
                $table->date('starts_on')->nullable();
                $table->date('ends_on')->nullable();
                $table->string('status')->default('active');
            });
        }

        if (Schema::hasColumn('employee_work_schedules', 'work_date')) {
            DB::table('employee_work_schedules')->update([
                'starts_on' => DB::raw('work_date'),
                'ends_on' => DB::raw('work_date'),
            ]);
        }

        if (! Schema::hasIndex('employee_work_schedules', 'employee_work_schedules_project_id_index')) {
            Schema::table('employee_work_schedules', function (Blueprint $table) {
                $table->index('project_id', 'employee_work_schedules_project_id_index');
            });
        }

        if (Schema::hasIndex('employee_work_schedules', 'employee_work_schedules_project_date_unique')) {
            Schema::table('employee_work_schedules', function (Blueprint $table) {
                $table->dropUnique('employee_work_schedules_project_date_unique');
            });
        }

        if (Schema::hasColumn('employee_work_schedules', 'work_date')) {
            Schema::table('employee_work_schedules', function (Blueprint $table) {
                $table->dropColumn('work_date');
            });
        }
    }

    public function down(): void
    {
        Schema::table('employee_work_schedules', function (Blueprint $table) {
            $table->date('work_date')->nullable();
        });

        DB::table('employee_work_schedules')->update([
            'work_date' => DB::raw('starts_on'),
        ]);

        Schema::table('employee_work_schedules', function (Blueprint $table) {
            $table->dropColumn(['starts_on', 'ends_on', 'status']);
            $table->unique(['project_id', 'work_date'], 'employee_work_schedules_project_date_unique');
        });
    }
};
