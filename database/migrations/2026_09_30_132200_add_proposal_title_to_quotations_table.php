<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->string('proposal_title')->default('Quote proposal based')->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->dropColumn('proposal_title');
        });
    }
};
