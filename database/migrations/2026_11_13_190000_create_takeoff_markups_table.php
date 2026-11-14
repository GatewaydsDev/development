<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('takeoff_markups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('takeoff_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_id')->constrained('takeoff_documents')->cascadeOnDelete();
            $table->unsignedInteger('page');
            $table->string('kind', 12);
            $table->string('color', 7);
            $table->json('points');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['takeoff_id', 'document_id', 'page']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('takeoff_markups');
    }
};
