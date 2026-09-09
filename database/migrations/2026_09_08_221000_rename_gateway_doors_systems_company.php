<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('companies')) {
            return;
        }

        DB::table('companies')
            ->where('name', 'Gateway Doors Systems')
            ->update(['name' => 'Gateway Door Systems']);

        DB::table('companies')
            ->where('legal_name', 'Gateway Doors Systems')
            ->update(['legal_name' => 'Gateway Door Systems']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('companies')) {
            return;
        }

        DB::table('companies')
            ->where('name', 'Gateway Door Systems')
            ->update(['name' => 'Gateway Doors Systems']);

        DB::table('companies')
            ->where('legal_name', 'Gateway Door Systems')
            ->update(['legal_name' => 'Gateway Door Systems']);
    }
};
