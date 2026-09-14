<?php

use App\Models\ProjectScopeType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_scope_types', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('slug')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $now = now();

        foreach (ProjectScopeType::DEFAULTS as $type) {
            DB::table('project_scope_types')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $type['name'],
                'slug' => $type['slug'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        if (Schema::hasTable('project_scopes')) {
            $existingSlugs = DB::table('project_scope_types')->pluck('slug')->all();

            foreach (DB::table('project_scopes')->distinct()->pluck('scope_type') as $scopeType) {
                $slug = trim((string) $scopeType);

                if ($slug === '' || in_array($slug, $existingSlugs, true)) {
                    continue;
                }

                $name = Str::of($slug)->replace('_', ' ')->title()->toString();
                $uniqueSlug = $slug;
                $suffix = 2;

                while (DB::table('project_scope_types')->where('slug', $uniqueSlug)->exists()) {
                    $uniqueSlug = "{$slug}_{$suffix}";
                    $suffix++;
                }

                DB::table('project_scope_types')->insert([
                    'uuid' => (string) Str::uuid(),
                    'name' => $name,
                    'slug' => $uniqueSlug,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $existingSlugs[] = $uniqueSlug;
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('project_scope_types');
    }
};
