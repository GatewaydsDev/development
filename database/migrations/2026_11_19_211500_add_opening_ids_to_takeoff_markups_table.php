<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_markups', function (Blueprint $table) {
            $table->json('opening_ids')->nullable()->after('label');
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_markups', function (Blueprint $table) {
            $table->dropColumn('opening_ids');
        });
    }
};
