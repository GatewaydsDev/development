<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quality_control_reports', function (Blueprint $table): void {
            $table->json('fail_reasons')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('quality_control_reports', function (Blueprint $table): void {
            $table->dropColumn('fail_reasons');
        });
    }
};
