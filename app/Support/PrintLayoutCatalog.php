<?php

namespace App\Support;

use App\Models\PrintLayout;

class PrintLayoutCatalog
{
    /** @return array{printLayouts: array, assignedPrintLayoutId: ?int} */
    public static function forDocument(string $document): array
    {
        $keys = array_map(
            fn (string $format): string => DocumentAppearance::key($document, $format),
            array_keys(DocumentAppearance::FORMATS),
        );

        return [
            'printLayouts' => PrintLayout::query()
                ->where(function ($query) use ($document): void {
                    $query->where('layout_type', $document)->orWhereNull('layout_type');
                })
                ->whereHas('assignments', fn ($query) => $query->whereIn('document_key', $keys))
                ->orderBy('name')->get()
                ->map(fn (PrintLayout $layout): array => [
                    ...self::payload($layout),
                    'version' => self::version($layout),
                ])->values()->all(),
            'assignedPrintLayoutId' => DocumentAppearance::assignedLayoutId($document, 'print'),
        ];
    }

    /** @return array{id: int, name: string, elements: array, headerHeight: int|float, headerBackground: string, tableHeaderBackground: string, textCase: string} */
    public static function payload(PrintLayout $layout): array
    {
        return [
            'id' => $layout->id,
            'name' => $layout->name,
            'elements' => DocumentLayoutElements::sanitize($layout->design['elements'] ?? []),
            'headerHeight' => DocumentLayoutElements::zoneColors($layout->design['zone_colors'] ?? [])['header_height'],
            'headerBackground' => DocumentAppearance::normalize($layout->header_background_color),
            'tableHeaderBackground' => DocumentAppearance::normalize($layout->table_header_background_color),
            'textCase' => DocumentTextCase::normalize($layout->text_case),
        ];
    }

    public static function version(PrintLayout $layout): string
    {
        return hash('sha256', json_encode(self::payload($layout), JSON_THROW_ON_ERROR));
    }
}
