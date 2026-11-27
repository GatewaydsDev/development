<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_bid_dates', function (Blueprint $table) {
            $table->time('bid_time')->nullable()->after('bid_date');
        });
    }

    public function down(): void
    {
        Schema::table('project_bid_dates', function (Blueprint $table) {
            $table->dropColumn('bid_time');
        });
    }
};
