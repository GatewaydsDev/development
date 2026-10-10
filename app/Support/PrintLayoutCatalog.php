<?php

namespace App\Support;

use App\Models\PrintLayout;

class PrintLayoutCatalog
{
    /** @return array{printLayouts: array, assignedPrintLayoutId: ?int} */
    public static function forDocument(string $document): array
    {
        return [
            'printLayouts' => PrintLayout::query()
                ->whereHas('assignments', fn ($query) => $query->whereIn(
                    'document_key',
                    array_map(fn (string $format): string => DocumentAppearance::key($document, $format), array_keys(DocumentAppearance::FORMATS)),
                ))
                ->orderBy('name')->get()
                ->map(function (PrintLayout $layout): array {
                    $payload = [
                        'id' => $layout->id,
                        'name' => $layout->name,
                        'elements' => DocumentLayoutElements::sanitize($layout->design['elements'] ?? []),
                        'headerHeight' => DocumentLayoutElements::zoneColors($layout->design['zone_colors'] ?? [])['header_height'],
                        'headerBackground' => DocumentAppearance::normalize($layout->header_background_color),
                        'tableHeaderBackground' => DocumentAppearance::normalize($layout->table_header_background_color),
                        'textCase' => DocumentTextCase::normalize($layout->text_case),
                    ];

                    return [...$payload, 'version' => hash('sha256', json_encode($payload, JSON_THROW_ON_ERROR))];
                })->values()->all(),
            'assignedPrintLayoutId' => DocumentAppearance::assignedLayoutId($document, 'print'),
        ];
    }
}
