<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expense_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expense_id')->constrained()->cascadeOnDelete();
            $table->date('due_on');
            $table->date('paid_on')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('status');
            $table->string('method');
            $table->timestamps();

            $table->index(['expense_id', 'due_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expense_payments');
    }
};
