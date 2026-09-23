<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pre_bids', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->foreignId('project_id')
                ->nullable()
                ->constrained('projects')
                ->nullOnDelete();
            $table->foreignId('assigned_to')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->foreignId('bid_shipping_text_template_id')
                ->nullable()
                ->constrained('bid_text_templates')
                ->nullOnDelete();
            $table->foreignId('bid_scope_text_template_id')
                ->nullable()
                ->constrained('bid_text_templates')
                ->nullOnDelete();
            $table->longText('notes')->nullable();
            $table->longText('scope_of_work_text')->nullable();
            $table->json('scopes')->nullable();
            $table->json('stages')->nullable();
            $table->json('revisions')->nullable();
            $table->json('pricings')->nullable();
            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pre_bids');
    }
};
