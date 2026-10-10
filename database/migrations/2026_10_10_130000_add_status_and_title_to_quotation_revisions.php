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
        foreach (['quotation_revision_statuses', 'quotation_revision_titles'] as $tableName) {
            Schema::create($tableName, function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->string('name')->unique();
                $table->timestamps();
            });
        }

        foreach (['Pending', 'In progress', 'Issued', 'Approved', 'Rejected'] as $name) {
            DB::table('quotation_revision_statuses')->insert([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('quotation_revisions', function (Blueprint $table) {
            $table->foreignId('status_id')
                ->nullable()
                ->after('number')
                ->constrained('quotation_revision_statuses')
                ->nullOnDelete();
            $table->foreignId('title_id')
                ->nullable()
                ->after('status_id')
                ->constrained('quotation_revision_titles')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('quotation_revisions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('title_id');
            $table->dropConstrainedForeignId('status_id');
        });

        Schema::dropIfExists('quotation_revision_titles');
        Schema::dropIfExists('quotation_revision_statuses');
    }
};
