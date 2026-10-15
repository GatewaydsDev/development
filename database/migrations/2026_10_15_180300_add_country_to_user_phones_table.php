<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_phones', function (Blueprint $table): void {
            $table->string('country', 2)->default('US')->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('user_phones', function (Blueprint $table): void {
            $table->dropColumn('country');
        });
    }
};
