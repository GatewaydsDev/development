<?php

namespace App\Support;

class OutboundMailHtml
{
    public static function document(string $html, string $subject): string
    {
        $html = self::prepare($html);

        if ($html === '') {
            $html = '<p></p>';
        }

        if (preg_match('/<html[\s>]/i', $html) === 1) {
            return $html;
        }

        $title = e($subject !== '' ? $subject : 'Message');

        return '<!DOCTYPE html><html lang="en"><head>'
            .'<meta http-equiv="Content-Type" content="text/html; charset=utf-8">'
            .'<meta name="viewport" content="width=device-width, initial-scale=1">'
            .'<meta name="color-scheme" content="light">'
            .'<meta name="supported-color-schemes" content="light">'
            .'<title>'.$title.'</title></head>'
            .'<body style="margin:0;padding:0;background:#f4f7f5;">'
            .'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f7f5;border-collapse:collapse;">'
            .'<tr><td align="center" style="padding:24px 12px;">'
            .'<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-collapse:collapse;">'
            .'<tr><td style="padding:24px;font-family:Calibri,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111827;">'
            .$html
            .'</td></tr></table></td></tr></table></body></html>';
    }

    public static function prepare(string $html): string
    {
        $html = trim($html);
        $html = preg_replace('#<script\b[^>]*>.*?</script>#is', '', $html) ?? $html;
        $html = preg_replace('#javascript:#i', '', $html) ?? $html;
        $html = preg_replace('/display\s*:\s*none\s*;?/i', '', $html) ?? $html;
        $html = preg_replace('/visibility\s*:\s*hidden\s*;?/i', '', $html) ?? $html;
        $html = preg_replace('/opacity\s*:\s*0(?:\.0+)?\s*;?/i', '', $html) ?? $html;
        $html = preg_replace('/font-size\s*:\s*0(?:px|pt|em|rem)?\s*;?/i', '', $html) ?? $html;
        $html = preg_replace_callback('#<img\b[^>]*>#i', fn (array $match): string => self::imageTag($match[0]), $html) ?? $html;

        return trim($html);
    }

    private static function imageTag(string $tag): string
    {
        if (preg_match('/\bsrc\s*=\s*(["\'])(.*?)\1/i', $tag, $srcMatch) !== 1) {
            return '';
        }

        $src = self::absolute(html_entity_decode($srcMatch[2], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $lower = strtolower($src);

        if ($src === '' || str_starts_with($lower, 'javascript:') || str_starts_with($lower, 'data:')) {
            return '';
        }

        if (self::isCompanyLogo($src)) {
            return '<img src="'.e($src).'" alt="Gateway Door Systems" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;background:#050505;">';
        }

        $alt = '';

        if (preg_match('/\balt\s*=\s*(["\'])(.*?)\1/i', $tag, $altMatch) === 1) {
            $alt = trim(strip_tags(html_entity_decode($altMatch[2], ENT_QUOTES | ENT_HTML5, 'UTF-8')));
        }

        return '<img src="'.e($src).'" alt="'.e(mb_substr($alt, 0, 120)).'" style="max-width:100%;height:auto;border:0;">';
    }

    private static function isCompanyLogo(string $src): bool
    {
        $path = rawurldecode((string) (parse_url($src, PHP_URL_PATH) ?? ''));

        return $path === '/images/Gateway_Door_Systems_Logo.png';
    }

    private static function absolute(string $src): string
    {
        $src = trim($src);

        if (str_starts_with($src, '/')) {
            return rtrim((string) config('app.url'), '/').$src;
        }

        return $src;
    }
}
