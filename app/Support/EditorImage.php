<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class EditorImage
{
    public static function isStoredSrc(string $src): bool
    {
        return preg_match('#^/storage/editor-images/[A-Za-z0-9][A-Za-z0-9._-]*$#', $src) === 1;
    }

    public static function absolutePath(string $src): ?string
    {
        if (! self::isStoredSrc($src)) {
            return null;
        }

        $relative = substr($src, strlen('/storage/'));
        $path = Storage::disk('public')->path($relative);

        return is_file($path) ? $path : null;
    }

    public static function forDocument(string $html, string $mode): string
    {
        if ($mode === 'print' || ! str_contains($html, '/storage/editor-images/')) {
            return $html;
        }

        $rewritten = preg_replace_callback(
            '/(<img\b[^>]*\ssrc=")([^"]+)(")/i',
            function (array $matches) use ($mode): string {
                $next = self::srcForMode($matches[2], $mode);

                return $matches[1].htmlspecialchars($next, ENT_QUOTES | ENT_HTML5, 'UTF-8').$matches[3];
            },
            $html,
        );

        return is_string($rewritten) ? $rewritten : $html;
    }

    private static function srcForMode(string $src, string $mode): string
    {
        $path = self::absolutePath($src);

        if ($path === null) {
            return $src;
        }

        if ($mode === 'word') {
            return $path;
        }

        if ($mode === 'pdf') {
            return self::dataUri($path) ?? $src;
        }

        return $src;
    }

    private static function dataUri(string $path): ?string
    {
        $mime = mime_content_type($path) ?: '';
        $isWebp = $mime === 'image/webp' || str_ends_with(strtolower($path), '.webp');

        if ($isWebp) {
            $png = self::webpToPng($path);

            if ($png === null) {
                return null;
            }

            return 'data:image/png;base64,'.base64_encode($png);
        }

        $binary = file_get_contents($path);

        if ($binary === false || $binary === '') {
            return null;
        }

        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/gif'], true)) {
            $mime = 'image/jpeg';
        }

        return 'data:'.$mime.';base64,'.base64_encode($binary);
    }

    private static function webpToPng(string $path): ?string
    {
        if (! function_exists('imagecreatefromwebp') || ! function_exists('imagepng')) {
            return null;
        }

        $image = @imagecreatefromwebp($path);

        if ($image === false) {
            return null;
        }

        ob_start();
        imagepng($image);
        imagedestroy($image);
        $png = ob_get_clean();

        return is_string($png) && $png !== '' ? $png : null;
    }
}
