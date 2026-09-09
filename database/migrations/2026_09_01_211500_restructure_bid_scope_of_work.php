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
        Schema::create('bid_scope_titles', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $titleIdsByOldId = [];
        $now = now();

        if (Schema::hasTable('bid_scopes')) {
            foreach (DB::table('bid_scopes')->orderBy('id')->get() as $scope) {
                $name = trim((string) $scope->name);

                if ($name === '') {
                    continue;
                }

                $existingId = DB::table('bid_scope_titles')
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                    ->value('id');

                if ($existingId) {
                    $titleIdsByOldId[$scope->id] = $existingId;
                    continue;
                }

                $titleId = DB::table('bid_scope_titles')->insertGetId([
                    'uuid' => $scope->uuid ?: (string) Str::uuid(),
                    'name' => $name,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $titleIdsByOldId[$scope->id] = $titleId;
            }
        }

        $assigned = Schema::hasTable('bid_scope')
            ? DB::table('bid_scope')->orderBy('id')->get()
            : collect();

        Schema::dropIfExists('bid_scope');
        Schema::dropIfExists('bid_scopes');

        Schema::create('bid_scopes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bid_scope_title_id')->constrained('bid_scope_titles')->restrictOnDelete();
            $table->text('notations')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('bid_scope_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_scope_id')->constrained('bid_scopes')->cascadeOnDelete();
            $table->string('description');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $sortByBid = [];

        foreach ($assigned as $row) {
            $titleId = $titleIdsByOldId[$row->bid_scope_id] ?? null;

            if (! $titleId) {
                continue;
            }

            $sortByBid[$row->bid_id] = ($sortByBid[$row->bid_id] ?? -1) + 1;

            DB::table('bid_scopes')->insert([
                'bid_id' => $row->bid_id,
                'bid_scope_title_id' => $titleId,
                'notations' => null,
                'sort_order' => $sortByBid[$row->bid_id],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        $titles = DB::table('bid_scope_titles')->orderBy('id')->get();
        $entries = Schema::hasTable('bid_scopes')
            ? DB::table('bid_scopes')->orderBy('id')->get()
            : collect();

        Schema::dropIfExists('bid_scope_products');
        Schema::dropIfExists('bid_scopes');

        Schema::create('bid_scopes', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('bid_scope', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bid_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bid_scope_id')->constrained('bid_scopes')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['bid_id', 'bid_scope_id']);
        });

        $now = now();
        $catalogIdsByTitleId = [];

        foreach ($titles as $title) {
            $catalogIdsByTitleId[$title->id] = DB::table('bid_scopes')->insertGetId([
                'uuid' => $title->uuid ?: (string) Str::uuid(),
                'name' => $title->name,
                'description' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ($entries as $entry) {
            $catalogId = $catalogIdsByTitleId[$entry->bid_scope_title_id] ?? null;

            if (! $catalogId) {
                continue;
            }

            $alreadyLinked = DB::table('bid_scope')
                ->where('bid_id', $entry->bid_id)
                ->where('bid_scope_id', $catalogId)
                ->exists();

            if ($alreadyLinked) {
                continue;
            }

            DB::table('bid_scope')->insert([
                'bid_id' => $entry->bid_id,
                'bid_scope_id' => $catalogId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::dropIfExists('bid_scope_titles');
    }
};
