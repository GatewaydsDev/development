<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('login_block_logs', function (Blueprint $table) {
            $table->string('kind', 20)->default('blocked')->after('email');
            $table->string('source', 20)->default('failed_attempts')->after('kind');
            $table->string('blocked_by')->nullable()->after('source');
        });

        // Accounts blocked or deactivated by hand before logging existed.
        DB::table('users')
            ->whereNotNull('account_status')
            ->where('account_status', '!=', 'active')
            ->get(['id', 'name', 'email', 'account_status', 'login_locked_at', 'updated_at'])
            ->each(function ($user): void {
                $open = DB::table('login_block_logs')->where('user_id', $user->id)->whereNull('released_at')->exists();

                if ($open) {
                    return;
                }

                DB::table('login_block_logs')->insert([
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'kind' => $user->account_status,
                    'source' => 'manual',
                    'attempts' => 0,
                    'emails_sent' => 0,
                    'blocked_at' => $user->login_locked_at ?? $user->updated_at ?? now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('login_block_logs', function (Blueprint $table) {
            $table->dropColumn(['kind', 'source', 'blocked_by']);
        });
    }
};
