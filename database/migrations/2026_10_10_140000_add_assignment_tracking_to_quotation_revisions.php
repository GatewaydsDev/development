<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotation_revisions', function (Blueprint $table) {
            $table->foreignId('responsible_assigned_by_id')
                ->nullable()
                ->after('responsible_user_id')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('responsible_assigned_at')->nullable()->after('responsible_assigned_by_id');
            $table->string('responsible_response', 20)->nullable()->after('responsible_assigned_at');
            $table->timestamp('responsible_responded_at')->nullable()->after('responsible_response');
        });
    }

    public function down(): void
    {
        Schema::table('quotation_revisions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('responsible_assigned_by_id');
            $table->dropColumn(['responsible_assigned_at', 'responsible_response', 'responsible_responded_at']);
        });
    }
};
