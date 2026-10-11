<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('document_layout_assignments')) {
            return;
        }

        Schema::dropIfExists('document_layout_assignments_next');

        Schema::create('document_layout_assignments_next', function (Blueprint $table): void {
            $table->id();
            $table->string('document_key', 40);
            $table->foreignId('print_layout_id')->constrained('print_layouts')->cascadeOnDelete();
            $table->boolean('is_default')->default(true);
            $table->unique(['document_key', 'print_layout_id'], 'layout_output_unique');
        });

        foreach (DB::table('document_layout_assignments')->orderBy('document_key')->get() as $row) {
            DB::table('document_layout_assignments_next')->insert([
                'document_key' => $row->document_key,
                'print_layout_id' => $row->print_layout_id,
                'is_default' => true,
            ]);
        }

        Schema::drop('document_layout_assignments');
        Schema::rename('document_layout_assignments_next', 'document_layout_assignments');
    }

    public function down(): void
    {
        if (! Schema::hasTable('document_layout_assignments') || ! Schema::hasColumn('document_layout_assignments', 'is_default')) {
            return;
        }

        Schema::dropIfExists('document_layout_assignments_previous');

        Schema::create('document_layout_assignments_previous', function (Blueprint $table): void {
            $table->string('document_key', 40)->primary();
            $table->foreignId('print_layout_id')->constrained('print_layouts')->cascadeOnDelete();
        });

        $rows = DB::table('document_layout_assignments')
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get()
            ->unique('document_key');

        foreach ($rows as $row) {
            DB::table('document_layout_assignments_previous')->insert([
                'document_key' => $row->document_key,
                'print_layout_id' => $row->print_layout_id,
            ]);
        }

        Schema::drop('document_layout_assignments');
        Schema::rename('document_layout_assignments_previous', 'document_layout_assignments');
    }
};
