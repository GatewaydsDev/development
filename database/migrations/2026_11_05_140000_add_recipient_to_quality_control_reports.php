<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quality_control_reports', function (Blueprint $table): void {
            $table->foreignId('assigned_to_user_id')
                ->nullable()
                ->after('inspector_user_id')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('assigned_at')->nullable()->after('assigned_to_user_id');
            $table->index(['assigned_to_user_id', 'assigned_at']);
        });
    }

    public function down(): void
    {
        Schema::table('quality_control_reports', function (Blueprint $table): void {
            $table->dropIndex(['assigned_to_user_id', 'assigned_at']);
            $table->dropConstrainedForeignId('assigned_to_user_id');
            $table->dropColumn('assigned_at');
        });
    }
};
