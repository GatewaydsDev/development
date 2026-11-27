<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Smalot\PdfParser\Parser;
use Throwable;

class AddendumDocumentReader
{
    /**
     * @return array{number: ?string, issued_on: ?string, notes: ?string, bid_date: ?string, bid_time: ?string, readable: bool}
     */
    public static function read(UploadedFile $file): array
    {
        set_time_limit(12);
        $text = self::documentText($file);

        return [
            ...self::fromText($text, $file->getClientOriginalName()),
            'readable' => trim(self::plain($text)) !== '',
        ];
    }

    /**
     * @return array{number: ?string, issued_on: ?string, notes: ?string, bid_date: ?string, bid_time: ?string}
     */
    public static function fromText(string $text, string $filename = ''): array
    {
        $text = self::plain($text);
        $prepared = self::prepare($text);
        $name = self::prepare(trim(str_replace(['_', '-'], ' ', pathinfo($filename, PATHINFO_FILENAME))));
        $flat = self::flatten($prepared);
        $number = self::number($prepared) ?? self::number($name);
        $bidWindow = self::windowAfter($flat, self::bidLabel());

        return [
            'number' => $number,
            'issued_on' => self::issuedOn($prepared, $name, $number),
            'notes' => self::notes($text),
            'bid_date' => $bidWindow ? self::firstDate($bidWindow) : null,
            'bid_time' => $bidWindow ? self::time($bidWindow) : null,
        ];
    }

    private static function documentText(UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        if ($path === false) {
            return '';
        }

        try {
            return match ($extension) {
                'csv' => (string) file_get_contents($path),
                'xlsx' => self::spreadsheetText($path),
                'pdf' => self::pdfText($path),
                'txt', 'text', 'md', 'html', 'htm', 'doc', 'docx', 'rtf', 'odt' => BidApplicationText::fromUploadedFile($file),
                default => '',
            };
        } catch (ValidationException|Throwable) {
            return '';
        }
    }

    private static function pdfText(string $path): string
    {
        $pdf = (new Parser)->parseFile($path);
        $text = mb_substr($pdf->getText(1), 0, 12000);
        $text .= "\n".self::formText($pdf);
        $text .= "\n".self::pageLiterals($pdf);
        $details = $pdf->getDetails();

        foreach (['Title', 'Subject'] as $key) {
            $value = $details[$key] ?? null;

            if (is_string($value) && trim($value) !== '') {
                $text .= "\n".$value;
            }
        }

        return $text;
    }

    private static function formText(\Smalot\PdfParser\Document $pdf): string
    {
        $lines = [];

        foreach ($pdf->getObjects() as $object) {
            if (count($lines) >= 40) {
                break;
            }

            if (! $object instanceof \Smalot\PdfParser\PDFObject) {
                continue;
            }

            try {
                $header = $object->getHeader();

                if ($header === null || ! $header->has('T') || ! $header->has('V')) {
                    continue;
                }

                $name = trim(preg_replace('/\s+/', ' ', (string) $header->get('T')) ?? '');
                $value = trim(preg_replace('/\s+/', ' ', (string) $header->get('V')) ?? '');
            } catch (Throwable) {
                continue;
            }

            if ($name === '' || $value === '' || mb_strlen($value) > 180) {
                continue;
            }

            $lines[] = $name.': '.$value;
        }

        return implode("\n", $lines);
    }

    private static function pageLiterals(\Smalot\PdfParser\Document $pdf): string
    {
        $page = $pdf->getPages()[0] ?? null;

        if ($page === null) {
            return '';
        }

        try {
            $raw = self::contentStream($page->get('Contents'));
        } catch (Throwable) {
            return '';
        }

        return self::pdfLiterals($raw);
    }

