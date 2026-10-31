<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_control_reminders', function (Blueprint $table): void {
            $table->string('recipient_email')->nullable()->after('notify_email');
        });
    }

    public function down(): void
    {
        Schema::table('project_control_reminders', function (Blueprint $table): void {
            $table->dropColumn('recipient_email');
        });
    }
};
