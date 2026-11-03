<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contact_company_addresses')) {
            Schema::create('contact_company_addresses', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique('company_address_uuid_uq');
                $table->foreignId('company_id');
                $table->string('label', 40)->default('branch');
                $table->boolean('is_headquarters')->default(false);
                $table->string('address_line_1')->nullable();
                $table->string('address_line_2')->nullable();
                $table->string('city')->nullable();
                $table->string('state')->nullable();
                $table->string('postal_code')->nullable();
                $table->string('country')->nullable();
                $table->timestamps();
                $table->index(['company_id', 'is_headquarters'], 'company_address_hq_idx');
                $table->foreign('company_id', 'company_address_company_fk')->references('id')->on('contact_companies')->cascadeOnDelete();
            });
        }

        // Existing single addresses become each company's headquarters.
        DB::table('contact_companies')
            ->where(fn ($query) => $query->whereNotNull('address_line_1')->orWhereNotNull('city')->orWhereNotNull('state')->orWhereNotNull('postal_code'))
            ->orderBy('id')
            ->each(function ($company): void {
                if (DB::table('contact_company_addresses')->where('company_id', $company->id)->exists()) {
                    return;
                }

                DB::table('contact_company_addresses')->insert([
                    'uuid' => (string) Str::uuid(),
                    'company_id' => $company->id,
                    'label' => 'office',
                    'is_headquarters' => true,
                    'address_line_1' => $company->address_line_1,
                    'address_line_2' => $company->address_line_2,
                    'city' => $company->city,
                    'state' => $company->state,
                    'postal_code' => $company->postal_code,
                    'country' => $company->country,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_company_addresses');
    }
};
