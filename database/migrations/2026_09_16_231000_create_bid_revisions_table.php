<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bid_revisions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('bid_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('number');
            $table->date('revision_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['bid_id', 'number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bid_revisions');
    }
};
