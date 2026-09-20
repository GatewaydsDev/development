<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotation_contact', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contractor_contact_id')->constrained('contractor_contacts')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['quotation_id', 'contractor_contact_id']);
        });

        $quotations = DB::table('quotations')->select('id', 'contractor_id')->get();

        foreach ($quotations as $quotation) {
            if (! $quotation->contractor_id) {
                continue;
            }

            $primary = DB::table('contractor_contacts')
                ->where('contractor_id', $quotation->contractor_id)
                ->orderByDesc('is_primary')
                ->orderBy('name')
                ->first();

            if (! $primary) {
                continue;
            }

            DB::table('quotation_contact')->insert([
                'quotation_id' => $quotation->id,
                'contractor_contact_id' => $primary->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('quotation_contact');
    }
};
