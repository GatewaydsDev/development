<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('user_levels', 'mobile_permissions')) {
            Schema::table('user_levels', function (Blueprint $table): void {
                $table->json('mobile_permissions')->nullable()->after('permissions');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('user_levels', 'mobile_permissions')) {
            Schema::table('user_levels', function (Blueprint $table): void {
                $table->dropColumn('mobile_permissions');
            });
        }
    }
};
