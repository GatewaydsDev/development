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
        Schema::create('system_updates', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('title');
            $table->text('summary')->nullable();
            $table->string('category', 30)->default('Feature');
            $table->date('released_on')->index();
            $table->json('details')->nullable();
            $table->json('commits')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('system_update_levels', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('system_update_id');
            $table->unsignedBigInteger('user_level_id');
            $table->timestamps();

            $table->unique(['system_update_id', 'user_level_id']);
        });

        $this->seed();
    }

    public function down(): void
    {
        Schema::dropIfExists('system_update_levels');
        Schema::dropIfExists('system_updates');
    }

    private function seed(): void
    {
        $updates = base_path('database/data/system_updates.json');
        $commits = base_path('database/data/system_update_commits.json');

        if (! is_file($updates)) {
            return;
        }

        $entries = json_decode((string) file_get_contents($updates), true) ?: [];
        $byTheme = is_file($commits) ? (json_decode((string) file_get_contents($commits), true) ?: []) : [];

        foreach ($entries as $entry) {
            DB::table('system_updates')->insert([
                'uuid' => (string) Str::uuid(),
                'title' => $entry['title'],
                'summary' => $entry['summary'] ?? null,
                'category' => $entry['category'] ?? 'Feature',
                'released_on' => $entry['released_on'],
                'details' => json_encode($entry['details'] ?? []),
                'commits' => json_encode($byTheme[$entry['theme'] ?? ''] ?? []),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
};
