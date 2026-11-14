<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('contact_directory_contact_phone_numbers', 'country')) {
            Schema::table('contact_directory_contact_phone_numbers', function (Blueprint $table): void {
                $table->string('country', 2)->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::table('contact_directory_contact_phone_numbers', function (Blueprint $table): void {
            $table->dropColumn('country');
        });
    }
};
