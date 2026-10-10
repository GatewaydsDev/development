<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table): void {
            if (! Schema::hasColumn('bids', 'print_layout_version')) {
                $table->string('print_layout_version', 64)->nullable();
            }
        });
        Schema::table('quotations', function (Blueprint $table): void {
            if (! Schema::hasColumn('quotations', 'print_layout_id')) {
                $table->foreignId('print_layout_id')->nullable()->constrained('print_layouts')->nullOnDelete();
            }
            if (! Schema::hasColumn('quotations', 'print_layout_version')) {
                $table->string('print_layout_version', 64)->nullable();
            }
            if (! Schema::hasColumn('quotations', 'layout_header')) {
                $table->longText('layout_header')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            // Some installations already own the layout selection column.
            $table->dropColumn(['print_layout_version', 'layout_header']);
        });
        Schema::table('bids', function (Blueprint $table): void {
            $table->dropColumn('print_layout_version');
        });
    }
};
