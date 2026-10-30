<?php

use App\Models\ProjectPriority;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_priorities', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('slug')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $now = now();

        foreach (ProjectPriority::DEFAULTS as $priority) {
            DB::table('project_priorities')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $priority['name'],
                'slug' => $priority['slug'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        if (! Schema::hasTable('projects')) {
            return;
        }

        foreach (DB::table('projects')->distinct()->pluck('priority') as $priority) {
            $slug = trim((string) $priority);

            if ($slug === '' || DB::table('project_priorities')->where('slug', $slug)->exists()) {
                continue;
            }

            $name = Str::of($slug)->replace('_', ' ')->title()->toString();

            DB::table('project_priorities')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'slug' => $slug,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('project_priorities');
    }
};
