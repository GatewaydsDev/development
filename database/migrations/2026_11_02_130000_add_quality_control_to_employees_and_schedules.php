<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table): void {
            $table->boolean('is_quality_control')->default(false);
        });

        Schema::table('employee_work_schedules', function (Blueprint $table): void {
            $table->unsignedBigInteger('quality_control_employee_id')->nullable();
        });

        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('employee_work_schedules', function (Blueprint $table): void {
                $table->foreign('quality_control_employee_id')
                    ->references('id')->on('employees')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('employee_work_schedules', function (Blueprint $table): void {
                $table->dropForeign(['quality_control_employee_id']);
            });
        }

        Schema::table('employee_work_schedules', function (Blueprint $table): void {
            $table->dropColumn('quality_control_employee_id');
        });

        Schema::table('employees', function (Blueprint $table): void {
            $table->dropColumn('is_quality_control');
        });
    }
};
