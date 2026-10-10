<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table): void {
            $table->longText('notes')->nullable()->change();
        });
        Schema::table('bid_scopes', function (Blueprint $table): void {
            $table->longText('notations')->nullable()->change();
        });
        Schema::table('quotations', function (Blueprint $table): void {
            $table->longText('notes')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table): void {
            $table->text('notes')->nullable()->change();
        });
        Schema::table('bid_scopes', function (Blueprint $table): void {
            $table->text('notations')->nullable()->change();
        });
        Schema::table('quotations', function (Blueprint $table): void {
            $table->text('notes')->nullable()->change();
        });
    }
};
