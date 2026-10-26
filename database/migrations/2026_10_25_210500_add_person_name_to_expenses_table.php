<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->string('person_name')->nullable()->after('user_id');
        });

        DB::table('expenses')->orderBy('id')->lazy()->each(function (object $expense): void {
            $name = $expense->user_id
                ? DB::table('users')->where('id', $expense->user_id)->value('name')
                : null;

            DB::table('expenses')->where('id', $expense->id)->update([
                'person_name' => is_string($name) && trim($name) !== '' ? $name : 'Unknown',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn('person_name');
        });
    }
};
