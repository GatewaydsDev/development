<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certifications', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name');
            $table->boolean('is_competent_person')->default(false);
            $table->timestamps();
        });

        Schema::table('employee_certifications', function (Blueprint $table) {
            $table->foreignId('certification_id')
                ->nullable()
                ->after('employee_id')
                ->constrained('certifications')
                ->cascadeOnDelete();
        });

        $certificationIds = [];

        foreach (DB::table('employee_certifications')->orderBy('id')->get() as $row) {
            $name = trim((string) $row->name);
            $key = Str::lower($name);

            if (! isset($certificationIds[$key])) {
                $certificationIds[$key] = DB::table('certifications')->insertGetId([
                    'uuid' => (string) Str::uuid(),
                    'name' => $name,
                    'is_competent_person' => (bool) $row->is_competent_person,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } elseif ($row->is_competent_person) {
                DB::table('certifications')
                    ->where('id', $certificationIds[$key])
                    ->update(['is_competent_person' => true]);
            }

            DB::table('employee_certifications')
                ->where('id', $row->id)
                ->update(['certification_id' => $certificationIds[$key]]);
        }

        $keepers = DB::table('employee_certifications')
            ->selectRaw('MIN(id) as id')
            ->groupBy('employee_id', 'certification_id')
            ->pluck('id');

        DB::table('employee_certifications')
            ->whereNotIn('id', $keepers->all() ?: [0])
            ->delete();

        Schema::table('employee_certifications', function (Blueprint $table) {
            $table->dropColumn(['name', 'is_competent_person']);
            $table->unique(
                ['employee_id', 'certification_id'],
                'employee_certification_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('employee_certifications', function (Blueprint $table) {
            $table->dropUnique('employee_certification_unique');
            $table->string('name')->nullable();
            $table->boolean('is_competent_person')->default(false);
        });

        $names = DB::table('certifications')->pluck('name', 'id');
        $flags = DB::table('certifications')->pluck('is_competent_person', 'id');

        foreach (DB::table('employee_certifications')->orderBy('id')->get() as $row) {
            DB::table('employee_certifications')->where('id', $row->id)->update([
                'name' => $names[$row->certification_id] ?? 'Certification',
                'is_competent_person' => (bool) ($flags[$row->certification_id] ?? false),
            ]);
        }

        Schema::table('employee_certifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('certification_id');
        });

        Schema::dropIfExists('certifications');
    }
};
