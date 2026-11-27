<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('sku', 100)->nullable()->after('abbreviation');
        });

        Schema::table('takeoffs', function (Blueprint $table) {
            $table->string('install_pricing_method')->default('markup')->after('margin_rate');
            $table->decimal('install_markup_rate', 12, 6)->nullable()->after('install_pricing_method');
            $table->decimal('install_margin_rate', 12, 6)->nullable()->after('install_markup_rate');
            $table->boolean('transaction_fee_applicable')->default(false)->after('install_margin_rate');
        });

        Schema::table('takeoff_openings', function (Blueprint $table) {
            $table->string('scheduled_thickness')->nullable()->after('depth');
            $table->boolean('thickness_uncertain')->default(false)->after('scheduled_thickness');
            $table->string('commercial_status')->default('unverified')->after('scope');
            $table->decimal('price_override', 12, 2)->nullable()->after('commercial_status');
            $table->text('price_override_reason')->nullable()->after('price_override');
        });

        Schema::table('takeoff_costs', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('group_id')->constrained()->nullOnDelete();
            $table->string('price_scope')->default('supply')->after('kind');
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_costs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_id');
            $table->dropColumn('price_scope');
        });

        Schema::table('takeoff_openings', function (Blueprint $table) {
            $table->dropColumn([
                'scheduled_thickness',
                'thickness_uncertain',
                'commercial_status',
                'price_override',
                'price_override_reason',
            ]);
        });

        Schema::table('takeoffs', function (Blueprint $table) {
            $table->dropColumn([
                'install_pricing_method',
                'install_markup_rate',
                'install_margin_rate',
                'transaction_fee_applicable',
            ]);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('sku');
        });
    }
};
