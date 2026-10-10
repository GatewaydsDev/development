<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class ImportedPdfFont
{
    public static function family(mixed $src): ?string
    {
        return is_string($src) && preg_match('#^/storage/editor-fonts/([a-f0-9]{64})\.ttf$#', $src, $match) === 1
            ? 'PDF_'.$match[1] : null;
    }

    public static function styles(string $html, string $mode): string
    {
        preg_match_all('/data-pdf-font-src="([^"]+)"/', $html, $matches);
        $css = str_contains($html, 'data-pdf-page="true"')
            ? '[data-pdf-page="true"]{page-break-inside:avoid;}[data-pdf-page="true"]~[data-pdf-page="true"]{page-break-before:always;}' : '';
        foreach (array_unique($matches[1]) as $src) {
            $family = self::family($src);
            $path = $family ? Storage::disk('public')->path(substr($src, strlen('/storage/'))) : null;
            if (! $path || ! is_file($path)) {
                continue;
            }
            $url = $mode === 'pdf' ? 'file://'.$path : $src;
            foreach ($mode === 'pdf' ? ['normal', 'bold'] : ['normal'] as $weight) {
                foreach ($mode === 'pdf' ? ['normal', 'italic'] : ['normal'] as $style) {
                    $css .= "@font-face{font-family:'{$family}';font-weight:{$weight};font-style:{$style};src:url('{$url}') format('truetype');}";
                }
            }
        }

        return $css ? '<style>'.$css.'</style>'.$html : $html;
    }
}
