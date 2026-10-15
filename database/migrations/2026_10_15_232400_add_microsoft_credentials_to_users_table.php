<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->uuid('microsoft_tenant_id')->nullable()->after('microsoft_mailbox');
            $table->uuid('microsoft_client_id')->nullable()->after('microsoft_tenant_id');
            $table->text('microsoft_client_secret')->nullable()->after('microsoft_client_id');
            $table->uuid('microsoft_client_secret_id')->nullable()->after('microsoft_client_secret');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'microsoft_tenant_id',
                'microsoft_client_id',
                'microsoft_client_secret',
                'microsoft_client_secret_id',
            ]);
        });
    }
};
