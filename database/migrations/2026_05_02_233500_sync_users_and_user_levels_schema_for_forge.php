<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('levels') && ! Schema::hasTable('user_levels')) {
            Schema::rename('levels', 'user_levels');
        }

        if (! Schema::hasTable('languages')) {
            Schema::create('languages', function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->string('name')->unique();
                $table->string('abbreviation')->unique();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('user_levels')) {
            Schema::create('user_levels', function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->string('name')->unique();
                $table->timestamps();
            });
        }

        Schema::table('languages', function (Blueprint $table) {
            if (! Schema::hasColumn('languages', 'uuid')) {
                $table->uuid('uuid')->nullable()->unique()->after('id');
            }

            if (! Schema::hasColumn('languages', 'abbreviation')) {
                $table->string('abbreviation')->nullable()->unique()->after('name');
            }
        });

        Schema::table('user_levels', function (Blueprint $table) {
            if (! Schema::hasColumn('user_levels', 'uuid')) {
                $table->uuid('uuid')->nullable()->unique()->after('id');
            }
        });

        $this->fillMissingUuids('languages');
        $this->fillMissingUuids('user_levels');
        $this->seedUserLevels();

        if (
            Schema::hasColumn('languages', 'code') &&
            Schema::hasColumn('languages', 'abbreviation')
        ) {
            DB::table('languages')
                ->whereNull('abbreviation')
                ->orderBy('id')
                ->get()
                ->each(fn (object $language) => DB::table('languages')
                    ->where('id', $language->id)
                    ->update(['abbreviation' => $language->code]));
        }

        if (Schema::hasColumn('languages', 'code')) {
            Schema::table('languages', function (Blueprint $table) {
                $table->dropUnique('languages_code_unique');
                $table->dropColumn('code');
            });
        }

        if (Schema::hasColumn('user_levels', 'code')) {
            Schema::table('user_levels', function (Blueprint $table) {
                $table->dropUnique('levels_code_unique');
                $table->dropColumn('code');
            });
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'role')) {
                $table->string('role')->default('viewer')->after('email');
            }

            if (! Schema::hasColumn('users', 'language_id')) {
                $table->foreignId('language_id')->nullable()->after('role');
            }

            if (! Schema::hasColumn('users', 'level_id')) {
                $table->foreignId('level_id')->nullable()->after('language_id');
            }
        });

        $this->addForeignKeyIfMissing(
            'users',
            'users_language_id_foreign',
            'language_id',
            'languages',
        );

        $this->addForeignKeyIfMissing(
            'users',
            'users_level_id_foreign',
            'level_id',
            'user_levels',
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This migration is intentionally forward-only for Forge safety.
    }

    private function fillMissingUuids(string $table): void
    {
        if (! Schema::hasColumn($table, 'uuid')) {
            return;
        }

        DB::table($table)
            ->whereNull('uuid')
            ->orderBy('id')
            ->get()
            ->each(fn (object $record) => DB::table($table)
                ->where('id', $record->id)
                ->update(['uuid' => (string) Str::uuid()]));
    }

    private function seedUserLevels(): void
    {
        collect([
            'Super Administrator',
            'Administrator',
            'Project Manager',
            'User',
            'Visitor',
        ])->each(function (string $name): void {
            $existingLevel = DB::table('user_levels')
                ->where('name', $name)
                ->first();

            if ($existingLevel) {
                DB::table('user_levels')
                    ->where('id', $existingLevel->id)
                    ->update(['updated_at' => now()]);

                return;
            }

            DB::table('user_levels')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
    }

    private function addForeignKeyIfMissing(
        string $table,
        string $foreignKey,
        string $column,
        string $references
    ): void {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        $database = DB::getDatabaseName();
        $exists = DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('TABLE_SCHEMA', $database)
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $foreignKey)
            ->exists();

        if ($exists) {
            return;
        }

        Schema::table($table, function (Blueprint $table) use (
            $column,
            $foreignKey,
            $references
        ) {
            $table->foreign($column, $foreignKey)
                ->references('id')
                ->on($references)
                ->nullOnDelete();
        });
    }
};
