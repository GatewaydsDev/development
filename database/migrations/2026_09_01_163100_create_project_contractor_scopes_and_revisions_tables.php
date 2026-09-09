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

        Schema::create('project_scopes', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('scope_type');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'scope_type']);
        });

        Schema::create('project_revisions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('number');
            $table->date('revision_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'number']);
        });

        DB::table('projects')
            ->whereNotNull('service_type')
            ->where('service_type', '!=', '')
            ->orderBy('id')
            ->get(['id', 'service_type', 'created_at', 'updated_at'])
            ->each(function (object $project): void {
                DB::table('project_scopes')->insert([
                    'uuid' => (string) Str::uuid(),
                    'project_id' => $project->id,
                    'scope_type' => $project->service_type,
                    'notes' => null,
                    'created_at' => $project->created_at,
                    'updated_at' => $project->updated_at,
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_revisions');
        Schema::dropIfExists('project_scopes');
        Schema::dropIfExists('general_contractors');
    }
};