    private static function contentStream(mixed $contents): string
    {
        if ($contents instanceof \Smalot\PdfParser\PDFObject) {
            $header = $contents->getHeader();
            $elements = $header?->getElements() ?? [];

            if (is_numeric(array_key_first($elements))) {
                $raw = '';

                foreach ($elements as $element) {
                    $raw .= "\n".self::contentStream($element);
                }

                return $raw;
            }

            return (string) $contents->getContent();
        }

        if ($contents instanceof \Smalot\PdfParser\Element\ElementArray) {
            $raw = '';

            foreach ($contents->getContent() as $element) {
                $raw .= "\n".self::contentStream($element);
            }

            return $raw;
        }

        if ($contents instanceof \Smalot\PdfParser\Element\ElementXRef) {
            return self::contentStream($contents->getObject());
        }

        return '';
    }

    private static function pdfLiterals(string $raw): string
    {
        if ($raw === '') {
            return '';
        }

        $raw = substr($raw, 0, 200000);
        $parts = [];

        if (preg_match_all('/\(((?:\\\\.|[^\\\\)])*)\)/s', $raw, $matches) > 0) {
            foreach ($matches[1] as $literal) {
                $parts[] = self::unescapePdfString($literal);
            }
        }

        if (preg_match_all('/<([0-9A-Fa-f\s]{4,400})>/', $raw, $hexes) > 0) {
            foreach ($hexes[1] as $hex) {
                $decoded = self::decodePdfHex($hex);

                if ($decoded !== '') {
                    $parts[] = $decoded;
                }
            }
        }

        $kept = array_values(array_filter(
            $parts,
            fn (string $part): bool => preg_match('/addend|issue|dated|\bdate\b|\d{1,2}[\/\-.]\d{1,2}|\d{4}/i', $part) === 1,
        ));

        return implode("\n", array_slice($kept, 0, 80));
    }

    private static function unescapePdfString(string $value): string
    {
        $value = preg_replace_callback(
            '/\\\\([nrtbf()\\\\]|[0-7]{1,3})/s',
            function (array $match): string {
                return match ($match[1]) {
                    'n' => "\n",
                    'r' => "\r",
                    't' => "\t",
                    'b', 'f' => '',
                    '(', ')', '\\' => $match[1],
                    default => chr(octdec($match[1])),
                };
            },
            $value,
        ) ?? $value;

        return trim($value);
    }

    private static function decodePdfHex(string $hex): string
    {
        $hex = preg_replace('/\s+/', '', $hex) ?? '';

        if ($hex === '' || strlen($hex) % 2 !== 0) {
            return '';
        }

        $bytes = hex2bin($hex);

        if ($bytes === false) {
            return '';
        }

        if (str_starts_with($bytes, "\xFE\xFF")) {
            $converted = mb_convert_encoding(substr($bytes, 2), 'UTF-8', 'UTF-16BE');
            $bytes = is_string($converted) ? $converted : '';
        }

        $text = preg_replace('/[^\P{C}\n]+/u', '', $bytes) ?? '';

        return trim($text);
    }

    private static function spreadsheetText(string $path): string
    {
        if (! class_exists(\ZipArchive::class)) {
            return '';
        }

        $zip = new \ZipArchive;

        if ($zip->open($path) !== true) {
            return '';
        }

        $shared = (string) $zip->getFromName('xl/sharedStrings.xml');
        $sheet = (string) $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();
        $parts = [];

        if (preg_match_all('/<t[^>]*>(.*?)<\/t>/s', $shared.$sheet, $matches) > 0) {
            $parts = array_map(
                fn (string $value): string => html_entity_decode(strip_tags($value)),
                $matches[1],
            );
        }

        return implode("\n", $parts);
    }

    private static function plain(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/<(br|\/p|\/div|\/tr|\/h[1-6])\b[^>]*>/i', "\n", $text) ?? $text;
        $text = html_entity_decode(strip_tags($text));
        $text = preg_replace("/[ \t]+/", ' ', $text) ?? $text;
        $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;

        return trim($text);
    }

