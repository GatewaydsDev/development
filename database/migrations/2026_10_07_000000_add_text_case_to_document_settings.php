<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_settings', function (Blueprint $table): void {
            $table->string('text_case', 20)->default('original')->after('table_header_background_color');
        });
    }

    public function down(): void
    {
        Schema::table('document_settings', function (Blueprint $table): void {
            $table->dropColumn('text_case');
        });
    }
};
