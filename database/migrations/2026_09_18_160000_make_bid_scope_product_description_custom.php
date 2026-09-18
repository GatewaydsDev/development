<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE bid_scope_products MODIFY description TEXT NULL');
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE bid_scope_products ALTER COLUMN description TYPE TEXT');
            DB::statement('ALTER TABLE bid_scope_products ALTER COLUMN description DROP NOT NULL');
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE bid_scope_products MODIFY description VARCHAR(255) NULL');
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE bid_scope_products ALTER COLUMN description TYPE VARCHAR(255)');
        }
    }
};