    private static function number(string $text): ?string
    {
        $lines = preg_split('/\n/', $text) ?: [];
        $fallback = null;

        foreach ($lines as $index => $line) {
            $line = trim($line);

            if ($line === '' || mb_strlen($line) > 80) {
                continue;
            }

            if (preg_match('/^addend(?:um|a)\s*(?:no\.?|number|#)\s*[:#.\-]?\s*([A-Za-z]?\d{1,4}[A-Za-z]?)\b/i', $line, $match) !== 1) {
                continue;
            }

            if (preg_match('/\bdated\b/i', $line) === 1) {
                continue;
            }

            $number = self::cleanNumber($match[1]);
            $fallback ??= $number;
            $nearby = $line."\n".trim($lines[$index + 1] ?? '')."\n".trim($lines[$index + 2] ?? '');

            if (preg_match('/\bdate\b/i', $nearby) === 1 && self::blockedContext($line) === false) {
                return $number;
            }
        }

        if ($fallback !== null) {
            return $fallback;
        }

        if (preg_match_all('/\baddend(?:um|a)\s*(?:no\.?|number|#)\s*[:#.\-]?\s*([A-Za-z]?\d{1,4}[A-Za-z]?)\b/i', $text, $matches, PREG_OFFSET_CAPTURE) < 1) {
            return null;
        }

        foreach ($matches[0] as $index => [$label, $offset]) {
            $after = substr($text, $offset, strlen($label) + 16);

            if (preg_match('/\bdated\b/i', $after) === 1) {
                continue;
            }

            return self::cleanNumber($matches[1][$index][0]);
        }

        return self::cleanNumber($matches[1][array_key_last($matches[1])][0]);
    }

    private static function cleanNumber(string $number): string
    {
        if (preg_match('/^\d+$/', $number) === 1) {
            return ltrim($number, '0') ?: '0';
        }

        return $number;
    }

    private static function prepare(string $text): string
    {
        $text = self::repairDrawnDates($text);
        $text = str_replace(
            ["\u{2044}", "\u{2215}", "\u{FF0F}", "\u{2013}", "\u{2014}", "\u{00A0}"],
            ['/', '/', '/', '-', '-', ' '],
            $text,
        );
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/\s*\/\s*/', '/', $text) ?? $text;
        $text = preg_replace('/(?<=\p{L})(?=\d)/u', ' ', $text) ?? $text;
        $text = preg_replace('/(?<=\d)(?=\p{L})(?!(?:st|nd|rd|th)\b)/iu', ' ', $text) ?? $text;
        $text = preg_replace('/,(?=\d)/', ', ', $text) ?? $text;
        $text = preg_replace('/[^\S\n]+/', ' ', $text) ?? $text;

        return trim($text);
    }

    private static function flatten(string $text): string
    {
        $text = self::prepare($text);
        $text = str_replace(
            ["\u{2044}", "\u{2215}", "\u{FF0F}", "\u{2013}", "\u{2014}", "\u{00A0}"],
            ['/', '/', '/', '-', '-', ' '],
            $text,
        );
        $text = str_replace(["\r\n", "\r", "\n", "\t"], ' ', $text);
        $text = preg_replace('/\s*\/\s*/', '/', $text) ?? $text;
        $text = preg_replace('/(?<=\p{L})(?=\d)/u', ' ', $text) ?? $text;
        $text = preg_replace('/(?<=\d)(?=\p{L})(?!(?:st|nd|rd|th)\b)/iu', ' ', $text) ?? $text;
        $text = preg_replace('/,(?=\d)/', ', ', $text) ?? $text;
        $text = preg_replace('/\s+/', ' ', $text) ?? $text;

        return trim($text);
    }

