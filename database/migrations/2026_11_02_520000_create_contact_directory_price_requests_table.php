<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_directory_price_requests', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignId('project_id')->nullable()->constrained('projects')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('currency', 3)->default('USD');
            $table->date('required_by')->nullable();
            $table->string('status')->default('draft');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'required_by']);
            $table->index('project_id');
        });

        Schema::create('contact_directory_price_request_items', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('price_request_id')->constrained('contact_directory_price_requests')->cascadeOnUpdate()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->text('description');
            $table->decimal('quantity', 14, 4)->default(1);
            $table->string('unit_of_measure', 20)->default('each');
            $table->text('specifications')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['price_request_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_directory_price_request_items');
        Schema::dropIfExists('contact_directory_price_requests');
    }
};
