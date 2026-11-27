<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_openings', function (Blueprint $table) {
            $table->string('building_name')->nullable()->after('location');
            $table->decimal('frame_width', 12, 3)->nullable()->after('frame_type');
            $table->decimal('frame_height', 12, 3)->nullable()->after('frame_width');
            $table->decimal('frame_depth', 12, 3)->nullable()->after('frame_height');
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_openings', function (Blueprint $table) {
            $table->dropColumn(['building_name', 'frame_width', 'frame_height', 'frame_depth']);
        });
    }
};
