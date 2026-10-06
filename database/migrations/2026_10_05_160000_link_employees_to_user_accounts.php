<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('ALTER TABLE employees ADD COLUMN user_id INTEGER NULL CONSTRAINT employees_user_id_foreign REFERENCES users(id) ON DELETE SET NULL');
            DB::statement('CREATE UNIQUE INDEX employees_user_id_unique ON employees (user_id)');

            return;
        }

        Schema::table('employees', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->nullable()
                ->unique()
                ->after('foreman_user_id')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('DROP VIEW IF EXISTS employee_attendance_listings');
            DB::statement('DROP INDEX IF EXISTS employees_user_id_unique');
            DB::statement('ALTER TABLE employees DROP COLUMN user_id');

            return;
        }

        Schema::table('employees', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
