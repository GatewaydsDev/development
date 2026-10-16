<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_master')->default(false)->after('email');
        });

        DB::table('users')
            ->where(function ($query): void {
                $query->where('email', 'ricardo@gateway-ds.com')
                    ->orWhere('microsoft_mailbox', 'ricardo@gateway-ds.com')
                    ->orWhere('name', 'Ricardo Scarpim');
            })
            ->update(['is_master' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_master');
        });
    }
};
