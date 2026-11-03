<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_directory_supplier_quotes', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('inquiry_id')->constrained('contact_directory_inquiries')->cascadeOnUpdate()->cascadeOnDelete();
            $table->unsignedInteger('revision_number')->default(1);
            $table->boolean('is_current_revision')->default(true);
            $table->string('supplier_reference_number')->nullable();
            $table->date('received_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('currency', 3)->default('USD');
            $table->decimal('discount_amount', 14, 2)->default(0);
            $table->string('discount_mode', 10)->default('amount');
            $table->decimal('freight_amount', 14, 2)->default(0);
            $table->decimal('tax_amount', 14, 2)->default(0);
            $table->decimal('other_charges_amount', 14, 2)->default(0);
            $table->decimal('grand_total', 14, 2)->default(0);
            $table->string('lead_time_value')->nullable();
            $table->string('lead_time_unit', 30)->default('days');
            $table->text('lead_time_text')->nullable();
            $table->string('payment_terms')->nullable();
            $table->text('availability_notes')->nullable();
            $table->text('specification_compliance')->nullable();
            $table->text('exclusions')->nullable();
            $table->text('notes')->nullable();
            $table->string('review_status')->default('unreviewed');
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['inquiry_id', 'revision_number'], 'cd_supplier_quote_revision_unique');
            $table->index(['inquiry_id', 'is_current_revision'], 'cd_supplier_quote_current_idx');
        });

        Schema::create('contact_directory_supplier_quote_items', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('supplier_quote_id')->constrained('contact_directory_supplier_quotes', 'id', 'cd_preferred_quote_quote_fk')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('price_request_item_id')->nullable()->constrained('contact_directory_price_request_items', 'id', 'cd_quote_item_request_item_fk')->cascadeOnUpdate()->restrictOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->text('description');
            $table->decimal('quantity', 14, 4)->default(1);
            $table->string('unit_of_measure', 20)->default('each');
            $table->decimal('unit_price', 14, 4)->nullable();
            $table->decimal('line_total', 14, 2)->default(0);
            $table->text('availability_notes')->nullable();
            $table->text('specification_notes')->nullable();
            $table->timestamps();

            $table->index(['supplier_quote_id', 'position'], 'cd_quote_item_position_idx');
            $table->index('price_request_item_id', 'cd_quote_item_request_item_idx');
        });

        Schema::create('contact_directory_price_request_preferred_quotes', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('price_request_id')->constrained('contact_directory_price_requests', 'id', 'cd_preferred_quote_request_fk')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('supplier_quote_id')->constrained('contact_directory_supplier_quotes', 'id', 'cd_preferred_quote_quote_fk')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('selection_reason');
            $table->foreignId('selected_by')->constrained('users', 'id', 'cd_preferred_quote_user_fk')->cascadeOnUpdate()->restrictOnDelete();
            $table->timestamp('selected_at');
            $table->timestamps();

            $table->unique('price_request_id', 'cd_preferred_quote_request_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_directory_price_request_preferred_quotes');
        Schema::dropIfExists('contact_directory_supplier_quote_items');
        Schema::dropIfExists('contact_directory_supplier_quotes');
    }
};
