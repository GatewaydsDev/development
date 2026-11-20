<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_markups', function (Blueprint $table) {
            $table->string('label', 80)->nullable()->after('color');
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_markups', function (Blueprint $table) {
            $table->dropColumn('label');
        });
    }
};
