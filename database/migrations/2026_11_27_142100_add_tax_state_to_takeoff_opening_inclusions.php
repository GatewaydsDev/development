<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_opening_inclusions', function (Blueprint $table) {
            $table->foreignId('tax_state_id')->nullable()->after('product_id')->constrained('tax_states')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_opening_inclusions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tax_state_id');
        });
    }
};
