<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_attendance_days', function (Blueprint $table): void {
            $table->unsignedBigInteger('employee_work_schedule_id')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('employee_attendance_days', function (Blueprint $table): void {
            $table->dropColumn('employee_work_schedule_id');
        });
    }
};
