<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_controls', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('uuid')->constrained()->nullOnDelete();
        });

        Schema::table('project_control_openings', function (Blueprint $table) {
            $table->foreignId('takeoff_opening_id')->nullable()->after('project_control_id')->constrained('takeoff_openings')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_control_openings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('takeoff_opening_id');
        });

        Schema::table('project_controls', function (Blueprint $table) {
            $table->dropConstrainedForeignId('project_id');
        });
    }
};
