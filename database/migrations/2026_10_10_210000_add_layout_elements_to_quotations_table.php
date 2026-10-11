<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            if (! Schema::hasColumn('quotations', 'layout_elements')) {
                $table->json('layout_elements')->nullable()->after('layout_header');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            if (Schema::hasColumn('quotations', 'layout_elements')) {
                $table->dropColumn('layout_elements');
            }
        });
    }
};
