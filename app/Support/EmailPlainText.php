<?php

namespace App\Support;

class EmailPlainText
{
    public static function fromGraph(?string $contentType, ?string $content): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", (string) $content);
        $looksLikeHtml = strcasecmp((string) $contentType, 'html') === 0
            || preg_match('/<\s*(html|body|div|p|br|img|script|style|a)\b/i', $text) === 1;

        if ($looksLikeHtml) {
            $text = preg_replace('/<(script|style)\b[^>]*>.*?<\/\1>/is', '', $text) ?? $text;
            $text = preg_replace('/<img\b[^>]*>/i', '', $text) ?? $text;
            $text = preg_replace('/<br\s*\/?>/i', "\n", $text) ?? $text;
            $text = preg_replace('/<\/(p|div|tr|h[1-6]|li)>/i', "\n", $text) ?? $text;
            $text = strip_tags($text);
            $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;

        return trim(mb_substr($text, 0, 100000));
    }

    public static function encodeMessageId(string $id): string
    {
        return rtrim(strtr(base64_encode($id), '+/', '-_'), '=');
    }

    public static function decodeMessageId(string $token): ?string
    {
        if ($token === '' || strlen($token) > 700 || preg_match('/^[A-Za-z0-9\-_]+$/', $token) !== 1) {
            return null;
        }

        $padded = strtr($token, '-_', '+/');
        $padded .= str_repeat('=', (4 - strlen($padded) % 4) % 4);
        $decoded = base64_decode($padded, true);

        if (! is_string($decoded) || $decoded === '' || strlen($decoded) > 512) {
            return null;
        }

        if (preg_match('/[\x00-\x1F]/', $decoded) === 1) {
            return null;
        }

        return $decoded;
    }
}
