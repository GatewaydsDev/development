<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contractors', function (Blueprint $table) {
            $table->foreignId('customer_id')
                ->nullable()
                ->after('notes')
                ->constrained()
                ->nullOnDelete();
        });

        Schema::table('contractor_contacts', function (Blueprint $table) {
            $table->foreignId('customer_contact_id')
                ->nullable()
                ->after('contractor_id')
                ->constrained('customer_contacts')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('contractor_contacts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_contact_id');
        });

        Schema::table('contractors', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_id');
        });
    }
};
