<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('area_tested')->nullable()->after('thickness');
            $table->string('glazing_type')->nullable()->after('area_tested');
            $table->string('weight')->nullable()->after('glazing_type');
            $table->string('glass_type')->nullable()->after('weight');
            $table->string('seal')->nullable()->after('glass_type');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'area_tested',
                'glazing_type',
                'weight',
                'glass_type',
                'seal',
            ]);
        });
    }
};
