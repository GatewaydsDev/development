<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->json('permission_overrides')->nullable()->after('level_id');
            $table->json('mobile_permission_overrides')->nullable()->after('permission_overrides');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['permission_overrides', 'mobile_permission_overrides']);
        });
    }
};
