<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoffs', function (Blueprint $table): void {
            $table->string('revision_label', 40)->nullable()->after('revision_number');
        });
    }

    public function down(): void
    {
        Schema::table('takeoffs', function (Blueprint $table): void {
            $table->dropColumn('revision_label');
        });
    }
};
