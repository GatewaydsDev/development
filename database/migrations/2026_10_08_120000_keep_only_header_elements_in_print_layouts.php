<?php

use App\Models\PrintLayout;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        PrintLayout::query()->each(function (PrintLayout $layout): void {
            $design = is_array($layout->design) ? $layout->design : [];
            $elements = array_values(array_filter(
                is_array($design['elements'] ?? null) ? $design['elements'] : [],
                fn (mixed $element): bool => is_array($element) && ($element['zone'] ?? 'header') === 'header',
            ));
            $design['elements'] = $elements;
            unset($design['zone_colors']);
            $layout->update(['design' => $design]);
        });
    }

    public function down(): void {}
};
