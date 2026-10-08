<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $color = '#065f46';

        DB::transaction(function () use ($color): void {
            DB::table('document_layout_assignments')->delete();
            DB::table('print_layouts')->delete();

            $layoutId = DB::table('print_layouts')->insertGetId([
                'name' => 'Default',
                'design' => json_encode([
                    'paper' => 'letter',
                    'colors' => [
                        'text' => '#111827',
                        'title' => $color,
                        'accent' => $color,
                        'section' => $color,
                        'surface' => '#F3F4F6',
                        'header_background' => $color,
                        'table_header_background' => $color,
                    ],
                    'margin' => 'normal',
                    'margin_mm' => 16,
                    'font_size' => 11,
                    'title_size' => 28,
                    'font_family' => 'Arial',
                    'orientation' => 'portrait',
                    'sections' => ['overview', 'project', 'recipient', 'content', 'authorization', 'footer'],
                    'header_elements' => [],
                ]),
                'header_background_color' => $color,
                'table_header_background_color' => $color,
                'text_case' => 'original',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $documents = ['bid', 'bid_list', 'quotation', 'project', 'project_list', 'catalog'];
            $formats = ['print', 'pdf', 'word'];

            foreach ($documents as $document) {
                foreach ($formats as $format) {
                    DB::table('document_layout_assignments')->insert([
                        'document_key' => $document.'.'.$format,
                        'print_layout_id' => $layoutId,
                    ]);
                }
            }
        });
    }

    public function down(): void
    {
        //
    }
};
