<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_scopes', function (Blueprint $table): void {
            $table->decimal('quantity', 12, 2)->nullable()->after('notations');
            $table->decimal('unit_bid', 12, 2)->nullable()->after('quantity');
            $table->decimal('extended', 12, 2)->nullable()->after('unit_bid');
        });
    }

    public function down(): void
    {
        Schema::table('bid_scopes', function (Blueprint $table): void {
            $table->dropColumn(['quantity', 'unit_bid', 'extended']);
        });
    }
};
