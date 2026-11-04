<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SQLite would rebuild the table and break the views that read from it.
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('ALTER TABLE work_schedule_employees ADD COLUMN skill_id integer NULL REFERENCES skills(id) ON DELETE SET NULL');
            DB::statement('ALTER TABLE work_schedule_employees ADD COLUMN employee_pay_rate_id integer NULL REFERENCES employee_pay_rates(id) ON DELETE SET NULL');

            return;
        }

        Schema::table('work_schedule_employees', function (Blueprint $table): void {
            $table->foreignId('skill_id')->nullable()->after('employee_id')->constrained('skills')->nullOnDelete();
            $table->foreignId('employee_pay_rate_id')->nullable()->after('skill_id')->constrained('employee_pay_rates')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('work_schedule_employees', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('employee_pay_rate_id');
            $table->dropConstrainedForeignId('skill_id');
        });
    }
};
