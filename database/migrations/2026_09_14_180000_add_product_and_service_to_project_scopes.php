<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_scopes', function (Blueprint $table): void {
            $table->foreignId('product_id')
                ->nullable()
                ->after('scope_type')
                ->constrained()
                ->nullOnDelete();
            $table->foreignId('service_id')
                ->nullable()
                ->after('product_id')
                ->constrained()
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_scopes', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('product_id');
            $table->dropConstrainedForeignId('service_id');
        });
    }
};
