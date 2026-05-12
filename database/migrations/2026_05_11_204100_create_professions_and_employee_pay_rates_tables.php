<?php

use App\Models\Employee;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('professions', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('employee_pay_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('profession_id')->constrained()->restrictOnDelete();
            $table->string('rate_type');
            $table->string('custom_rate_type')->nullable();
            $table->decimal('amount', 10, 2);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Employee::query()
            ->whereNotNull('job_title')
            ->where('job_title', '!=', '')
            ->pluck('job_title')
            ->unique(fn (string $jobTitle): string => strtolower($jobTitle))
            ->each(function (string $jobTitle): void {
                DB::table('professions')->insertOrIgnore([
                    'name' => trim($jobTitle),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_pay_rates');
        Schema::dropIfExists('professions');
    }
};
