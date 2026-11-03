<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_directory_contacts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')->nullable()->constrained('contact_companies')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('first_name');
            $table->string('last_name')->nullable();
            $table->string('job_title')->nullable();
            $table->string('contact_type')->default('supplier');
            $table->foreignId('owner_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'is_active']);
            $table->index(['owner_id']);
            $table->index(['is_active', 'last_name']);
            $table->index('last_name');
        });

        Schema::create('contact_directory_contact_phone_numbers', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('contact_id')->constrained('contact_directory_contacts')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('phone_number', 40);
            $table->string('label')->default('office');
            $table->string('extension', 10)->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->unique(['contact_id', 'phone_number']);
            $table->index(['contact_id', 'is_primary']);
        });

        Schema::create('contact_directory_contact_email_addresses', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('contact_id')->constrained('contact_directory_contacts')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('email_address');
            $table->string('label')->default('main');
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->unique(['contact_id', 'email_address']);
            $table->index(['contact_id', 'is_primary']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_directory_contact_email_addresses');
        Schema::dropIfExists('contact_directory_contact_phone_numbers');
        Schema::dropIfExists('contact_directory_contacts');
    }
};
