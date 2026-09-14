<?php

namespace App\Support;

use App\Models\Company;
use PhpOffice\PhpWord\Element\AbstractContainer;

class DocumentLogo
{
    public static function company(): ?Company
    {
        return Company::query()->where('is_active', true)->latest()->first()
            ?? Company::query()->latest()->first();
    }

    public static function src(string $mode = 'print'): ?string
    {
        $path = self::filePath($mode);

        if ($path === null) {
            return null;
        }

        $binary = file_get_contents($path);

        if ($binary === false || $binary === '') {
            return null;
        }

        $mime = mime_content_type($path) ?: 'image/png';
        $isWebp = $mime === 'image/webp' || str_ends_with(strtolower($path), '.webp');

        if ($mode === 'pdf' && $isWebp) {
            $png = self::webpToPng($path);

            if ($png !== null) {
                return 'data:image/png;base64,'.base64_encode($png);
            }

            $fallback = public_path('images/App-Logo.png');

            if (is_file($fallback)) {
                $pngBinary = file_get_contents($fallback);

                if (is_string($pngBinary) && $pngBinary !== '') {
                    return 'data:image/png;base64,'.base64_encode($pngBinary);
                }
            }
        }

        return 'data:'.$mime.';base64,'.base64_encode($binary);
    }

    public static function wordPath(): ?string
    {
        $source = self::filePath('pdf');

        if ($source === null) {
            return null;
        }

        $isWebp = str_ends_with(strtolower($source), '.webp');
        $binary = $isWebp ? self::webpToPng($source) : file_get_contents($source);

        if (! is_string($binary) || $binary === '') {
            $fallback = public_path('images/App-Logo.png');
            $binary = is_file($fallback) ? file_get_contents($fallback) : false;
        }

        if (! is_string($binary) || $binary === '') {
            return null;
        }

        $temp = tempnam(sys_get_temp_dir(), 'gds-logo-');

        if ($temp === false) {
            return null;
        }

        $path = $temp.'.png';
        @unlink($temp);
        file_put_contents($path, $binary);

        return $path;
    }

    /**
     * @param  AbstractContainer  $container
     */
    public static function addWordImage($container, string $path, int $height = 56): void
    {
        $container->addImage($path, [
            'height' => $height,
            'ratio' => true,
        ]);
    }

    private static function filePath(string $mode): ?string
    {
        $candidates = [
            public_path('images/App-Logo.webp'),
            public_path('images/App-Logo.png'),
        ];

        foreach ($candidates as $path) {
            if (! is_file($path)) {
                continue;
            }

            $isWebp = str_ends_with(strtolower($path), '.webp');

            if ($mode === 'pdf' && $isWebp && ! function_exists('imagecreatefromwebp')) {
                continue;
            }

            return $path;
        }

        return null;
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
