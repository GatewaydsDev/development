<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DocumentSetting;
use App\Support\DocumentAppearance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
        $appearance = DocumentAppearance::for($document, $format);

        return Inertia::render('Admin/DocumentSettings/Edit', [
            'selected' => [
                'document' => $document,
                'format' => $format,
            ],
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
            'themes' => DocumentAppearance::catalog(),
            'settings' => $appearance->formValues(),
            'defaults' => DocumentAppearance::defaults()->formValues(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $validated = $request->validate([
            'document' => ['required', 'string', Rule::in(array_keys(DocumentAppearance::DOCUMENTS))],
            'format' => ['required', 'string', Rule::in(array_keys(DocumentAppearance::FORMATS))],
            'header_background_color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'table_header_background_color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
        ]);

        $document = DocumentAppearance::normalizeDocument($validated['document']);
        $format = DocumentAppearance::normalizeFormat($validated['format']);

        DocumentSetting::forKey(DocumentAppearance::key($document, $format))->update([
            'header_background_color' => DocumentAppearance::normalize($validated['header_background_color']),
            'table_header_background_color' => DocumentAppearance::normalize($validated['table_header_background_color']),
        ]);

        return redirect()
            ->route('admin.document-settings.edit', [
                'document' => $document,
                'format' => $format,
            ])
            ->with('success', 'Colors saved for this print-ready, PDF, or Word file.');
    }
}
