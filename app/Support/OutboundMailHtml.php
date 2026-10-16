<?php

namespace App\Support;

class OutboundMailHtml
{
    public static function document(string $html, string $subject): string
    {
        $html = trim($html);

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
            .'<title>'.$title.'</title></head>'
            .'<body style="margin:0;padding:16px;font-family:Calibri,Arial,sans-serif;font-size:16px;line-height:1.45;color:#111827;">'
            .$html
            .'</body></html>';
    }
}
