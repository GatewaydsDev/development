<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DocumentLayoutAssignment;
use App\Models\PrintLayout;
use App\Support\BidAccess;
use App\Support\DocumentAppearance;
use App\Support\DocumentLayoutElements;
use App\Support\DocumentLayoutImporter;
use App\Support\DocumentTextCase;
use App\Support\EditorImage;
use App\Support\PrintLayoutCatalog;
use App\Support\QuotationAccess;
use FontLib\Font;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DocumentSettingController extends Controller
{
    public function catalog(Request $request, string $document): JsonResponse
    {
        abort_unless(in_array($document, ['bid', 'quotation'], true), 404);
        $user = $request->user();
        abort_unless(
            $document === 'bid'
                ? BidAccess::canCreate($user) || BidAccess::canUpdate($user)
                : QuotationAccess::canCreate($user) || QuotationAccess::canUpdate($user),
            403,
        );

        return response()->json(PrintLayoutCatalog::forDocument($document))
            ->header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    }

    public function edit(Request $request): Response
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $document = DocumentAppearance::normalizeDocument((string) $request->query('document', 'bid'));
        $format = DocumentAppearance::normalizeFormat((string) $request->query('format', 'print'));
        $layouts = PrintLayout::query()->with('assignments')->orderBy('name')->get();
        $assignedLayoutId = DocumentLayoutAssignment::query()
            ->where('document_key', DocumentAppearance::key($document, $format))
            ->value('print_layout_id');
        $requestedLayoutId = $request->query('layout');
        $selectedLayoutId = $requestedLayoutId !== null
            ? (int) $requestedLayoutId
            : (int) ($assignedLayoutId ?? $layouts->first()?->id);
        $selectedLayout = $layouts->firstWhere('id', $selectedLayoutId) ?? $layouts->first();

        return Inertia::render('Admin/DocumentSettings/Edit', [
            'selected' => [
                'document' => $document,
                'format' => $format,
            ],
            'selectedLayoutId' => $selectedLayout?->id,
            'documents' => collect(DocumentAppearance::DOCUMENTS)
                ->map(fn (array $meta, string $key): array => [
                    'id' => $key,
                    'label' => $meta['label'],
                    'description' => $meta['description'],
                ])
                ->values()
                ->all(),
            'formats' => collect(DocumentAppearance::FORMATS)
                ->map(fn (array $meta, string $key): array => [
                    'id' => $key,
                    'label' => $meta['label'],
                    'description' => $meta['description'],
                ])
                ->values()
                ->all(),
            'assignmentOptions' => collect(DocumentAppearance::DOCUMENTS)
                ->flatMap(fn (array $documentMeta, string $documentKey): array => collect(DocumentAppearance::FORMATS)
                    ->map(fn (array $formatMeta, string $formatKey): array => [
                        'id' => DocumentAppearance::key($documentKey, $formatKey),
                        'document' => $documentMeta['label'],
                        'format' => $formatMeta['label'],
                    ])
                    ->values()
                    ->all())
                ->values()
                ->all(),
            'layouts' => $layouts->map(fn (PrintLayout $layout): array => [
                'id' => $layout->id,
                'name' => $layout->name,
                'header_background_color' => DocumentAppearance::normalize($layout->header_background_color),
                'table_header_background_color' => DocumentAppearance::normalize($layout->table_header_background_color),
                'text_case' => DocumentTextCase::normalize($layout->text_case),
                'assignments' => $layout->assignments->pluck('document_key')->values()->all(),
                'elements' => DocumentLayoutElements::sanitize($layout->design['elements'] ?? []),
                'zone_colors' => DocumentLayoutElements::zoneColors($layout->design['zone_colors'] ?? []),
            ])->values()->all(),
            'settings' => ($selectedLayout
                ? new DocumentAppearance(
                    DocumentAppearance::normalize($selectedLayout->header_background_color),
                    DocumentAppearance::normalize($selectedLayout->table_header_background_color),
                    $document,
                    $format,
                    DocumentTextCase::normalize($selectedLayout->text_case),
                )
                : DocumentAppearance::for($document, $format))->formValues(),
            'fields' => DocumentLayoutElements::fieldCatalog(),
            'defaults' => DocumentAppearance::defaults()->formValues(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $validated = $this->validateLayout($request);
        $layout = DB::transaction(function () use ($request, $validated): PrintLayout {
            $attributes = $this->layoutAttributes($validated);
            $layout = PrintLayout::query()->create([
                ...$attributes,
                'design' => $this->designWithColors(null, $attributes, $validated['elements'] ?? null, $validated['zone_colors'] ?? null),
                'created_by' => $request->user()?->id,
            ]);
            $this->syncAssignments($layout, $validated['assignments'] ?? []);

            return $layout;
        });

        return $this->savedResponse($layout);
    }

    public function update(Request $request, PrintLayout $layout): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $validated = $this->validateLayout($request);
        DB::transaction(function () use ($layout, $validated): void {
            $attributes = $this->layoutAttributes($validated);
            $layout->update([
                ...$attributes,
                'design' => $this->designWithColors($layout->design, $attributes, $validated['elements'] ?? null, $validated['zone_colors'] ?? null),
            ]);
            $this->syncAssignments($layout, $validated['assignments'] ?? []);
        });

        return $this->savedResponse($layout);
    }

    public function importFile(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,docx', 'max:10240'],
            'mode' => ['required', 'string', Rule::in([DocumentLayoutImporter::MODE_TEXT, DocumentLayoutImporter::MODE_LAYOUT])],
        ]);
        $file = $validated['file'];

        return response()->json(DocumentLayoutImporter::import(
            $file->getRealPath(),
            $file->getClientOriginalExtension(),
            $validated['mode'],
        ));
    }

    public function uploadImage(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $validated = $request->validate([
            'image' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'lossless' => ['sometimes', 'boolean'],
        ]);

        return response()->json([
            'url' => '/storage/'.(! empty($validated['lossless'])
                ? $validated['image']->store('editor-images', 'public')
                : EditorImage::store($validated['image'])),
        ]);
    }

    public function uploadPdfFont(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);
        $validated = $request->validate(['font' => ['required', 'file', 'max:2048']]);
        $data = file_get_contents($validated['font']->getRealPath());
        // PDF.js rebuilds embedded fonts as OpenType. Validate with the same parser used by PDF export.
        try {
            $font = Font::load($validated['font']->getRealPath());
            $font->parse();
            $font->close();
        } catch (\Throwable $error) {
            report($error);
            throw ValidationException::withMessages(['font' => 'This embedded font cannot be used by the document renderer.']);
        }
        $path = 'editor-fonts/'.hash('sha256', $data).'.ttf';
        Storage::disk('public')->put($path, $data);

        return response()->json(['url' => '/storage/'.$path]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateLayout(Request $request): array
    {
        $assignmentKeys = collect(DocumentAppearance::DOCUMENTS)
            ->flatMap(fn (array $documentMeta, string $documentKey): array => array_map(
                fn (string $formatKey): string => DocumentAppearance::key($documentKey, $formatKey),
                array_keys(DocumentAppearance::FORMATS),
            ))
            ->all();

        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'assignments' => ['present', 'array'],
            'assignments.*' => ['required', 'string', 'distinct', Rule::in($assignmentKeys)],
            'header_background_color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'table_header_background_color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'text_case' => ['required', 'string', Rule::in(array_keys(DocumentTextCase::OPTIONS))],
            'zone_colors' => ['sometimes', 'array'],
            'zone_colors.body' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'zone_colors.header_height' => ['nullable', 'integer', 'min:60'],
            'elements.*.x' => ['nullable', 'numeric', 'between:0,100'],
            'elements.*.y' => ['nullable', 'numeric', 'between:0,4000'],
            'elements.*.pdf_page' => ['sometimes', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/'],
            'elements.*.pdf_page_height' => ['sometimes', 'numeric', 'between:60,4000'],
            'elements.*.pdf_line_count' => ['sometimes', 'integer', 'between:1,200'],
            'elements.*.pdf_line_spacing' => ['sometimes', 'nullable', 'numeric', 'between:0.5,400'],
            'elements.*.pdf_list_lines' => ['sometimes', 'array', 'max:200'],
            'elements.*.pdf_list_lines.*' => ['integer', 'between:1,200'],
            'elements.*.pdf_bullet_style' => ['sometimes', 'string', Rule::in(['disc', 'circle', 'square'])],
            'elements.*.pdf_background' => ['sometimes', 'boolean'],
            'elements.*.pdf_font_src' => ['nullable', 'string', 'regex:#^/storage/editor-fonts/[a-f0-9]{64}\.ttf$#'],
            'elements.*.pdf_font_name' => ['nullable', 'string', 'max:120'],
            'elements.*.pdf_text_runs' => ['sometimes', 'array', 'max:1000'],
            'elements.*.pdf_text_runs.*' => ['array'],
            'elements.*.pdf_text_runs.*.line' => ['required', 'integer', 'between:0,199'],
            'elements.*.pdf_text_runs.*.offset' => ['required', 'integer', 'between:0,10000'],
            'elements.*.pdf_text_runs.*.length' => ['required', 'integer', 'between:1,10000'],
            'elements.*.pdf_text_runs.*.x' => ['required', 'numeric', 'between:0,700'],
            'elements.*.pdf_text_runs.*.y' => ['required', 'numeric', 'between:0,4000'],
            'elements.*.pdf_text_runs.*.width' => ['required', 'numeric', 'between:0.1,700'],
            'elements.*.pdf_text_runs.*.height' => ['required', 'numeric', 'between:1,200'],
            'elements.*.pdf_text_runs.*.font_size' => ['required', 'numeric', 'between:1,200'],
            'elements.*.pdf_text_runs.*.font_family' => ['nullable', 'string', Rule::in(array_keys(DocumentLayoutElements::FONT_FAMILIES))],
            'elements.*.pdf_text_runs.*.pdf_font_src' => ['nullable', 'string', 'regex:#^/storage/editor-fonts/[a-f0-9]{64}\.ttf$#'],
            'elements.*.pdf_text_runs.*.pdf_font_name' => ['nullable', 'string', 'max:120'],
            'elements.*.pdf_text_runs.*.bold' => ['required', 'boolean'],
            'elements.*.pdf_text_runs.*.italic' => ['required', 'boolean'],
            'elements.*.pdf_text_runs.*.color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'zone_colors.footer' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'elements' => ['sometimes', 'array', 'max:'.DocumentLayoutElements::MAX_ELEMENTS],
            'elements.*' => ['array'],
            'elements.*.id' => ['sometimes', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/', 'distinct'],
            'elements.*.type' => ['required', 'string', Rule::in(DocumentLayoutElements::TYPES)],
            'elements.*.zone' => ['required', 'string', Rule::in(DocumentLayoutElements::ZONES)],
            'elements.*.content' => ['nullable', 'string', 'max:1000'],
            'elements.*.items' => ['nullable', 'array', 'max:40'],
            'elements.*.cells' => ['nullable', 'array', 'min:1', 'max:60'],
            'elements.*.header_row' => ['nullable', 'boolean'],
            'elements.*.header_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'elements.*.stripe_direction' => ['nullable', 'string', Rule::in(['none', 'rows', 'columns'])],
            'elements.*.table_background' => ['nullable', 'string', 'regex:/^(#([A-Fa-f0-9]{6}))?$/'],
            'elements.*.column_colors' => ['nullable', 'array', 'max:6'],
            'elements.*.column_widths' => ['nullable', 'array', 'max:12'],
            'elements.*.column_widths.*' => ['required', 'numeric', 'between:0.1,100'],
            'elements.*.row_heights' => ['nullable', 'array', 'max:60'],
            'elements.*.row_heights.*' => ['required', 'numeric', 'between:1,4000'],
            'elements.*.cell_backgrounds' => ['nullable', 'array', 'max:60'],
            'elements.*.cell_backgrounds.*' => ['array', 'max:12'],
            'elements.*.cell_backgrounds.*.*' => ['string', 'regex:/^#[A-Fa-f0-9]{6}$/'],
            'elements.*.cell_borders' => ['nullable', 'array', 'max:60'],
            'elements.*.cell_borders.*' => ['array', 'max:12'],
            'elements.*.cell_borders.*.*' => ['array:top,right,bottom,left'],
            'elements.*.cell_borders.*.*.*' => ['string', 'regex:/^(none|(?:\\d+(?:\\.\\d+)?)px solid #[A-Fa-f0-9]{6})$/'],
            'elements.*.cell_spans' => ['nullable', 'array', 'max:60'],
            'elements.*.cell_spans.*' => ['array', 'max:12'],
            'elements.*.cell_spans.*.*' => ['array:rows,columns'],
            'elements.*.cell_spans.*.*.rows' => ['required', 'integer', 'between:0,60'],
            'elements.*.cell_spans.*.*.columns' => ['required', 'integer', 'between:0,12'],
            'elements.*.column_colors.*' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'elements.*.row_styles' => ['nullable', 'array', 'max:60'],
            'elements.*.row_styles.*' => ['nullable', 'array:font_family,font_size,color,bold,italic,underline,line_height,align,text_case'],
            'elements.*.row_styles.*.font_family' => ['sometimes', 'string', Rule::in(array_keys(DocumentLayoutElements::FONT_FAMILIES))],
            'elements.*.row_styles.*.font_size' => Rule::forEach(fn ($value, string $attribute) =>
                $request->input(implode('.', array_slice(explode('.', $attribute), 0, 2)).'.pdf_page')
                    ? ['sometimes', 'numeric', 'between:1,200'] : ['sometimes', 'integer', 'between:8,48']),
            'elements.*.row_styles.*.color' => ['sometimes', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'elements.*.row_styles.*.bold' => ['sometimes', 'boolean'],
            'elements.*.row_styles.*.italic' => ['sometimes', 'boolean'],
            'elements.*.row_styles.*.underline' => ['sometimes', 'boolean'],
            'elements.*.row_styles.*.line_height' => ['sometimes', 'numeric', Rule::in([1, 1.15, 1.35, 1.5, 2])],
            'elements.*.row_styles.*.align' => ['sometimes', 'string', Rule::in(DocumentLayoutElements::ALIGNMENTS)],
            'elements.*.row_styles.*.text_case' => ['sometimes', 'string', Rule::in(array_keys(DocumentTextCase::OPTIONS))],
            'elements.*.cell_styles' => ['nullable', 'array', 'max:60'],
            'elements.*.cell_styles.*' => ['nullable', 'array', 'max:12'],
            'elements.*.cell_styles.*.*' => ['nullable', 'array:font_family,font_size,color,bold,italic,underline,line_height,align,text_case'],
            'elements.*.cell_styles.*.*.font_family' => ['sometimes', 'string', Rule::in(array_keys(DocumentLayoutElements::FONT_FAMILIES))],
            'elements.*.cell_styles.*.*.font_size' => Rule::forEach(fn ($value, string $attribute) =>
                $request->input(implode('.', array_slice(explode('.', $attribute), 0, 2)).'.pdf_page')
                    ? ['sometimes', 'numeric', 'between:1,200'] : ['sometimes', 'integer', 'between:8,48']),
            'elements.*.cell_styles.*.*.color' => ['sometimes', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'elements.*.cell_styles.*.*.bold' => ['sometimes', 'boolean'],
            'elements.*.cell_styles.*.*.italic' => ['sometimes', 'boolean'],
            'elements.*.cell_styles.*.*.underline' => ['sometimes', 'boolean'],
            'elements.*.cell_styles.*.*.line_height' => ['sometimes', 'numeric', Rule::in([1, 1.15, 1.35, 1.5, 2])],
            'elements.*.cell_styles.*.*.align' => ['sometimes', 'string', Rule::in(DocumentLayoutElements::ALIGNMENTS)],
            'elements.*.cell_styles.*.*.text_case' => ['sometimes', 'string', Rule::in(array_keys(DocumentTextCase::OPTIONS))],
            'elements.*.stripe_color_a' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'elements.*.stripe_color_b' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'elements.*.cells.*' => ['array', 'min:1', 'max:12'],
            'elements.*.cells.*.*' => ['nullable', 'string', 'max:300'],
            'elements.*.items.*' => ['array'],
            'elements.*.items.*.label' => ['nullable', 'string', 'max:300'],
            'elements.*.items.*.value' => ['nullable', 'string', 'max:300'],
            'elements.*.label_bg' => ['nullable', 'string', 'regex:/^(#([A-Fa-f0-9]{6}))?$/'],
            'elements.*.border_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'elements.*.label_width' => ['nullable', 'integer', 'between:10,70'],
            'elements.*.layout' => ['nullable', 'string', Rule::in(['lines', 'table'])],
            'elements.*.border' => ['nullable', 'boolean'],
            'elements.*.show_labels' => ['nullable', 'boolean'],
            'elements.*.columns' => ['nullable', 'integer', 'between:1,4'],
            'elements.*.fields' => ['nullable', 'array'],
            'elements.*.fields.*' => ['string', Rule::in(array_keys(DocumentLayoutElements::COMPANY_FIELDS))],
            'elements.*.src' => ['nullable', 'string', 'max:255'],
            'elements.*.align' => ['nullable', 'string', Rule::in(DocumentLayoutElements::ALIGNMENTS)],
            'elements.*.width' => ['nullable', 'numeric', 'between:0.1,100'],
            'elements.*.height' => ['nullable', 'numeric', 'between:1,4000'],
            'elements.*.inline' => ['nullable', 'boolean'],
            'elements.*.bold' => ['nullable', 'boolean'],
            'elements.*.italic' => ['nullable', 'boolean'],
            'elements.*.underline' => ['nullable', 'boolean'],
            'elements.*.line_height' => ['nullable', 'numeric', Rule::in([1, 1.15, 1.35, 1.5, 2])],
            'elements.*.list_style' => ['nullable', 'string', Rule::in(['none', 'bullet', 'numbered'])],
            'elements.*.validity_days' => ['nullable', 'integer', Rule::in([30, 60, 90])],
            'elements.*.font_size' => ['nullable', 'numeric', 'between:1,200'],
            'elements.*.font_family' => ['nullable', 'string', 'in:'.implode(',', array_keys(DocumentLayoutElements::FONT_FAMILIES))],
            'elements.*.text_case' => ['nullable', 'string', Rule::in(array_keys(DocumentTextCase::OPTIONS))],
            'elements.*.color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, string>
     */
    private function layoutAttributes(array $validated): array
    {
        return [
            'name' => trim($validated['name']),
            'header_background_color' => DocumentAppearance::normalize($validated['header_background_color']),
            'table_header_background_color' => DocumentAppearance::normalize($validated['table_header_background_color']),
            'text_case' => DocumentTextCase::normalize($validated['text_case']),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $design
     * @param  array<string, string>  $attributes
     * @param  array<int, mixed>|null  $elements
     * @return array<string, mixed>
     */
    private function designWithColors(?array $design, array $attributes, ?array $elements, ?array $zoneColors = null): array
    {
        $design ??= [
            'paper' => 'letter',
            'colors' => [
                'text' => '#111827',
                'title' => $attributes['header_background_color'],
                'accent' => $attributes['header_background_color'],
                'section' => $attributes['header_background_color'],
                'surface' => '#F3F4F6',
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

        $colors = is_array($design['colors'] ?? null) ? $design['colors'] : [];
        $colors['header_background'] = $attributes['header_background_color'];
        $colors['table_header_background'] = $attributes['table_header_background_color'];
        $design['colors'] = $colors;
        if ($elements !== null) {
            $design['elements'] = DocumentLayoutElements::sanitize($elements);
        }

        if ($zoneColors !== null) {
            $design['zone_colors'] = DocumentLayoutElements::zoneColors($zoneColors);
        }

        return $design;
    }

    /**
     * @param  list<string>  $documentKeys
     */
    private function syncAssignments(PrintLayout $layout, array $documentKeys): void
    {
        DocumentLayoutAssignment::query()
            ->where('print_layout_id', $layout->id)
            ->orWhereIn('document_key', $documentKeys)
            ->delete();

        if ($documentKeys !== []) {
            $layout->assignments()->createMany(
                collect($documentKeys)
                    ->unique()
                    ->map(fn (string $documentKey): array => ['document_key' => $documentKey])
                    ->all(),
            );
        }
    }

    private function savedResponse(PrintLayout $layout): RedirectResponse
    {
        return redirect()
            ->route('admin.document-settings.edit', ['layout' => $layout->id])
            ->with('success', 'Print layout saved.');
    }
}
