<?php

use App\Models\CustomerContact;
use App\Models\CustomerContactRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_contact_roles', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('customer_contacts', function (Blueprint $table) {
            $table->foreignId('customer_contact_role_id')
                ->nullable()
                ->after('customer_id')
                ->constrained()
                ->nullOnDelete();
        });

        CustomerContact::query()
            ->whereNotNull('title')
            ->get()
            ->each(function (CustomerContact $contact): void {
                $role = CustomerContactRole::firstOrCreate([
                    'name' => $contact->title,
                ]);

                $contact->forceFill([
                    'customer_contact_role_id' => $role->id,
                ])->save();
            });
    }

    public function down(): void
    {
        Schema::table('customer_contacts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_contact_role_id');
        });

        Schema::dropIfExists('customer_contact_roles');
    }
};
