<?php

use App\Models\Customer;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_contacts', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('title')->nullable();
            $table->string('email')->nullable();
            $table->string('phone_number')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
        });

        Customer::query()
            ->where(function ($query): void {
                $query
                    ->whereNotNull('email')
                    ->orWhereNotNull('phone_number');
            })
            ->each(function (Customer $customer): void {
                $customer->contacts()->create([
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'phone_number' => $customer->phone_number,
                    'is_primary' => true,
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_contacts');
    }
};

