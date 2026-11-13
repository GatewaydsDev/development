<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_markers', function (Blueprint $table) {
            $table->decimal('x2', 10, 6)->nullable()->after('y');
            $table->decimal('y2', 10, 6)->nullable()->after('x2');
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_markers', function (Blueprint $table) {
            $table->dropColumn(['x2', 'y2']);
        });
    }
};
