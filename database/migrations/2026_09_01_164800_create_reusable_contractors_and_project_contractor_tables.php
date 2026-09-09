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
        Schema::create('contractors', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->string('contact_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone_number')->nullable();
            $table->timestamps();
        });

        Schema::create('project_contractor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contractor_id')->constrained()->restrictOnDelete();
            $table->timestamps();

            $table->unique(['project_id', 'contractor_id']);
        });

        if (Schema::hasTable('general_contractors')) {
            $contractorsByName = [];

            DB::table('general_contractors')
                ->orderBy('id')
                ->get()
                ->each(function (object $contractor) use (&$contractorsByName): void {
                    $name = trim((string) $contractor->name);

                    if ($name === '') {
                        return;
                    }

                    $key = mb_strtolower($name);
                    $contractorId = $contractorsByName[$key] ?? null;

                    if ($contractorId === null) {
                        $contractorId = DB::table('contractors')->insertGetId([
                            'uuid' => (string) Str::uuid(),
                            'name' => $name,
                            'contact_name' => $contractor->contact_name,
                            'email' => $contractor->email,
                            'phone_number' => $contractor->phone_number,
                            'created_at' => $contractor->created_at,
                            'updated_at' => $contractor->updated_at,
                        ]);

                        $contractorsByName[$key] = $contractorId;
                    }

                    DB::table('project_contractor')->insert([
                        'project_id' => $contractor->project_id,
                        'contractor_id' => $contractorId,
                        'created_at' => $contractor->created_at,
                        'updated_at' => $contractor->updated_at,
                    ]);
                });

            Schema::drop('general_contractors');
        }
    }

    public function down(): void
    {
        Schema::create('general_contractors', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('contact_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone_number')->nullable();
            $table->timestamps();
        });

        DB::table('project_contractor')
            ->orderBy('id')
            ->get()
            ->each(function (object $pivot): void {
                $alreadyHasContractor = DB::table('general_contractors')
                    ->where('project_id', $pivot->project_id)
                    ->exists();

                if ($alreadyHasContractor) {
                    return;
                }

                $contractor = DB::table('contractors')->where('id', $pivot->contractor_id)->first();

                if (! $contractor) {
                    return;
                }

                DB::table('general_contractors')->insert([
                    'uuid' => (string) Str::uuid(),
                    'project_id' => $pivot->project_id,
                    'name' => $contractor->name,
                    'contact_name' => $contractor->contact_name,
                    'email' => $contractor->email,
                    'phone_number' => $contractor->phone_number,
                    'created_at' => $pivot->created_at,
                    'updated_at' => $pivot->updated_at,
                ]);
            });

        Schema::dropIfExists('project_contractor');
        Schema::dropIfExists('contractors');
    }
};
