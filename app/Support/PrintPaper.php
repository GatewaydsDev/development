<?php

namespace App\Support;

use App\Models\PrintLayout;

class PrintPaper
{
    public const PIXEL_WIDTH = 700;

    /** @var array<string, array{label: string, width: float, height: float}> Millimetres, portrait. */
    public const SIZES = [
        'letter' => ['label' => 'Letter', 'width' => 215.9, 'height' => 279.4],
        'legal' => ['label' => 'Legal', 'width' => 215.9, 'height' => 355.6],
        'tabloid' => ['label' => 'Tabloid', 'width' => 279.4, 'height' => 431.8],
        'a3' => ['label' => 'A3', 'width' => 297.0, 'height' => 420.0],
        'a4' => ['label' => 'A4', 'width' => 210.0, 'height' => 297.0],
        'a5' => ['label' => 'A5', 'width' => 148.0, 'height' => 210.0],
    ];

    public static function normalize(?string $paper): string
    {
        $paper = strtolower((string) $paper);

        return array_key_exists($paper, self::SIZES) ? $paper : 'letter';
    }

    public static function orientation(?string $orientation): string
    {
        return $orientation === 'landscape' ? 'landscape' : 'portrait';
    }

    /**
     * @return array{width: float, height: float}
     */
    public static function millimeters(string $paper, string $orientation): array
    {
        $size = self::SIZES[self::normalize($paper)];
        $orientation = self::orientation($orientation);

        return $orientation === 'landscape'
            ? ['width' => $size['height'], 'height' => $size['width']]
            : ['width' => $size['width'], 'height' => $size['height']];
    }

    public static function pixelHeight(string $paper, string $orientation): float
    {
        $size = self::millimeters($paper, $orientation);

        return round(self::PIXEL_WIDTH * $size['height'] / $size['width'], 2);
    }

    /** Dompdf pixels per inch so the 700px layout width equals this sheet. */
    public static function dpi(string $paper, string $orientation): float
    {
        $size = self::millimeters($paper, $orientation);

        return round(self::PIXEL_WIDTH * 25.4 / $size['width'], 2);
    }

    /**
     * @return array{id: string, label: string, orientation: string, css: string, dompdf: string, width_mm: float, height_mm: float, pixel_height: float, dpi: float}
     */
    public static function describe(?string $paper, ?string $orientation): array
    {
        $id = self::normalize($paper);
        $orientation = self::orientation($orientation);
        $size = self::millimeters($id, $orientation);
        $cssName = match ($id) {
            'a3' => 'A3',
            'a4' => 'A4',
            'a5' => 'A5',
            default => $id,
        };

        return [
            'id' => $id,
            'label' => self::SIZES[$id]['label'],
            'orientation' => $orientation,
            'css' => $cssName.' '.$orientation,
            'dompdf' => $id,
            'width_mm' => $size['width'],
            'height_mm' => $size['height'],
            'pixel_height' => self::pixelHeight($id, $orientation),
            'dpi' => self::dpi($id, $orientation),
        ];
    }

    /**
     * @return array{id: string, label: string, orientation: string, css: string, dompdf: string, width_mm: float, height_mm: float, pixel_height: float, dpi: float}
     */
    public static function forLayout(?int $layoutId): array
    {
        $design = $layoutId ? PrintLayout::query()->find($layoutId)?->design : null;

        return self::describe(
            is_array($design) ? ($design['paper'] ?? null) : null,
            is_array($design) ? ($design['orientation'] ?? null) : null,
        );
    }

    /**
     * @return array<string, int|string>
     */
    public static function wordSection(?string $paper, ?string $orientation, bool $fullPage): array
    {
        $described = self::describe($paper, $orientation);
        $portrait = self::millimeters($described['id'], 'portrait');

        return [
            'orientation' => $described['orientation'],
            'pageSizeW' => (int) round($portrait['width'] / 25.4 * 1440),
            'pageSizeH' => (int) round($portrait['height'] / 25.4 * 1440),
            'marginTop' => $fullPage ? 0 : 720,
            'marginBottom' => $fullPage ? 0 : 720,
            'marginLeft' => $fullPage ? 0 : 720,
            'marginRight' => $fullPage ? 0 : 720,
            'headerHeight' => $fullPage ? 0 : 360,
            'footerHeight' => $fullPage ? 0 : 360,
        ];
    }
}