    private static function repairDrawnDates(string $text): string
    {
        $months = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
        $text = preg_replace_callback(
            '/\b(?:[A-Za-z]\s+){2,12}[A-Za-z]\b/',
            function (array $match) use ($months): string {
                $word = preg_replace('/\s+/', '', $match[0]) ?? $match[0];

                return preg_match('/^(?:'.$months.')$/i', $word) === 1 ? $word : $match[0];
            },
            $text,
        ) ?? $text;
        $text = preg_replace_callback(
            '/\d(?:\s*\d)*(?:\s*[\/\-.]\s*\d(?:\s*\d)*){1,2}/',
            function (array $match): string {
                if (preg_match('/^(\d+)\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})$/', $match[0], $split) === 1) {
                    return $split[1].' '.$split[2];
                }

                return preg_replace('/\s+/', '', $match[0]) ?? $match[0];
            },
            $text,
        ) ?? $text;
        $text = preg_replace_callback(
            '/(?:\d\s+){0,2}\d\s+(?:'.$months.')\.?(?:\s+\d){1,6}|(?:'.$months.')\.?\s+(?:\d\s+){1,6}\d/i',
            fn (array $match): string => preg_replace('/(?<=\d)\s+(?=\d)/', '', $match[0]) ?? $match[0],
            $text,
        ) ?? $text;

        return $text;
    }

    private static function issuedOn(string $text, string $filename, ?string $number): ?string
    {
        $explicit = self::dateBesideLabel(
            $text,
            '/(?:date\s+of\s+issue|issue\s+date|date\s+issued|addendum\s+date|date\s+of\s+addendum|issued\s+on|issued\s+this)\b\s*[:#.\-]*/i',
        );

        if ($explicit !== null) {
            return $explicit;
        }

        $forThisAddendum = self::dateForThisAddendum($text, $number);

        if ($forThisAddendum !== null) {
            return $forThisAddendum;
        }

        $onlyHeader = self::onlyHeaderDate($text);

        if ($onlyHeader !== null) {
            return $onlyHeader;
        }

        if (preg_match('/addend/i', $filename) === 1) {
            return self::firstDate($filename);
        }

        return null;
    }

    private static function dateForThisAddendum(string $text, ?string $number): ?string
    {
        $patterns = [];

        if ($number !== null && $number !== '') {
            $patterns[] = '/addend(?:um|a)\s*(?:no\.?|number|#)?\s*[:#.\-]?\s*'.preg_quote($number, '/').'\b/i';
        }

        $patterns[] = '/addend(?:um|a)\s*(?:no\.?|number|#)\s*[:#.\-]?\s*[A-Za-z]?\d{1,4}[A-Za-z]?\b/i';

        foreach ($patterns as $index => $pattern) {
            if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE) < 1) {
                continue;
            }

            foreach ($matches[0] as [$label, $offset]) {
                $window = substr($text, $offset + strlen($label), 220);
                $window = preg_split('/addend(?:um|a)\s*(?:no\.?|number|#)/i', $window, 2)[0] ?? $window;
                $date = self::labeledDate($window) ?? self::immediateDate($window);

                if ($date !== null) {
                    return $date;
                }
            }

