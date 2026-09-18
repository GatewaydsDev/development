<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_scope_products', function (Blueprint $table) {
            $table->decimal('combined_price', 12, 2)->nullable()->after('allocated_handling');
        });
    }

    public function down(): void
    {
        Schema::table('bid_scope_products', function (Blueprint $table) {
            $table->dropColumn('combined_price');
        });
    }
};
