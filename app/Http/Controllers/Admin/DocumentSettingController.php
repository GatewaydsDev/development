<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DocumentLayoutAssignment;
use App\Models\PrintLayout;
use App\Support\DocumentAppearance;
use App\Support\DocumentLayoutElements;
use App\Support\DocumentLayoutImporter;
use App\Support\DocumentTextCase;
use App\Support\EditorImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DocumentSettingController extends Controller
{
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
        ]);

        return response()->json([
            'url' => '/storage/'.EditorImage::store($validated['image']),
        ]);
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
            'elements.*.y' => ['nullable', 'integer', 'between:0,2000'],
            'zone_colors.footer' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'elements' => ['sometimes', 'array', 'max:'.DocumentLayoutElements::MAX_ELEMENTS],
            'elements.*' => ['array'],
            'elements.*.type' => ['required', 'string', Rule::in(DocumentLayoutElements::TYPES)],
            'elements.*.zone' => ['required', 'string', Rule::in(DocumentLayoutElements::ZONES)],
            'elements.*.content' => ['nullable', 'string', 'max:1000'],
            'elements.*.items' => ['nullable', 'array', 'max:40'],
            'elements.*.cells' => ['nullable', 'array', 'min:1', 'max:20'],
            'elements.*.header_row' => ['nullable', 'boolean'],
            'elements.*.header_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'elements.*.cells.*' => ['array', 'min:1', 'max:4'],
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
            'elements.*.width' => ['nullable', 'integer', 'between:5,100'],
            'elements.*.height' => ['nullable', 'integer', 'between:1,400'],
            'elements.*.inline' => ['nullable', 'boolean'],
            'elements.*.bold' => ['nullable', 'boolean'],
            'elements.*.italic' => ['nullable', 'boolean'],
            'elements.*.underline' => ['nullable', 'boolean'],
            'elements.*.line_height' => ['nullable', 'numeric', Rule::in([1, 1.15, 1.35, 1.5, 2])],
            'elements.*.list_style' => ['nullable', 'string', Rule::in(['none', 'bullet', 'numbered'])],
            'elements.*.font_size' => ['nullable', 'integer', 'between:8,48'],
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
        DocumentLayoutAssignment::query()->whereIn('document_key', $documentKeys)->delete();

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
