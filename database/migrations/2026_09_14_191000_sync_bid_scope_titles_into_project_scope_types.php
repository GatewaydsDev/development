<?php

use App\Models\ProjectScopeType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('bid_scope_titles') || ! Schema::hasTable('project_scope_types')) {
            return;
        }

        $existing = DB::table('project_scope_types')
            ->pluck('name')
            ->map(fn ($name): string => mb_strtolower((string) $name))
            ->all();

        $now = now();

        foreach (DB::table('bid_scope_titles')->orderBy('id')->get() as $title) {
            $name = trim((string) $title->name);

            if ($name === '' || in_array(mb_strtolower($name), $existing, true)) {
                continue;
            }

            DB::table('project_scope_types')->insert([
                'uuid' => (string) Str::uuid(),
                'slug' => ProjectScopeType::uniqueSlug($name),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $existing[] = mb_strtolower($name);
        }
    }

    public function down(): void
    {
        // Shared catalog rows are kept; bids still store their own title names.
    }
};
