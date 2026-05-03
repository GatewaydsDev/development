<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('languages', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->string('abbreviation')->unique();
            $table->timestamps();
        });

        Schema::create('user_levels', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('language_id')
                ->nullable()
                ->after('role')
                ->constrained()
                ->nullOnDelete();

            $table->foreignId('level_id')
                ->nullable()
                ->after('language_id')
                ->constrained('user_levels')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('level_id');
            $table->dropConstrainedForeignId('language_id');
        });

        Schema::dropIfExists('user_levels');
        Schema::dropIfExists('languages');
    }
};
