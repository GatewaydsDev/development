<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->foreignId('quotation_id')
                ->nullable()
                ->after('project_id')
                ->constrained()
                ->nullOnDelete();
        });

        Schema::table('quotations', function (Blueprint $table) {
            $table->foreignId('converted_bid_id')
                ->nullable()
                ->after('project_id')
                ->constrained('bids')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('converted_bid_id');
        });

        Schema::table('bids', function (Blueprint $table) {
            $table->dropConstrainedForeignId('quotation_id');
        });
    }
};
