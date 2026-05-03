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
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['level_id']);
        });

        if (Schema::hasTable('levels') && ! Schema::hasTable('user_levels')) {
            Schema::rename('levels', 'user_levels');
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

        DB::table('languages')
            ->whereNull('uuid')
            ->orderBy('id')
            ->get()
            ->each(fn (object $language) => DB::table('languages')
                ->where('id', $language->id)
                ->update(['uuid' => (string) Str::uuid()]));

        DB::table('user_levels')
            ->whereNull('uuid')
            ->orderBy('id')
            ->get()
            ->each(fn (object $level) => DB::table('user_levels')
                ->where('id', $level->id)
                ->update(['uuid' => (string) Str::uuid()]));

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

        Schema::table('languages', function (Blueprint $table) {
            if (Schema::hasColumn('languages', 'code')) {
                $table->dropUnique('languages_code_unique');
                $table->dropColumn('code');
            }
        });

        Schema::table('user_levels', function (Blueprint $table) {
            if (Schema::hasColumn('user_levels', 'code')) {
                $table->dropUnique('levels_code_unique');
                $table->dropColumn('code');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('level_id')
                ->references('id')
                ->on('user_levels')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['level_id']);
        });

        Schema::table('languages', function (Blueprint $table) {
            if (! Schema::hasColumn('languages', 'code')) {
                $table->string('code')->nullable()->unique()->after('name');
            }
        });

        if (
            Schema::hasColumn('languages', 'code') &&
            Schema::hasColumn('languages', 'abbreviation')
        ) {
            DB::table('languages')
                ->whereNull('code')
                ->orderBy('id')
                ->get()
                ->each(fn (object $language) => DB::table('languages')
                    ->where('id', $language->id)
                    ->update(['code' => $language->abbreviation]));
        }

        Schema::table('languages', function (Blueprint $table) {
            if (Schema::hasColumn('languages', 'abbreviation')) {
                $table->dropUnique('languages_abbreviation_unique');
                $table->dropColumn('abbreviation');
            }

            if (Schema::hasColumn('languages', 'uuid')) {
                $table->dropUnique('languages_uuid_unique');
                $table->dropColumn('uuid');
            }
        });

        Schema::table('user_levels', function (Blueprint $table) {
            if (! Schema::hasColumn('user_levels', 'code')) {
                $table->string('code')->nullable()->unique()->after('name');
            }

            if (Schema::hasColumn('user_levels', 'uuid')) {
                $table->dropUnique('user_levels_uuid_unique');
                $table->dropColumn('uuid');
            }
        });

        if (Schema::hasTable('user_levels') && ! Schema::hasTable('levels')) {
            Schema::rename('user_levels', 'levels');
        }

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('level_id')
                ->references('id')
                ->on('levels')
                ->nullOnDelete();
        });
    }
};
