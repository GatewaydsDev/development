<?php

use App\Models\ProjectStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_statuses', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('slug')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $now = now();
        $idsBySlug = [];

        foreach (ProjectStatus::DEFAULTS as $status) {
            $idsBySlug[$status['slug']] = DB::table('project_statuses')->insertGetId([
                'uuid' => (string) Str::uuid(),
                'name' => $status['name'],
                'slug' => $status['slug'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('project_status_id')
                ->nullable()
                ->after('status')
                ->constrained('project_statuses')
                ->restrictOnDelete();
        });

        $leadId = $idsBySlug['lead'] ?? null;

        foreach (DB::table('projects')->get(['id', 'status']) as $project) {
            $legacyStatus = (string) $project->status;
            $statusId = $idsBySlug[$legacyStatus] ?? null;

            if ($statusId === null && $legacyStatus !== '') {
                $name = Str::of($legacyStatus)->replace('_', ' ')->title()->toString();
                $existing = DB::table('project_statuses')
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                    ->first();

                if ($existing) {
                    $statusId = $existing->id;
                } else {
                    $slug = Str::slug($legacyStatus, '_') ?: 'status';
                    $uniqueSlug = $slug;
                    $suffix = 2;

                    while (DB::table('project_statuses')->where('slug', $uniqueSlug)->exists()) {
                        $uniqueSlug = "{$slug}_{$suffix}";
                        $suffix++;
                    }

                    $statusId = DB::table('project_statuses')->insertGetId([
                        'uuid' => (string) Str::uuid(),
                        'name' => $name,
                        'slug' => $uniqueSlug,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }

                $idsBySlug[$legacyStatus] = $statusId;
            }

            DB::table('projects')
                ->where('id', $project->id)
                ->update([
                    'project_status_id' => $statusId ?: $leadId,
                ]);
        }

        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('status')->default('lead')->after('service_type');
        });

        $slugs = DB::table('project_statuses')->pluck('slug', 'id');

        foreach (DB::table('projects')->get(['id', 'project_status_id']) as $project) {
            DB::table('projects')
                ->where('id', $project->id)
                ->update([
                    'status' => $slugs[$project->project_status_id] ?? 'lead',
                ]);
        }

        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('project_status_id');
        });

        Schema::dropIfExists('project_statuses');
    }
};
