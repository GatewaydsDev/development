<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_sections', function (Blueprint $table) {
            $table->json('opening_ids')->nullable()->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_sections', function (Blueprint $table) {
            $table->dropColumn('opening_ids');
        });
    }
};
