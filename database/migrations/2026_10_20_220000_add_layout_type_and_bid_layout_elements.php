<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_layouts', function (Blueprint $table): void {
            if (! Schema::hasColumn('print_layouts', 'layout_type')) {
                $table->string('layout_type', 40)->nullable()->after('name');
            }
        });

        Schema::table('bids', function (Blueprint $table): void {
            if (! Schema::hasColumn('bids', 'layout_elements')) {
                $table->json('layout_elements')->nullable();
            }
        });

        $known = ['quotation', 'bid'];

        foreach (DB::table('print_layouts')->pluck('id') as $id) {
            $documents = DB::table('document_layout_assignments')
                ->where('print_layout_id', $id)
                ->pluck('document_key')
                ->map(fn (string $key): string => explode('.', $key)[0])
                ->unique()
                ->values();

            if ($documents->count() === 1 && in_array($documents[0], $known, true)) {
                DB::table('print_layouts')->where('id', $id)->update([
                    'layout_type' => $documents[0],
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table): void {
            if (Schema::hasColumn('bids', 'layout_elements')) {
                $table->dropColumn('layout_elements');
            }
        });

        Schema::table('print_layouts', function (Blueprint $table): void {
            if (Schema::hasColumn('print_layouts', 'layout_type')) {
                $table->dropColumn('layout_type');
            }
        });
    }
};
