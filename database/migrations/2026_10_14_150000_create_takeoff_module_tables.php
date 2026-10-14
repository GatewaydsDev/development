<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('takeoffs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained()->restrictOnDelete();
            $table->foreignId('root_takeoff_id')->nullable()->constrained('takeoffs')->nullOnDelete();
            $table->foreignId('source_takeoff_id')->nullable()->constrained('takeoffs')->nullOnDelete();
            $table->unsignedInteger('revision_number')->default(1);
            $table->string('title');
            $table->string('status')->default('draft');
            $table->string('pricing_method')->default('markup');
            $table->decimal('markup_rate', 8, 6)->nullable();
            $table->decimal('margin_rate', 8, 6)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'status']);
            $table->index('root_takeoff_id');
        });

        Schema::create('takeoff_documents', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('takeoff_id')->constrained()->cascadeOnDelete();
            $table->string('original_filename');
            $table->string('storage_path');
            $table->string('mime')->default('application/pdf');
            $table->unsignedBigInteger('size');
            $table->string('document_type');
            $table->string('revision_label')->nullable();
            $table->string('sheet_number')->nullable();
            $table->string('sheet_title')->nullable();
            $table->unsignedInteger('page_count')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('takeoff_id');
        });

        Schema::create('takeoff_assembly_templates', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name');
            $table->string('opening_type');
            $table->string('product_category')->nullable();
            $table->string('frame_type')->nullable();
            $table->string('handing')->nullable();
            $table->string('hardware_set')->nullable();
            $table->string('glazing')->nullable();
            $table->string('finish')->nullable();
            $table->string('manufacturer')->nullable();
            $table->string('product_model')->nullable();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->json('components')->nullable();
            $table->json('default_costs')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('takeoff_groups', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('takeoff_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('origin_group_id')->nullable()->index();
            $table->string('name');
            $table->boolean('manual')->default(false);
            $table->boolean('mismatch')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('takeoff_id');
        });

        Schema::create('takeoff_openings', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('takeoff_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('origin_opening_id')->nullable()->index();
            $table->foreignId('group_id')->nullable()->constrained('takeoff_groups')->nullOnDelete();
            $table->string('tag')->nullable();
            $table->boolean('is_bulk')->default(false);
            $table->string('opening_type');
            $table->string('location')->nullable();
            $table->decimal('quantity', 12, 2)->default(1);
            $table->string('product_category')->nullable();
            $table->decimal('width', 12, 3)->nullable();
            $table->decimal('height', 12, 3)->nullable();
            $table->decimal('depth', 12, 3)->nullable();
            $table->string('dimension_unit')->default('in');
            $table->string('frame_type')->nullable();
            $table->string('handing')->nullable();
            $table->string('hardware_set')->nullable();
            $table->string('glazing')->nullable();
            $table->string('finish')->nullable();
            $table->string('manufacturer')->nullable();
            $table->string('product_model')->nullable();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('scope')->default('both');
            $table->text('notes')->nullable();
            $table->text('exclusions')->nullable();
            $table->text('assumptions')->nullable();
            $table->string('disposition')->default('active');
            $table->text('disposition_reason')->nullable();
            $table->json('waived_checks')->nullable();
            $table->text('acoustic_requirement')->nullable();
            $table->text('rf_requirement')->nullable();
            $table->text('fire_requirement')->nullable();
            $table->text('ballistic_requirement')->nullable();
            $table->text('other_requirements')->nullable();
            $table->text('verified_acoustic')->nullable();
            $table->text('verified_rf')->nullable();
            $table->text('verified_fire')->nullable();
            $table->text('verified_ballistic')->nullable();
            $table->string('verification_status')->default('recorded');
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('requirement_document_id')->nullable()->constrained('takeoff_documents')->nullOnDelete();
            $table->unsignedInteger('requirement_page')->nullable();
            $table->string('requirement_section')->nullable();
            $table->foreignId('template_id')->nullable()->constrained('takeoff_assembly_templates')->nullOnDelete();
            $table->json('template_snapshot')->nullable();
            $table->boolean('needs_review')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['takeoff_id', 'tag']);
        });

        Schema::create('takeoff_markers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opening_id')->constrained('takeoff_openings')->cascadeOnDelete();
            $table->foreignId('document_id')->constrained('takeoff_documents')->cascadeOnDelete();
            $table->unsignedInteger('page');
            $table->decimal('x', 10, 6);
            $table->decimal('y', 10, 6);
            $table->timestamps();

            $table->index(['document_id', 'page']);
        });

        Schema::create('takeoff_references', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opening_id')->constrained('takeoff_openings')->cascadeOnDelete();
            $table->foreignId('document_id')->nullable()->constrained('takeoff_documents')->nullOnDelete();
            $table->unsignedInteger('page')->nullable();
            $table->string('section')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();
        });

        Schema::create('takeoff_costs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('takeoff_id')->constrained()->cascadeOnDelete();
            $table->foreignId('opening_id')->nullable()->constrained('takeoff_openings')->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained('takeoff_groups')->cascadeOnDelete();
            $table->string('kind');
            $table->string('basis');
            $table->string('description')->nullable();
            $table->decimal('amount', 12, 2)->nullable();
            $table->decimal('labor_hours', 10, 2)->nullable();
            $table->decimal('hourly_rate', 12, 2)->nullable();
            $table->boolean('from_template')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('takeoff_id');
        });

        Schema::create('takeoff_supplier_quotes', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('takeoff_id')->constrained()->cascadeOnDelete();
            $table->foreignId('opening_id')->nullable()->constrained('takeoff_openings')->nullOnDelete();
            $table->foreignId('group_id')->nullable()->constrained('takeoff_groups')->nullOnDelete();
            $table->foreignId('supersedes_id')->nullable()->constrained('takeoff_supplier_quotes')->nullOnDelete();
            $table->string('supplier_name');
            $table->string('quote_number')->nullable();
            $table->string('revision_label')->nullable();
            $table->date('quote_date')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('storage_path')->nullable();
            $table->string('original_filename')->nullable();
            $table->text('included_scope')->nullable();
            $table->text('exclusions')->nullable();
            $table->text('pricing_notes')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('takeoff_id');
        });

        Schema::create('takeoff_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('takeoff_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action');
            $table->string('summary');
            $table->json('changes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['takeoff_id', 'created_at']);
        });

        Schema::create('takeoff_quotation_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quotation_line_item_id')->nullable()->constrained('quotation_line_items')->nullOnDelete();
            $table->foreignId('takeoff_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('takeoff_revision');
            $table->string('source_key');
            $table->json('snapshot');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['quotation_id', 'source_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('takeoff_quotation_lines');
        Schema::dropIfExists('takeoff_audits');
        Schema::dropIfExists('takeoff_supplier_quotes');
        Schema::dropIfExists('takeoff_costs');
        Schema::dropIfExists('takeoff_references');
        Schema::dropIfExists('takeoff_markers');
        Schema::dropIfExists('takeoff_openings');
        Schema::dropIfExists('takeoff_groups');
        Schema::dropIfExists('takeoff_assembly_templates');
        Schema::dropIfExists('takeoff_documents');
        Schema::dropIfExists('takeoffs');
    }
};
