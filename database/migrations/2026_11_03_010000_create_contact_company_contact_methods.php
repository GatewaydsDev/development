<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contact_company_phone_numbers')) {
            Schema::create('contact_company_phone_numbers', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique('company_phone_uuid_uq');
                $table->foreignId('company_id');
                $table->string('phone_number', 40);
                $table->string('country', 2)->nullable();
                $table->string('label')->default('office');
                $table->string('extension', 10)->nullable();
                $table->boolean('is_primary')->default(false);
                $table->timestamps();
                $table->unique(['company_id', 'phone_number'], 'company_phone_value_uq');
                $table->index(['company_id', 'is_primary'], 'company_phone_primary_idx');
                $table->foreign('company_id', 'company_phone_company_fk')->references('id')->on('contact_companies')->cascadeOnDelete();
            });
        }
        if (! Schema::hasTable('contact_company_email_addresses')) {
            Schema::create('contact_company_email_addresses', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique('company_email_uuid_uq');
                $table->foreignId('company_id');
                $table->string('email_address');
                $table->string('label')->default('main');
                $table->boolean('is_primary')->default(false);
                $table->timestamps();
                $table->unique(['company_id', 'email_address'], 'company_email_value_uq');
                $table->index(['company_id', 'is_primary'], 'company_email_primary_idx');
                $table->foreign('company_id', 'company_email_company_fk')->references('id')->on('contact_companies')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_company_email_addresses');
        Schema::dropIfExists('contact_company_phone_numbers');
    }
};
