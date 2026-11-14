<?php

use App\Models\ContactDirectory\AddressType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const LEGACY = ['office' => 'Office', 'branch' => 'Branch office', 'warehouse' => 'Warehouse', 'billing' => 'Billing', 'shipping' => 'Shipping', 'other' => 'Other'];

    public function up(): void
    {
        Schema::create('contact_address_types', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 60)->unique('contact_address_types_name_uq');
            $table->timestamps();
        });

        foreach (AddressType::DEFAULTS as $name) {
            AddressType::create(['name' => $name]);
        }

        Schema::table('contact_company_addresses', function (Blueprint $table): void {
            $table->foreignId('address_type_id')->nullable()->after('name')->constrained('contact_address_types', 'id', 'company_address_type_fk')->nullOnDelete();
        });

        foreach (self::LEGACY as $label => $name) {
            DB::table('contact_company_addresses')->where('label', $label)
                ->update(['address_type_id' => AddressType::where('name', $name)->value('id')]);
        }

        Schema::table('contact_company_addresses', function (Blueprint $table): void {
            $table->dropColumn('label');
        });
    }

    public function down(): void
    {
        Schema::table('contact_company_addresses', function (Blueprint $table): void {
            $table->string('label', 40)->default('branch')->after('company_id');
            $table->dropForeign('company_address_type_fk');
            $table->dropColumn('address_type_id');
        });
        Schema::dropIfExists('contact_address_types');
    }
};
