<?php

use App\Models\JobTitle;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_titles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::table('employees', function (Blueprint $table) {
            // SQLite cannot rebuild employees while views reference it, so skip the FK there.
            if (DB::getDriverName() === 'sqlite') {
                $table->unsignedBigInteger('job_title_id')->nullable();

                return;
            }

            $table->foreignId('job_title_id')
                ->nullable()
                ->after('job_title')
                ->constrained('job_titles')
                ->nullOnDelete();
        });

        DB::table('employees')
            ->whereNotNull('job_title')
            ->where('job_title', '!=', '')
            ->select('id', 'job_title')
            ->orderBy('id')
            ->each(function ($employee): void {
                $name = trim($employee->job_title);
                $jobTitle = JobTitle::query()->firstOrCreate(['name' => $name]);

                DB::table('employees')
                    ->where('id', $employee->id)
                    ->update(['job_title_id' => $jobTitle->id]);
            });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            if (DB::getDriverName() === 'sqlite') {
                $table->dropColumn('job_title_id');

                return;
            }

            $table->dropConstrainedForeignId('job_title_id');
        });

        Schema::dropIfExists('job_titles');
    }
};
