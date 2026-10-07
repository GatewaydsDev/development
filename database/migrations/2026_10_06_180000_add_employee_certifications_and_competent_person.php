<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_certifications', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_competent_person')->default(false);
            $table->date('issued_on')->nullable();
            $table->date('expires_on')->nullable();
            $table->timestamps();
        });

        Schema::table('employee_work_schedules', function (Blueprint $table) {
            $table->boolean('requires_competent_person')->default(false);
            $table->foreignId('competent_person_employee_id')
                ->nullable()
                ->constrained('employees', 'id', 'sched_competent_employee_fk')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('employee_work_schedules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('competent_person_employee_id');
            $table->dropColumn('requires_competent_person');
        });

        Schema::dropIfExists('employee_certifications');
    }
};
