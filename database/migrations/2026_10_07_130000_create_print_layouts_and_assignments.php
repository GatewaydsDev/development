<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $hadPrintLayouts = Schema::hasTable('print_layouts');

        if (! $hadPrintLayouts) {
            Schema::create('print_layouts', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 120);
                $table->json('design');
                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();
                $table->timestamps();
            });
        }

        $hadHeaderColor = Schema::hasColumn('print_layouts', 'header_background_color');
        $hadTableHeaderColor = Schema::hasColumn('print_layouts', 'table_header_background_color');
        $hadTextCase = Schema::hasColumn('print_layouts', 'text_case');

        Schema::table('print_layouts', function (Blueprint $table) use ($hadHeaderColor, $hadTableHeaderColor, $hadTextCase): void {
            if (! $hadHeaderColor) {
                $table->string('header_background_color', 7)->default('#065f46');
            }
            if (! $hadTableHeaderColor) {
                $table->string('table_header_background_color', 7)->default('#065f46');
            }
            if (! $hadTextCase) {
                $table->string('text_case', 20)->default('original');
            }
        });

        if ($hadPrintLayouts && ! $hadHeaderColor && ! $hadTableHeaderColor && ! $hadTextCase) {
            foreach (DB::table('print_layouts')->select('id', 'design')->get() as $layout) {
                $design = json_decode((string) $layout->design, true);
                $colors = is_array($design) && is_array($design['colors'] ?? null)
                    ? $design['colors']
                    : [];

                DB::table('print_layouts')
                    ->where('id', $layout->id)
                    ->update([
                        'header_background_color' => $this->validColor($colors['header_background'] ?? null, '#065f46'),
                        'table_header_background_color' => $this->validColor($colors['table_header_background'] ?? null, '#065f46'),
                    ]);
            }
        }

        if (! Schema::hasTable('document_layout_assignments')) {
            Schema::create('document_layout_assignments', function (Blueprint $table): void {
                $table->string('document_key', 40)->primary();
                $table->foreignId('print_layout_id')->constrained('print_layouts')->cascadeOnDelete();
            });
        }

        $documents = [
            'bid' => 'Bid',
            'bid_list' => 'Bid directory',
            'quotation' => 'Quotation',
            'project' => 'Project',
            'project_list' => 'Project directory',
            'catalog' => 'Product catalog',
        ];
        $formats = [
            'print' => 'Print-ready',
            'pdf' => 'PDF',
            'word' => 'Word',
        ];

        foreach ($documents as $documentKey => $documentLabel) {
            foreach ($formats as $formatKey => $formatLabel) {
                $key = $documentKey.'.'.$formatKey;
                if (DB::table('document_layout_assignments')->where('document_key', $key)->exists()) {
                    continue;
                }

                $settings = DB::table('document_settings')
                    ->where('document_key', $key)
                    ->first();
                $headerColor = $this->validColor($settings?->header_background_color, '#065f46');
                $tableHeaderColor = $this->validColor($settings?->table_header_background_color, '#065f46');
                $layoutId = DB::table('print_layouts')->insertGetId([
                    'name' => $documentLabel.' · '.$formatLabel,
                    'design' => json_encode($this->defaultDesign($headerColor, $tableHeaderColor)),
                    'header_background_color' => $headerColor,
                    'table_header_background_color' => $tableHeaderColor,
                    'text_case' => $settings?->text_case ?? 'original',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('document_layout_assignments')->insert([
                    'document_key' => $key,
                    'print_layout_id' => $layoutId,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_layout_assignments');
    }

    private function validColor(?string $value, string $fallback): string
    {
        return is_string($value) && preg_match('/^#[A-Fa-f0-9]{6}$/', $value) === 1
            ? strtolower($value)
            : $fallback;
    }

    /**
     * @return array<string, mixed>
     */
    private function defaultDesign(string $headerColor, string $tableHeaderColor): array
    {
        return [
            'paper' => 'letter',
            'colors' => [
                'text' => '#111827',
                'title' => $headerColor,
                'accent' => $headerColor,
                'section' => $headerColor,
                'surface' => '#F3F4F6',
                'header_background' => $headerColor,
                'table_header_background' => $tableHeaderColor,
            ],
            'margin' => 'normal',
            'margin_mm' => 16,
            'font_size' => 11,
            'title_size' => 28,
            'font_family' => 'Arial',
            'orientation' => 'portrait',
            'sections' => ['overview', 'project', 'recipient', 'content', 'authorization', 'footer'],
            'header_elements' => [],
        ];
    }
};
