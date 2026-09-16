<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_settings', function (Blueprint $table): void {
            $table->string('document_key', 40)->nullable()->after('id');
        });

        $existing = DB::table('document_settings')->orderBy('id')->get();
        $header = $existing->first()?->header_background_color ?? '#065f46';
        $tableHeader = $existing->first()?->table_header_background_color ?? '#065f46';

        if ($existing->isNotEmpty()) {
            DB::table('document_settings')
                ->where('id', $existing->first()->id)
                ->update(['document_key' => 'bid.print']);

            DB::table('document_settings')
                ->whereNull('document_key')
                ->delete();
        }

        $now = now();
        $documents = ['bid', 'bid_list', 'quotation', 'project', 'project_list', 'catalog'];
        $formats = ['print', 'pdf', 'word'];

        foreach ($documents as $document) {
            foreach ($formats as $format) {
                $key = $document.'.'.$format;

                $hasKey = DB::table('document_settings')
                    ->where('document_key', $key)
                    ->exists();

                if ($hasKey) {
                    continue;
                }

                DB::table('document_settings')->insert([
                    'document_key' => $key,
                    'header_background_color' => $header,
                    'table_header_background_color' => $tableHeader,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        Schema::table('document_settings', function (Blueprint $table): void {
            $table->unique('document_key');
        });
    }

    public function down(): void
    {
        Schema::table('document_settings', function (Blueprint $table): void {
            $table->dropUnique(['document_key']);
            $table->dropColumn('document_key');
        });
    }
};
