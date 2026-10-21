<?php

namespace App\Support;

use App\Models\Bid;
use App\Models\PrintLayout;
use App\Models\Quotation;

class QuotationPrintLayoutSync
{
    public static function refresh(PrintLayout $layout): int
    {
        $payload = PrintLayoutCatalog::payload($layout);
        $html = self::headerHtml(
            $payload['elements'],
            $payload['headerBackground'],
            (int) round((float) $payload['headerHeight']),
        );
        $snapshot = [
            'elements' => $payload['elements'],
            'header_height' => $payload['headerHeight'],
            'header_background' => $payload['headerBackground'],
            'text_case' => $payload['textCase'],
        ];
        $version = PrintLayoutCatalog::version($layout);
        $count = 0;

        Quotation::query()
            ->where('print_layout_id', $layout->id)
            ->orderBy('id')
            ->each(function (Quotation $quotation) use ($snapshot, $html, $version, &$count): void {
                $quotation->update([
                    'print_layout_version' => $version,
                    'layout_elements' => $snapshot,
                    'layout_header' => $html,
                ]);
                $count++;
            });

        Bid::query()
            ->where('print_layout_id', $layout->id)
            ->orderBy('id')
            ->each(function (Bid $bid) use ($snapshot, $version): void {
                $bid->update([
                    'print_layout_version' => $version,
                    'layout_elements' => $snapshot,
                ]);
            });

        return $count;
    }

    public static function detach(PrintLayout $layout): int
    {
        $cleared = Quotation::query()
            ->where('print_layout_id', $layout->id)
            ->update([
                'print_layout_id' => null,
                'print_layout_version' => null,
                'layout_elements' => null,
                'layout_header' => null,
            ]);

        Bid::query()
            ->where('print_layout_id', $layout->id)
            ->update([
                'print_layout_id' => null,
                'print_layout_version' => null,
                'layout_elements' => null,
            ]);

        return $cleared;
    }

    /**
     * @param  list<array<string, mixed>>  $elements
     */
    private static function headerHtml(array $elements, string $background, int $headerHeight): ?string
    {
        $values = [];
        foreach (DocumentLayoutElements::fieldCatalog() as $field) {
            $values[$field['key']] = '{{'.$field['key'].'}}';
        }

        $html = DocumentLayoutElements::render($elements, 'header', $background, $values, '', $headerHeight);
        if ($html === '') {
            return null;
        }

        $html = preg_replace_callback(
            '/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/',
            static fn (array $match): string => '{{'.strtolower($match[1]).'}}',
            $html,
        ) ?? $html;

        return BidApplicationText::sanitize($html);
    }
}
