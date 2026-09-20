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
        Schema::create('quotation_tables', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('quotation_product_fields', function (Blueprint $table): void {
            $table->foreignId('quotation_table_id')
                ->nullable()
                ->after('quotation_id')
                ->constrained('quotation_tables')
                ->cascadeOnDelete();
        });

        $quotationIds = DB::table('quotation_product_fields')
            ->distinct()
            ->pluck('quotation_id');

        $now = now();

        foreach ($quotationIds as $quotationId) {
            $tableId = DB::table('quotation_tables')->insertGetId([
                'uuid' => (string) Str::uuid(),
                'quotation_id' => $quotationId,
                'title' => 'Table',
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('quotation_product_fields')
                ->where('quotation_id', $quotationId)
                ->update(['quotation_table_id' => $tableId]);
        }
    }

    public function down(): void
    {
        Schema::table('quotation_product_fields', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('quotation_table_id');
        });

        Schema::dropIfExists('quotation_tables');
    }
};
