<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_markers', function (Blueprint $table) {
            $table->decimal('label_x', 10, 6)->nullable()->after('y');
            $table->decimal('label_y', 10, 6)->nullable()->after('label_x');
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_markers', function (Blueprint $table) {
            $table->dropColumn(['label_x', 'label_y']);
        });
    }
};
