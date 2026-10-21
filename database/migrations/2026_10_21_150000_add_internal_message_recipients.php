<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('internal_messages', 'recipient_id')) {
            Schema::table('internal_messages', function (Blueprint $table) {
                $table->foreignId('recipient_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
                $table->index(['recipient_id', 'user_id']);
            });
        }

        if (! Schema::hasColumn('internal_message_reads', 'with_user_id')) {
            Schema::table('internal_message_reads', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
                $table->dropUnique(['user_id']);
                $table->unsignedBigInteger('with_user_id')->default(0)->after('user_id');
                $table->unique(['user_id', 'with_user_id']);
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::table('internal_message_reads', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropUnique(['user_id', 'with_user_id']);
            $table->dropColumn('with_user_id');
            $table->unique('user_id');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('internal_messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recipient_id');
        });
    }
};