            if ($index === 0 && $number !== null && $number !== '') {
                break;
            }
        }

        return null;
    }

    private static function labeledDate(string $window): ?string
    {
        $pattern = '/(?:date\s+of\s+issue|issue\s+date|date\s+issued|addendum\s+date|(?<!bid\s)(?<!due\s)(?<!revision\s)\bdate)\b\s*[:#.\-]*/i';

        if (preg_match_all($pattern, $window, $matches, PREG_OFFSET_CAPTURE) < 1) {
            return null;
        }

        foreach ($matches[0] as [$label, $offset]) {
            $before = substr($window, max(0, $offset - 30), min(30, $offset));
            $after = substr($window, $offset + strlen($label), 70);
            $dates = self::allDates($after);

            if ($dates === []) {
                continue;
            }

            $span = substr($after, 0, $dates[0]['offset']);

            if (self::blockedContext($before.' '.$span)) {
                continue;
            }

            return $dates[0]['value'];
        }

        return null;
    }

    private static function immediateDate(string $window): ?string
    {
        $dates = self::allDates($window);

        if ($dates === [] || $dates[0]['offset'] > 40) {
            return null;
        }

        if (self::blockedContext(substr($window, 0, $dates[0]['offset']))) {
            return null;
        }

        return $dates[0]['value'];
    }

    private static function onlyHeaderDate(string $text): ?string
    {
        $found = [];

        foreach (preg_split('/\n/', $text) ?: [] as $line) {
            $line = trim($line);

            if ($line === '' || mb_strlen($line) > 80 || self::blockedContext($line)) {
                continue;
            }

            if (preg_match('/^(?:date\s+of\s+issue|issue\s+date|date\s+issued|addendum\s+date|date)\s*[:#.\-]\s+\S+/i', $line) !== 1) {
                continue;
            }

            $date = self::firstDate($line);

            if ($date !== null) {
                $found[$date] = $date;
            }
        }

        return count($found) === 1 ? array_key_first($found) : null;
    }

    private static function dateBesideLabel(string $text, string $pattern): ?string
    {
        if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE) < 1) {
            return null;
        }

        foreach ($matches[0] as [$label, $offset]) {
            $before = substr($text, max(0, $offset - 40), min(40, $offset));

            if (self::blockedContext($before)) {
                continue;
            }

            $after = substr($text, $offset + strlen($label), 180);
            $dates = self::allDates($after);

            if ($dates !== []) {
                $span = substr($after, 0, $dates[0]['offset']);

                if (! self::blockedContext($span)) {
                    return $dates[0]['value'];
                }
            }

            $date = self::firstDate($before);

            if ($date !== null && ! self::blockedContext($before)) {
                return $date;
            }
        }

        return null;
    }

    private static function blockedContext(string $text): bool
    {
        return preg_match('/\b(?:bids?|due|revisions?|rev|original|bidding|contracts?|drawings?|previous|plot|printed)\b/i', $text) === 1;
    }

    private static function notes(string $text): ?string
    {
        $lines = preg_split('/\R/', $text) ?: [];
        $found = [];

        foreach ($lines as $index => $line) {
            $line = trim($line);

            if (preg_match('/^(subject|description|purpose|summary|scope(?:\s+of\s+(?:this\s+)?addendum)?|revisions?|changes?)\s*[:\-]\s*(.*)$/i', $line, $match) !== 1) {
                continue;
            }

            $value = trim($match[2]);

            if ($value === '' && isset($lines[$index + 1])) {
                $value = trim($lines[$index + 1]);
            }

            if ($value !== '') {
                $found[] = $value;
            }
        }

        if ($found === []) {
            $paragraphs = preg_split("/\n\s*\n/", $text) ?: [];

            foreach ($paragraphs as $paragraph) {
                $paragraph = trim(preg_replace('/\s+/', ' ', $paragraph) ?? $paragraph);

                if (mb_strlen($paragraph) < 40 || (preg_match('/^addend/i', $paragraph) === 1 && mb_strlen($paragraph) < 90)) {
                    continue;
                }

                $found[] = mb_substr($paragraph, 0, 600);
                break;
            }
        }

        if ($found === []) {
            return null;
        }

        return collect(array_slice($found, 0, 4))
            ->map(fn (string $part): string => '<p>'.e(mb_substr($part, 0, 500)).'</p>')
            ->implode('');
    }

    private static function windowAfter(string $text, string $pattern): ?string
    {
        if (preg_match($pattern, $text, $match, PREG_OFFSET_CAPTURE) !== 1) {
            return null;
        }

        $offset = $match[0][1] + strlen($match[0][0]);

        return substr($text, $offset, 90);
    }

    private static function bidLabel(): string
    {
        return '/\b(?:revised\s+bid\s+date|new\s+bid\s+date|bid\s+due\s+date|bids?\s+are\s+due|bids?\s+due|bid\s+date|bid\s+opening|due\s+date)\b\s*[:\-]?/i';
    }

    private static function firstDate(string $text): ?string
    {
        return self::allDates($text)[0]['value'] ?? null;
    }

    /**
     * @return list<array{value: string, offset: int}>
     */
    private static function allDates(string $text): array
    {
        $months = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
        $patterns = [
            '/\b\d{1,2}(?:st|nd|rd|th)?\s+day\s+of\s+(?:'.$months.')\.?,?\s+\d{4}\b/i',
            '/\b(?:'.$months.')\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/i',
            '/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:'.$months.')\.?,?\s+\d{4}\b/i',
            '/\b\d{1,2}[-\/](?:'.$months.')\.?[-\/]\d{2,4}\b/i',
            '/\b(?:'.$months.')\.?[-\/]\d{1,2}[-\/]\d{2,4}\b/i',
            '/\b\d{4}-\d{2}-\d{2}\b/',
            '/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/',
        ];
        $found = [];

        foreach ($patterns as $pattern) {
            if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE) < 1) {
                continue;
            }

            foreach ($matches[0] as [$raw, $offset]) {
                $value = self::normalizeDate($raw);

                if ($value === null) {
                    continue;
                }

                foreach ($found as $existing) {
                    if ($offset < $existing['offset'] + 12 && $existing['offset'] < $offset + strlen($raw)) {
                        continue 2;
                    }
                }

                $found[] = ['value' => $value, 'offset' => $offset];
            }
        }

        usort($found, fn (array $left, array $right): int => $left['offset'] <=> $right['offset']);

        return $found;
    }

    private static function normalizeDate(string $value): ?string
    {
        $value = trim(preg_replace('/(\d)(?:st|nd|rd|th)/i', '$1', $value) ?? $value);
        $value = preg_replace('/\s+day\s+of\s+/i', ' ', $value) ?? $value;

        if (preg_match('/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/', $value, $match) === 1) {
            $month = (int) $match[1];
            $day = (int) $match[2];
            $year = (int) $match[3];

            if ($month > 12 && $day <= 12) {
                [$month, $day] = [$day, $month];
            }

            if ($year < 100) {
                $year += $year < 70 ? 2000 : 1900;
            }

            if (! checkdate($month, $day, $year)) {
                return null;
            }

            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }

        if (preg_match('/\p{L}/u', $value) === 1) {
            if (preg_match('/\b(\d{2})$/', $value, $year) === 1 && preg_match('/\d{4}/', $value) !== 1) {
                $full = ((int) $year[1] < 70 ? 2000 : 1900) + (int) $year[1];
                $value = preg_replace('/\d{2}$/', (string) $full, $value) ?? $value;
            }

            $value = str_replace(['/', '-'], ' ', $value);
            $value = preg_replace('/\s+/', ' ', $value) ?? $value;
        }

        try {
            $date = Carbon::parse($value);
        } catch (Throwable) {
            return null;
        }

        if ($date->year < 1990 || $date->year > 2100) {
            return null;
        }

        return $date->toDateString();
    }

    private static function time(string $text): ?string
    {
        if (preg_match('/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/i', $text, $match) === 1) {
            $hour = (int) $match[1];
            $minute = (int) $match[2];
            $meridiem = strtolower($match[3] ?? '');
        } elseif (preg_match('/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/i', $text, $match) === 1) {
            $hour = (int) $match[1];
            $minute = 0;
            $meridiem = strtolower($match[2]);
        } else {
            return null;
        }

        if ($minute > 59 || $hour > 23) {
            return null;
        }

        if (str_starts_with($meridiem, 'p') && $hour < 12) {
            $hour += 12;
        }

        if (str_starts_with($meridiem, 'a') && $hour === 12) {
            $hour = 0;
        }

        if ($hour > 23) {
            return null;
        }

        return sprintf('%02d:%02d', $hour, $minute);
    }
}
