<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->string('recurring_frequency')->nullable()->after('amount');
            $table->date('recurring_starts_on')->nullable()->after('recurring_frequency');
            $table->date('recurring_ends_on')->nullable()->after('recurring_starts_on');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn(['recurring_frequency', 'recurring_starts_on', 'recurring_ends_on']);
        });
    }
};
