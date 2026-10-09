<?php

use App\Models\PrintLayout;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        PrintLayout::query()->each(function (PrintLayout $layout): void {
            $design = is_array($layout->design) ? $layout->design : [];
            $changed = false;

            foreach ($design['elements'] ?? [] as $index => $element) {
                if (($element['type'] ?? null) === 'company' && ! isset($element['layout'])) {
                    $design['elements'][$index] = array_merge($element, [
                        'layout' => 'table',
                        'border' => true,
                        'show_labels' => true,
                        'columns' => 2,
                    ]);
                    $changed = true;
                }
            }

            if ($changed) {
                $layout->update(['design' => $design]);
            }
        });
    }

    public function down(): void {}
};
