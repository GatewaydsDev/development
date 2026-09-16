<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_scope_products', function (Blueprint $table) {
            $table->decimal('allocated_handling', 12, 2)->nullable()->after('extended');
        });
    }

    public function down(): void
    {
        Schema::table('bid_scope_products', function (Blueprint $table) {
            $table->dropColumn('allocated_handling');
        });
    }
};
