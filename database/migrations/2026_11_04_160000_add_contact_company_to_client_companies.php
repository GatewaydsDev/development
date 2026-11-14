<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_companies', function (Blueprint $table): void {
            $table->foreignId('contact_company_id')->nullable()->unique()->after('name')
                ->constrained('contact_companies')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('client_companies', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('contact_company_id');
        });
    }
};
