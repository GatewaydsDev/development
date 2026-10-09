<?php

use App\Models\PrintLayout;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        PrintLayout::query()->each(function (PrintLayout $layout): void {
            $design = is_array($layout->design) ? $layout->design : [];
            $elements = is_array($design['elements'] ?? null) ? $design['elements'] : [];

            foreach ($elements as $element) {
                if (($element['type'] ?? null) === 'company') {
                    return;
                }
            }

            $elements[] = [
                'id' => 'el-company-default',
                'type' => 'company',
                'zone' => 'intro',
                'content' => '',
                'src' => '',
                'align' => 'left',
                'width' => 100,
                'height' => 16,
                'font_size' => 12,
                'text_case' => 'original',
                'bold' => false,
                'italic' => false,
                'color' => '#111827',
            ];
            $design['elements'] = $elements;
            $layout->update(['design' => $design]);
        });
    }

    public function down(): void {}
};
