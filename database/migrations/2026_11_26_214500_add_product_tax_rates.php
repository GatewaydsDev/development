<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('tax_rate', 6, 3)->nullable()->after('tax_state_id');
        });

        Schema::table('product_state_prices', function (Blueprint $table) {
            $table->decimal('tax_rate', 6, 3)->nullable()->after('tax_state_id');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('tax_rate');
        });

        Schema::table('product_state_prices', function (Blueprint $table) {
            $table->dropColumn('tax_rate');
        });
    }
};
