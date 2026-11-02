<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('login_block_logs', function (Blueprint $table) {
            $table->text('reason')->nullable()->after('blocked_by');
            $table->text('release_reason')->nullable()->after('release_method');
        });
    }

    public function down(): void
    {
        Schema::table('login_block_logs', function (Blueprint $table) {
            $table->dropColumn(['reason', 'release_reason']);
        });
    }
};
