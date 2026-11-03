<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contact_directory_follow_ups', function (Blueprint $table): void {
            $table->timestamp('reminder_dismissed_at')->nullable()->after('reminder_last_notified_at');
        });
    }

    public function down(): void
    {
        Schema::table('contact_directory_follow_ups', function (Blueprint $table): void {
            $table->dropColumn('reminder_dismissed_at');
        });
    }
};
