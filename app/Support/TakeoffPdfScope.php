<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Smalot\PdfParser\Parser;
use Throwable;

class TakeoffPdfScope
{
    /**
     * @return array{
     *     sheet_number: ?string,
     *     sheet_title: ?string,
     *     revision_label: ?string,
     *     document_type: string,
     *     page_count: ?int,
     *     openings: list<array<string, mixed>>,
     *     notes: list<string>
     * }
     */
    public static function read(string $path, ?callable $progress = null): array
    {
        self::raiseMemoryLimit();
        $last = 0;
        $report = function (int $percent, string $label) use ($progress, &$last): void {
            $percent = max($last, min(99, $percent));
            $last = $percent;

            if ($progress) {
                $progress($percent, $label);
            }
        };

        $report(4, 'Opening the drawing');

        try {
            $parsed = (new Parser)->parseFile($path);
            $pdfPages = array_values($parsed->getPages());
        } catch (Throwable) {
            return self::emptyResult('The PDF could not be read. Scanned or protected files need a text layer.');
        }

        $pages = [];
        $count = count($pdfPages);
        $limit = min($count, 30);
        $report(8, $limit > 0 ? 'Reading page 1 of '.$limit : 'Reading the drawing');

        foreach ($pdfPages as $index => $page) {
            if ($index >= 30) {
                break;
            }

            $box = self::mediaBox($page->getDetails());
            $items = [];

            foreach ($page->getDataTm() as $entry) {
                $matrix = $entry[0] ?? null;
                $text = trim((string) ($entry[1] ?? ''));

                if (! is_array($matrix) || $text === '') {
                    continue;
                }

                $items[] = [
                    'x' => (float) ($matrix[4] ?? 0),
                    'y' => (float) ($matrix[5] ?? 0),
                    'text' => $text,
                ];
            }

            $pages[] = [
                'page' => $index + 1,
                'width' => $box['width'],
                'height' => $box['height'],
                'origin_x' => $box['origin_x'],
                'origin_y' => $box['origin_y'],
                'items' => $items,
            ];
            $done = $index + 1;
            $report(8 + (int) floor($done / max(1, $limit) * 62), 'Reading page '.$done.' of '.$limit);
        }

        $result = self::fromPages($pages, $report);
        $result['page_count'] = $count > 0 ? $count : null;

        if ($count > 30) {
            $result['notes'][] = 'Only the first 30 pages were read.';
        }

        $report(97, 'Finishing the read');

        return $result;
    }

    /**
     * Read the text that falls inside a marked area of one page.
     * Coordinates are fractions of the page, with y measured from the top.
     *
     * @return array{title: string, body: string}
     */
    public static function clip(string $path, int $pageNumber, float $left, float $top, float $right, float $bottom, ?callable $progress = null): array
    {
        $blank = ['title' => '', 'body' => ''];
        $last = 0;
        $report = function (int $percent, string $label) use ($progress, &$last): void {
            $percent = max($last, min(99, $percent));
            $last = $percent;

            if ($progress) {
                $progress($percent, $label);
            }
        };

        $report(12, 'Opening the marked area');

        try {
            $parsed = (new Parser)->parseFile($path);
            $pdfPages = array_values($parsed->getPages());
        } catch (Throwable) {
            return $blank;
        }

        $page = $pdfPages[$pageNumber - 1] ?? null;

        if ($page === null) {
            return $blank;
        }

        $report(40, 'Reading the page');
        $box = self::mediaBox($page->getDetails());
        $minX = max(0.0, min($left, $right) - (8 / $box['width']));
        $maxX = min(1.0, max($left, $right) + (8 / $box['width']));
        $minY = max(0.0, min($top, $bottom) - (8 / $box['height']));
        $maxY = min(1.0, max($top, $bottom) + (8 / $box['height']));

        if (($maxX - $minX) < 0.01 || ($maxY - $minY) < 0.01) {
            return $blank;
        }

        $report(62, 'Collecting the text');
        $items = [];

        foreach ($page->getDataTm() as $entry) {
            $matrix = $entry[0] ?? null;
            $text = trim((string) ($entry[1] ?? ''));

            if (! is_array($matrix) || $text === '') {
                continue;
            }

            $x = ((float) ($matrix[4] ?? 0) - $box['origin_x']) / $box['width'];
            $y = 1 - (((float) ($matrix[5] ?? 0) - $box['origin_y']) / $box['height']);

            if ($x < $minX || $x > $maxX || $y < $minY || $y > $maxY) {
                continue;
            }

            $items[] = [
                'x' => (float) ($matrix[4] ?? 0),
                'y' => (float) ($matrix[5] ?? 0),
                'text' => $text,
            ];
        }

        if ($items === []) {
            return $blank;
        }

        $report(84, 'Preparing the section');
        $lines = [];

        foreach (self::rows($items) as $row) {
            $cells = [];

            foreach ($row['cells'] as $cell) {
                $value = trim((string) ($cell['text'] ?? ''));

                if ($value !== '') {
                    $cells[] = $value;
                }
            }

            $paired = self::sectionLines($cells);

            foreach ($paired as $line) {
                $lines[] = $line;
            }

            if (count($lines) >= 400) {
                break;
            }
        }

        $body = implode("\n", $lines);

        if (mb_strlen($body) > 20000) {
            $body = mb_substr($body, 0, 20000);
        }

        return [
            'title' => self::sectionTitle($lines),
            'body' => $body,
        ];
    }

    /**
     * @param  list<string>  $cells
     * @return list<string>
     */
    private static function sectionLines(array $cells): array
    {
        $text = trim((string) preg_replace('/\s+/', ' ', implode(' ', $cells)));

        if ($text === '') {
            return [];
        }

        $pattern = '/((?:[A-Z][A-Z0-9&\'\/-]{1,})(?:\s+[A-Z][A-Z0-9&\'\/-]{1,}){1,7})/';
        $parts = preg_split($pattern, $text, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [$text];
        $lines = [];

        foreach ($parts as $part) {
            $part = trim($part);

            if ($part === '') {
                continue;
            }

            if (self::isGroupTitle($part)) {
                $lines[] = $part;

                continue;
            }

            $paired = self::sectionPair([$part]);

            if ($paired !== []) {
                $lines[] = implode("\t", $paired);
            }
        }

        return $lines;
    }

    private static function isGroupTitle(string $text): bool
    {
        $text = trim((string) preg_replace('/\s+/', ' ', $text));

        if (preg_match('/^(?:[A-Z][A-Z0-9&\'\/-]{1,})(?:\s+[A-Z][A-Z0-9&\'\/-]{1,}){1,7}$/', $text) === 1) {
            return true;
        }

        return preg_match('/\d/', $text) !== 1
            && preg_match('/^[A-Z][A-Za-z]+(?:\s+(?:and|of|the|&|[A-Z][A-Za-z]+)){1,7}$/', $text) === 1
            && preg_match('/\b(Notes?|Schedule|Specifications?|Requirements?|Finishes|Hardware|Legend)\b/', $text) === 1;
    }

    /**
     * Keep a copied line to a number and its description.
     *
     * @param  list<string>  $cells
     * @return list<string>
     */
    private static function sectionPair(array $cells): array
    {
        $text = trim((string) preg_replace('/\s+/', ' ', implode(' ', $cells)));

        if ($text === '') {
            return [];
        }

        if (preg_match('/^(SET\s*\d+[A-Za-z]?|HW-?\d+[A-Za-z]?|[A-Za-z]{1,3}-?\d+[A-Za-z]?|\d{1,4}[A-Za-z]?)\s+(.+)$/i', $text, $match) === 1) {
            return [trim((string) preg_replace('/\s+/', ' ', $match[1])), trim($match[2])];
        }

        return [$text];
    }

    /**
     * @param  list<string>  $lines
     */
    private static function sectionTitle(array $lines): string
    {
        foreach ($lines as $line) {
            $text = trim((string) preg_replace('/\s+/', ' ', str_replace("\t", ' ', $line)));
            $letters = preg_replace('/[^A-Za-z]/', '', $text) ?? '';

            if ($text === '' || mb_strlen($text) < 4 || mb_strlen($text) > 80 || strlen($letters) < 4) {
                continue;
            }

            $upper = preg_match_all('/[A-Z]/', $letters);

            if ($upper / strlen($letters) >= 0.7) {
                return $text;
            }
        }

        $first = trim((string) preg_replace('/\s+/', ' ', str_replace("\t", ' ', $lines[0] ?? '')));

        return $first !== '' ? mb_substr($first, 0, 80) : 'Copied section';
    }

    /**
     * Read door and window marks out of a copied section.
     *
     * @return list<array<string, mixed>>
     */
    public static function openingsFromSection(string $title, string $body, int $page, ?string $asType = null): array
    {
        $named = strtolower(trim((string) $asType));
        $named = $named === 'windows' ? 'window' : ($named === 'doors' ? 'door' : $named);
        $forced = null;

        if ($named === 'window' || $named === 'door') {
            $kind = $named;
            $forced = $named;
        } elseif (trim((string) $asType) !== '') {
            $kind = 'mixed';
            $forced = trim((string) $asType);
        } else {
            $kind = self::sectionKind($title);
        }
        $defaultFrame = self::frameFromTitle($title);
        $openings = [];
        $titleKey = strtolower(trim((string) preg_replace('/\s+/', ' ', $title)));

        $prepared = [];

        foreach (preg_split('/\r?\n/', $body) ?: [] as $raw) {
            $line = trim((string) preg_replace('/\s+/', ' ', str_replace("\t", ' ', (string) $raw)));

            if ($line === '' || strtolower($line) === $titleKey || self::isScheduleHeader($line)) {
                continue;
            }

            if ($prepared !== [] && self::isSizeContinuation($line)) {
                $prepared[array_key_last($prepared)] .= ' '.$line;

                continue;
            }

            $prepared[] = $line;
        }

        foreach ($prepared as $line) {
            if (self::isDetailRow($line)) {
                continue;
            }

            $opening = self::openingFromSectionLine($line, $kind, $page, $defaultFrame);

            if ($opening !== null) {
                self::put($openings, $opening);
            }
        }

        $section = mb_substr(trim($title) !== '' ? trim($title) : 'Section', 0, 255);
        $finished = [];

        foreach ($openings as $opening) {
            $opening['quantity'] = number_format((float) ($opening['quantity'] ?? 1), 2, '.', '');
            $opening['markers'] = [];
            $opening['opening_type'] = $forced ?? $opening['opening_type'];
            $opening['requirement_page'] = $page;
            $opening['requirement_section'] = $section;
            unset($opening['plan_markers'], $opening['fallback']);
            $finished[] = $opening;
        }

        usort($finished, fn (array $a, array $b): int => strnatcasecmp((string) $a['tag'], (string) $b['tag']));

        return array_slice($finished, 0, 200);
    }

    private static function preferredMark(string $line, string $kind): ?string
    {
        $upper = strtoupper($line);

        if (preg_match('/\b(W\d{1,4}-\d{1,4}[A-Z]?)\b/', $upper, $match) === 1) {
            return $match[1];
        }

        if ($kind === 'window' && preg_match('/\b((?:WIN|W)[-.]?\d{1,4}[A-Z]?)\b/', $upper, $match) === 1) {
            return $match[1];
        }

        if (($kind === 'door' || $kind === 'mixed') && preg_match('/\b(\d{2,4})\b(?=\s+\d+\s*[\'′"])/u', $upper, $match) === 1) {
            return $match[1];
        }

        if ($kind === 'mixed' && preg_match('/\b([A-Z]{1,3}\d{1,4}-\d{1,4}[A-Z]?)\b/', $upper, $match) === 1 && preg_match('/^(?:SET|HW|HDW|HDWR|HD|STC|QTY)/', $match[1]) !== 1) {
            return $match[1];
        }

        return null;
    }

    private static function isSizeContinuation(string $line): bool
    {
        if (preg_match('/\b(?:W\d|D\d|WIN|\d{3})\b/i', $line) === 1) {
            return false;
        }

        $lengths = self::lengthTokens($line);

        if (count($lengths) < 2) {
            return false;
        }

        $rest = $line;

        foreach (array_slice($lengths, 0, 2) as $length) {
            $rest = self::cut($rest, $length['raw']);
        }

        return trim($rest) === '';
    }

    private static function isDetailRow(string $line): bool
    {
        $tokens = preg_split('/\s+/', strtoupper(trim($line))) ?: [];

        if ($tokens === []) {
            return false;
        }

        foreach ($tokens as $token) {
            if (preg_match('/^(?:H\d+|J\d+|S\d+|NA|SIM|NO)$/', $token) !== 1) {
                return false;
            }
        }

        return true;
    }

    private static function sectionKind(string $title): string
    {
        $text = strtolower($title);
        $window = preg_match('/\bwindows?\b/', $text) === 1;
        $door = preg_match('/\bdoors?\b/', $text) === 1;
        $schedule = preg_match('/\b(schedules?|types?|openings?)\b/', $text) === 1;
        $notes = preg_match('/\b(hardware|notes?|finishes|legend|specifications?|requirements?)\b/', $text) === 1;

        if ($notes && ! $schedule) {
            return 'mark';
        }

        if ($window && ! $door) {
            return 'window';
        }

        if ($door && ! $window) {
            return 'door';
        }

        if ($window && $door) {
            return 'mixed';
        }

        return $schedule ? 'mixed' : 'mark';
    }

    private static function frameFromTitle(string $title): ?string
    {
        $text = strtolower($title);

        return match (true) {
            str_contains($text, 'hollow metal') || preg_match('/\bhm\b/', $text) === 1 => 'Hollow metal',
            str_contains($text, 'aluminum') || str_contains($text, 'aluminium') => 'Aluminum',
            preg_match('/\bwood\b/', $text) === 1 => 'Wood',
            preg_match('/\bsteel\b/', $text) === 1 => 'Steel',
            preg_match('/\bfrp\b/', $text) === 1 => 'FRP',
            default => null,
        };
    }

    private static function isScheduleHeader(string $line): bool
    {
        $words = preg_split('/\s+/', strtolower($line)) ?: [];

        if (count($words) < 2) {
            return false;
        }

        $known = [
            'mark', 'marks', 'tag', 'tags', 'door', 'doors', 'window', 'windows', 'no', 'number',
            'width', 'height', 'ht', 'size', 'qty', 'quantity', 'count', 'location', 'room', 'loc',
            'hand', 'handing', 'swing', 'hardware', 'hdwr', 'hw', 'frame', 'type', 'fire', 'rating',
            'glazing', 'finish', 'remarks', 'comments', 'notes', 'description', 'thick', 'thickness',
            'material', 'head', 'jamb', 'sill', 'elevation',
        ];
        $hits = 0;

        foreach ($words as $word) {
            if (in_array(trim($word, '.:#'), $known, true)) {
                $hits++;
            }
        }

        return $hits >= 2 && ($hits / count($words)) >= 0.6;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function openingFromSectionLine(string $line, string $kind, int $page, ?string $defaultFrame): ?array
    {
        $allowNumeric = $kind !== 'mark';
        $line = trim((string) preg_replace('/^(?:marks?|tags?|door|window|no\.?|number)\s+/i', '', $line));
        $quantity = null;
        $numeric = false;
        $tag = null;
        $rest = '';
        $preferred = self::preferredMark($line, $kind);

        if ($preferred !== null) {
            $tag = $preferred;
            $rest = trim((string) preg_replace('/\b'.preg_quote($preferred, '/').'\b/i', ' ', $line, 1));
        } elseif (preg_match('/^(\d+(?:\.\d+)?)\s+(\S+)\s*(.*)$/', $line, $leading) === 1 && (float) $leading[1] > 0 && (float) $leading[1] <= 500) {
            $candidate = self::tag($leading[2], false) ?? ($allowNumeric ? self::tag($leading[2], true) : null);

            if ($candidate !== null && self::tag($leading[2], false) !== null) {
                $quantity = (float) $leading[1];
                $tag = $candidate;
                $rest = trim($leading[3]);
            }
        }

        if ($tag === null && preg_match('/^(\S+)\s*(.*)$/', $line, $parts) === 1) {
            $tag = self::tag($parts[1], false);
            $numeric = false;

            if ($tag === null && $allowNumeric) {
                $tag = self::tag($parts[1], true);
                $numeric = $tag !== null;
            }

            if ($tag === null && $allowNumeric && preg_match('/^[A-Za-z]{1,2}-?\d{1,4}[A-Za-z]?$/', $parts[1]) === 1) {
                $token = strtoupper((string) preg_replace('/\s+/', '', $parts[1]));

                if (preg_match('/^(?:SET|HW|HDW|HDWR|HD|STC|QTY)/', $token) !== 1) {
                    $tag = $token;
                    $numeric = false;
                }
            }

            $rest = trim($parts[2]);
        }

        if ($tag === null) {
            return null;
        }

        $size = self::pullSectionSize($rest);
        $handing = null;

        if (preg_match('/\b(LHRA|RHRA|LHR|RHR|LH|RH|RR|LR)\b/i', $rest, $handMatch) === 1) {
            $handing = strtoupper($handMatch[1]);
            $rest = self::cut($rest, $handMatch[0]);
        }

        $hardware = null;

        if (preg_match('/\b((?:SET|HW|HDW|HDWR)\s*-?\s*\d+[A-Z]?)\b/i', $rest, $hardwareMatch) === 1) {
            $hardware = strtoupper((string) preg_replace('/\s+/', ' ', $hardwareMatch[1]));
            $rest = self::cut($rest, $hardwareMatch[0]);
        }

        $frame = null;

        if (preg_match('/\b(hollow\s+metal|aluminum|aluminium|wood|steel|frp|HM|ALUM|AL|WD|STL)\b/i', $rest, $frameMatch) === 1) {
            $frame = self::frame($frameMatch[1]);
            $rest = self::cut($rest, $frameMatch[0]);
        }

        $fire = null;

        if (preg_match('/\b(\d+(?:\.\d+)?)\s*-?\s*(min(?:ute)?s?|hours?|hrs?)\b/i', $rest, $fireMatch) === 1) {
            $fire = $fireMatch[1].' '.(str_starts_with(strtolower($fireMatch[2]), 'h') ? 'hour' : 'min');
            $rest = self::cut($rest, $fireMatch[0]);
        }

        $acoustic = null;

        if (preg_match('/\bSTC\s*-?\s*(\d+)\b/i', $rest, $acousticMatch) === 1) {
            $acoustic = 'STC '.$acousticMatch[1];
            $rest = self::cut($rest, $acousticMatch[0]);
        }

        $glazing = null;

        if (preg_match('/\b(tempered|laminated|insulated|obscure|frosted|wire\s+glass|spandrel|igu)\b/i', $rest, $glazingMatch) === 1) {
            $glazing = ucwords(strtolower($glazingMatch[1]));
            $rest = self::cut($rest, $glazingMatch[0]);
        }

        $finish = null;

        if (preg_match('/\b(painted|paint|stained|stain|anodized|primed|galvanized)\b/i', $rest, $finishMatch) === 1) {
            $finish = ucfirst(strtolower($finishMatch[1]));
            $rest = self::cut($rest, $finishMatch[0]);
        }

        $category = null;

        if (preg_match('/\b(single|pair|double|sliding|slider|pocket|bi-?fold|overhead|storefront|fixed|casement|awning)\b/i', $rest, $categoryMatch) === 1) {
            $category = strcasecmp($categoryMatch[1], 'slider') === 0 ? 'Sliding' : ucwords(strtolower(str_replace('-', '-', $categoryMatch[1])));

            if (preg_match('/bi-?fold/i', $categoryMatch[1]) === 1) {
                $category = 'Bi-fold';
            }

            $rest = self::cut($rest, $categoryMatch[0]);
        }

        if ($quantity === null && preg_match('/\b(?:qty|quantity|count)\s*:?\s*(\d+(?:\.\d+)?)\b/i', $rest, $quantityMatch) === 1) {
            $quantity = self::quantity($quantityMatch[1]);
            $rest = self::cut($rest, $quantityMatch[0]);
        }

        if ($quantity === null && $size !== null && preg_match('/\b(\d+(?:\.\d+)?)\s*$/', $rest, $tail) === 1 && (float) $tail[1] > 0 && (float) $tail[1] <= 50) {
            $quantity = self::quantity($tail[1]);
            $rest = self::cut($rest, $tail[0]);
        }

        $identified = $size !== null || $handing !== null || $hardware !== null || $frame !== null;

        if ($kind === 'mark' && ! $identified) {
            return null;
        }

        if ($numeric && ! $identified) {
            return null;
        }

        $rest = trim((string) preg_replace('/\s+/', ' ', trim($rest, " \t,;:-x×")));
        $location = null;
        $notes = null;
        $words = $rest === '' ? [] : preg_split('/\s+/', $rest);

        if ($rest !== '' && count($words) <= 6 && mb_strlen($rest) <= 80) {
            $location = $rest;
        } elseif ($rest !== '') {
            $notes = $rest;
        }

        $pageKind = $kind === 'window' ? 'window' : 'door';
        $opening = self::shell($tag, $pageKind, $page);
        $opening['location'] = self::location($location);
        $opening['quantity'] = $quantity;
        $opening['width'] = $size['width'] ?? null;
        $opening['height'] = $size['height'] ?? null;
        $opening['depth'] = $size['depth'] ?? null;
        $opening['dimension_unit'] = $size['unit'] ?? 'in';
        $opening['frame_type'] = $frame ?? $defaultFrame;
        $opening['handing'] = $handing;
        $opening['hardware_set'] = $hardware;
        $opening['glazing'] = $glazing;
        $opening['finish'] = $finish;
        $opening['fire_requirement'] = $fire;
        $opening['acoustic_requirement'] = $acoustic;
        $opening['product_category'] = $category;
        $opening['notes'] = $notes;
        $opening['requirement_page'] = $page;

        return $opening;
    }

    /**
     * @return array{width: string, height: string, depth: ?string, unit: string}|null
     */
    private static function pullSectionSize(string &$text): ?array
    {
        $patterns = [
            '/(\d+\s*[\'′]\s*-?\s*\d{0,2}\s*(?:["″]|in\.?)?\s*[x×]\s*\d+\s*[\'′]\s*-?\s*\d{0,2}\s*(?:["″]|in\.?)?)/iu',
            '/(\d+(?:\.\d+)?\s*(?:mm|cm|in|["″])?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:mm|cm|in|["″])?)/iu',
            '/\b([2-8][0-9][6-9][0-9])\b/',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $match) !== 1) {
                continue;
            }

            $size = self::parseSize($match[1]);

            if ($size === null) {
                continue;
            }

            $text = self::cut($text, $match[0]);
            $depth = self::pullDepth($text);

            return [
                'width' => $size['width'],
                'height' => $size['height'],
                'depth' => $depth,
                'unit' => $size['unit'],
            ];
        }

        $lengths = self::lengthTokens($text);

        if (count($lengths) < 2) {
            return null;
        }

        $text = self::cut($text, $lengths[0]['raw']);
        $text = self::cut($text, $lengths[1]['raw']);
        $depth = null;

        if (isset($lengths[2]) && $lengths[2]['unit'] === 'in' && (float) $lengths[2]['value'] > 0 && (float) $lengths[2]['value'] <= 12) {
            $depth = $lengths[2]['value'];
            $text = self::cut($text, $lengths[2]['raw']);
        }

        return [
            'width' => $lengths[0]['value'],
            'height' => $lengths[1]['value'],
            'depth' => $depth,
            'unit' => self::unit($lengths[0], $lengths[1]),
        ];
    }

    private static function pullDepth(string &$text): ?string
    {
        if (preg_match('/^\s*[x×]\s*(\S+)/', $text, $match) !== 1) {
            return null;
        }

        $parsed = self::parseLength($match[1]);

        if ($parsed === null || $parsed['unit'] !== 'in' || (float) $parsed['value'] <= 0 || (float) $parsed['value'] > 12) {
            return null;
        }

        $text = self::cut($text, $match[0]);

        return $parsed['value'];
    }

    /**
     * @return list<array{raw: string, value: string, unit: string}>
     */
    private static function lengthTokens(string $text): array
    {
        $pattern = '/\d+\s*[-\s]\s*\d+\s*\/\s*\d+\s*(?:["″]|in\.?)?|\d+\s*[\'′]\s*-?\s*(?:\d{1,2}(?:\s+\d+\s*\/\s*\d+)?)?\s*(?:["″]|in\.?)?|\d+(?:\.\d+)?\s*(?:mm|cm|in|["″])/iu';
        $found = [];

        if (preg_match_all($pattern, $text, $matches) !== false) {
            foreach ($matches[0] as $raw) {
                $parsed = self::parseLength(trim($raw));

                if ($parsed === null) {
                    continue;
                }

                $found[] = [
                    'raw' => $raw,
                    'value' => $parsed['value'],
                    'unit' => $parsed['unit'],
                ];
            }
        }

        return $found;
    }

    private static function cut(string $text, string $piece): string
    {
        $replaced = preg_replace('/'.preg_quote($piece, '/').'/', ' ', $text, 1);

        return trim((string) preg_replace('/\s+/', ' ', (string) $replaced));
    }

    /**
     * @param  list<array{page: int, width: float, height: float, origin_x: float, origin_y: float, items: list<array{x: float, y: float, text: string}>}>  $pages
     * @return array{
     *     sheet_number: ?string,
     *     sheet_title: ?string,
     *     revision_label: ?string,
     *     document_type: string,
     *     page_count: ?int,
     *     openings: list<array<string, mixed>>,
     *     notes: list<string>
     * }
     */
    public static function fromPages(array $pages, ?callable $progress = null): array
    {
        $report = function (int $percent, string $label) use ($progress): void {
            if ($progress) {
                $progress($percent, $label);
            }
        };
        $hasText = false;

        foreach ($pages as $page) {
            if (($page['items'] ?? []) !== []) {
                $hasText = true;
                break;
            }
        }

        if (! $hasText) {
            return self::emptyResult('No text was found in this PDF. Scanned drawings need a text layer before openings can be read.', count($pages) ?: null);
        }

        $openings = [];
        $scheduleRows = [];
        $sawSchedule = false;
        $meta = [];

        $report(74, 'Checking the sheet titles');

        foreach ($pages as $page) {
            $rows = self::rows($page['items']);
            $meta[] = ['page' => $page] + self::metadata($page, $rows);
            $schedule = self::readSchedule($page, $rows, $openings);
            $sawSchedule = $sawSchedule || $schedule['found'];
            $scheduleRows += $schedule['rows'];
        }

        $report(82, 'Reading door and window schedules');
        self::readLines($pages, $scheduleRows, $openings);
        $report(88, 'Reading marks on the plan');
        self::readMarkers($pages, $scheduleRows, $openings);
        $report(92, 'Checking the drawing');
        $sawSchedule = self::readArchitectural($pages, $openings) || $sawSchedule;
        $report(96, 'Preparing the openings');
        $openings = self::finalize($openings);
        $sheet = self::chooseSheet($meta);
        $notes = [];

        if (count($openings) > 200) {
            $openings = array_slice($openings, 0, 200);
            $notes[] = 'Only the first 200 openings were kept.';
        }

        if ($openings === []) {
            $notes[] = 'No door or window tags were found in the text of this PDF.';
        }

        return [
            'sheet_number' => $sheet['number'],
            'sheet_title' => $sheet['title'],
            'revision_label' => $sheet['revision'],
            'document_type' => $sawSchedule ? 'schedule' : 'drawing',
            'page_count' => count($pages),
            'openings' => $openings,
            'notes' => $notes,
            'project' => self::projectDetails($pages),
        ];
    }

    /**
     * The schedule row nearest a click on the rendered sheet.
     *
     * @param  list<array<string, mixed>>  $openings
     * @return array<string, mixed>|null
     */
    public static function matchAt(array $openings, int $page, float $x, float $y): ?array
    {
        $best = null;
        $bestDy = null;
        $bestDx = null;

        foreach ($openings as $opening) {
            if (! is_array($opening)) {
                continue;
            }

            foreach ($opening['markers'] ?? [] as $marker) {
                if (! is_array($marker) || (int) ($marker['page'] ?? 0) !== $page) {
                    continue;
                }

                $dy = abs((float) $marker['y'] - $y);
                $dx = abs((float) $marker['x'] - $x);

                if ($dy > 0.012) {
                    continue;
                }

                $closerRow = $bestDy === null || $dy < $bestDy - 0.004;
                $sameRowCloserToClick = $bestDy !== null && $bestDx !== null && abs($dy - $bestDy) <= 0.004 && $dx < $bestDx;

                if ($closerRow || $sameRowCloserToClick) {
                    $best = $opening;
                    $bestDy = $dy;
                    $bestDx = $dx;
                }
            }
        }

        return $best;
    }

    public static function assertUploaded(?UploadedFile $file): void
    {
        if (! $file || $file->isValid()) {
            return;
        }

        $limit = ini_get('upload_max_filesize') ?: '2M';
        $message = match ($file->getError()) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'This PDF is larger than the server allows ('.$limit.').',
            UPLOAD_ERR_PARTIAL => 'The PDF upload was interrupted. Try again.',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE => 'The server could not store the upload.',
            default => 'The PDF could not be uploaded.',
        };

        throw ValidationException::withMessages(['file' => $message]);
    }

    public static function assertPdf(UploadedFile $file): void
    {
        $handle = fopen($file->getRealPath(), 'rb');
        $header = $handle ? fread($handle, 5) : '';

        if (is_resource($handle)) {
            fclose($handle);
        }

        if (! str_starts_with((string) $header, '%PDF-')) {
            throw ValidationException::withMessages(['file' => 'Upload a PDF file.']);
        }
    }

    /**
     * @return array{width: float, height: float, origin_x: float, origin_y: float}
     */
    private static function mediaBox(array $details): array
    {
        $box = $details['MediaBox'] ?? [0, 0, 612, 792];

        if (is_string($box)) {
            $box = preg_split('/\s+/', trim($box)) ?: [];
        }

        $originX = (float) ($box[0] ?? 0);
        $originY = (float) ($box[1] ?? 0);
        $width = (float) ($box[2] ?? 612) - $originX;
        $height = (float) ($box[3] ?? 792) - $originY;

        return [
            'origin_x' => $originX,
            'origin_y' => $originY,
            'width' => max(1.0, $width),
            'height' => max(1.0, $height),
        ];
    }

    /**
     * @param  list<array{x: float, y: float, text: string}>  $items
     * @return list<array{y: float, cells: list<array{x: float, text: string}>}>
     */
    private static function rows(array $items): array
    {
        $buckets = [];

        foreach ($items as $item) {
            $key = (int) round($item['y'] / 3);
            $buckets[$key]['y'] = $item['y'];

            foreach (self::splitCells($item['x'], $item['y'], $item['text']) as $cell) {
                $buckets[$key]['cells'][] = $cell;
            }
        }

        krsort($buckets);
        $rows = [];

        foreach ($buckets as $bucket) {
            usort($bucket['cells'], fn (array $a, array $b): int => $a['x'] <=> $b['x']);
            $rows[] = $bucket;
        }

        return $rows;
    }

    /**
     * @return list<array{x: float, y: float, text: string}>
     */
    private static function splitCells(float $x, float $y, string $text): array
    {
        $parts = preg_split('/\s{2,}|\t+/', $text) ?: [$text];

        if (count($parts) < 2) {
            return [['x' => $x, 'y' => $y, 'text' => trim($text)]];
        }

        $cells = [];

        foreach (array_values(array_filter(array_map('trim', $parts), fn (string $part): bool => $part !== '')) as $index => $part) {
            $cells[] = ['x' => $x + ($index * 80), 'y' => $y, 'text' => $part];
        }

        return $cells === [] ? [['x' => $x, 'y' => $y, 'text' => trim($text)]] : $cells;
    }

    /**
     * Door schedule sheets often print each opening as one wrapped line:
     * door number, room, width, height, thickness, then the same door number again.
     *
     * @param  list<array{page: int, width: float, height: float, origin_x: float, origin_y: float, items: list<array{x: float, y: float, text: string}>}>  $pages
     * @param  array<string, array<string, mixed>>  $openings
     */
    private static function readArchitectural(array $pages, array &$openings): bool
    {
        $found = false;

        foreach ($pages as $page) {
            $cells = [];

            foreach ($page['items'] as $item) {
                foreach (self::splitCells($item['x'], $item['y'], $item['text']) as $cell) {
                    $cells[] = $cell;
                }
            }

            $anchors = [];

            foreach ($cells as $index => $cell) {
                $text = self::collapse($cell['text']);

                if (self::startsDoorRow($text) && preg_match('/\d+\'\s*-\s*\d+/', $text) === 1) {
                    $anchors[] = $index;
                }
            }

            if ($anchors === []) {
                continue;
            }

            $minX = min(array_map(fn (int $index): float => $cells[$index]['x'], $anchors)) - 8;

            foreach ($anchors as $index) {
                $anchor = $cells[$index];
                $parts = [$anchor['text']];
                $right = [];

                foreach ($cells as $otherIndex => $other) {
                    if ($otherIndex === $index || $other['x'] <= $anchor['x'] || $other['x'] < $minX || abs($other['y'] - $anchor['y']) > 2.5) {
                        continue;
                    }

                    $right[] = $otherIndex;
                }

                usort($right, fn (int $a, int $b): int => $cells[$a]['x'] <=> $cells[$b]['x']);

                foreach ($right as $otherIndex) {
                    if (self::startsDoorRow(self::collapse($cells[$otherIndex]['text']))) {
                        break;
                    }

                    $parts[] = $cells[$otherIndex]['text'];
                }

                $parsed = self::parseArchitectural(implode('', $parts));

                if ($parsed === null) {
                    $below = [];

                    foreach ($cells as $otherIndex => $other) {
                        $drop = $anchor['y'] - $other['y'];

                        if ($other['x'] < $minX || $drop < 4 || $drop > 16) {
                            continue;
                        }

                        $below[] = $otherIndex;
                    }

                    usort($below, fn (int $a, int $b): int => $cells[$a]['x'] <=> $cells[$b]['x']);

                    foreach ($below as $otherIndex) {
                        if (self::startsDoorRow(self::collapse($cells[$otherIndex]['text']))) {
                            break;
                        }

                        $parts[] = $cells[$otherIndex]['text'];
                    }

                    $parsed = self::parseArchitectural(implode('', $parts));
                }

                if ($parsed === null) {
                    continue;
                }

                self::storeArchitectural($openings, $parsed, [
                    'x' => $anchor['x'],
                    'y' => $anchor['y'],
                    'page' => $page,
                ]);
                $found = true;
            }
        }

        return $found;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function parseArchitectural(string $text): ?array
    {
        $text = self::collapse($text);
        $dimension = '(\d+\'\s*-\s*\d+(?:\s+\d+\/\d+)?")';
        $withRoom = '/^(\d{2,4}[A-Z]?)\s+([A-Z][A-Z0-9.&\'\/\-]*?(?:\s+[A-Z][A-Z0-9.&\'\/\-]*?)*)\s+(\d{2,4}[A-Z]?)\s+'.$dimension.'\s+'.$dimension.'\s+'.$dimension.'\s+([A-Z0-9\-]+)\s*(.*?)\s+\1$/';
        $sizeOnly = '/^(\d{2,4}[A-Z]?)\s+'.$dimension.'\s+'.$dimension.'\s+'.$dimension.'\s*(.*?)\s+\1$/';

        if (preg_match($withRoom, $text, $match) === 1) {
            return self::architecturalOpening($match[1], $match[2], $match[3], $match[4], $match[5], $match[6], $match[7], $match[8] ?? '');
        }

        if (preg_match($sizeOnly, $text, $match) === 1) {
            return self::architecturalOpening($match[1], null, null, $match[2], $match[3], $match[4], null, $match[5] ?? '');
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function architecturalOpening(string $tag, ?string $room, ?string $roomNumber, string $width, string $height, string $depth, ?string $type, string $tail): ?array
    {
        $width = self::parseLength($width);
        $height = self::parseLength($height);
        $depth = self::parseLength($depth);

        if ($width === null || $height === null) {
            return null;
        }

        $tag = strtoupper($tag);
        $room = self::collapse((string) $room);
        $roomNumber = $roomNumber !== null ? strtoupper($roomNumber) : null;
        $location = $room !== '' ? $room : null;

        if ($location !== null && $roomNumber !== null && $roomNumber !== $tag) {
            $location .= ' · '.$roomNumber;
        }

        $tail = self::collapse($tail);
        $hardware = null;

        if (preg_match('/\b((?:\d{1,2}\s*,\s*)+\d{1,2}|\d{1,2})(?:\s+\d{1,2})?\s*$/', $tail, $hardwareMatch) === 1) {
            $hardware = $hardwareMatch[1];
        }

        $acoustic = null;

        if (preg_match_all('/\b(4[0-9]|5[0-9])\b(?!\s*MIN)/', $tail, $ratings) > 0) {
            $acoustic = 'STC '.end($ratings[1]);
        }

        $frame = null;
        $hollowMetal = preg_match('/\bHM\b/', $tail) === 1;

        if (preg_match('/\b(H\d+[A-Z]?)\b/', $tail, $frameMatch) === 1) {
            $frame = $hollowMetal ? $frameMatch[1].' · Hollow metal' : $frameMatch[1];
        } elseif ($hollowMetal) {
            $frame = 'Hollow metal';
        }

        $fire = null;

        if (preg_match('/\b(\d+(?:\s+\d+\/\d+)?)\s*MIN\b/i', $tail, $fireMatch) === 1) {
            $fire = trim($fireMatch[1]).' MIN';
        }

        $finish = null;

        if (preg_match('/\b(PNT\d+)\b/', $tail, $finishMatch) === 1) {
            $finish = $finishMatch[1];
        }

        $glazing = preg_match('/\bCAT\s+POLY\b/', $tail) === 1 ? 'CAT POLY' : null;
        $notes = trim(implode(' ', array_filter([$type, $tail])));
        $opening = self::shell($tag, 'door', 1);
        $opening['location'] = $location;
        $opening['width'] = $width['value'];
        $opening['height'] = $height['value'];
        $opening['depth'] = $depth['value'] ?? null;
        $opening['frame_type'] = $frame;
        $opening['finish'] = $finish;
        $opening['glazing'] = $glazing;
        $opening['hardware_set'] = $hardware;
        $opening['acoustic_requirement'] = $acoustic;
        $opening['fire_requirement'] = $fire;
        $opening['notes'] = $notes !== '' ? $notes : null;
        $opening['requirement_section'] = 'Door schedule';

        return $opening;
    }

    /**
     * @param  array<string, array<string, mixed>>  $openings
     * @param  array<string, mixed>  $opening
     * @param  array{x: float, y: float, page: array<string, mixed>}  $anchor
     */
    private static function storeArchitectural(array &$openings, array $opening, array $anchor): void
    {
        $opening['requirement_page'] = $anchor['page']['page'];
        $opening['fallback'] = self::point($anchor['page'], $anchor);
        self::put($openings, $opening);
    }

    private static function startsDoorRow(string $text): bool
    {
        return preg_match('/^\d{2,4}[A-Z]?\s+(?:[A-Z]|\d+\s*\')/', $text) === 1;
    }

    private static function collapse(string $text): string
    {
        return trim((string) preg_replace('/\s+/', ' ', $text));
    }

    private static function feetInches(string $text): ?string
    {
        if (preg_match('/^(\d+)\s*[\'′]\s*-?\s*(?:(\d+)(?:\s+(\d+)\s*\/\s*(\d+))?|(\d+)\s*\/\s*(\d+))?\s*(?:["″]|in\.?)?$/u', $text, $match) !== 1) {
            return null;
        }

        $inches = ((int) $match[1]) * 12;

        if (($match[2] ?? '') !== '') {
            $inches += (int) $match[2];

            if (($match[3] ?? '') !== '' && (int) $match[4] > 0) {
                $inches += ((int) $match[3]) / ((int) $match[4]);
            }
        } elseif (($match[5] ?? '') !== '' && (int) $match[6] > 0) {
            $inches += ((int) $match[5]) / ((int) $match[6]);
        }

        return self::number((float) $inches);
    }

    /**
     * @param  list<array{y: float, cells: list<array{x: float, y: float, text: string}>}>  $rows
     * @param  array<string, array<string, mixed>>  $openings
     * @return array{found: bool, rows: array<string, bool>}
     */
    private static function readSchedule(array $page, array $rows, array &$openings): array
    {
        $columns = null;
        $misses = 0;
        $found = false;
        $keys = [];
        $pageKind = self::pageKind($rows);

        foreach ($rows as $row) {
            $header = self::headerColumns($row['cells']);

            if ($header !== null) {
                $columns = $header;
                $misses = 0;
                $found = true;
                $keys[self::rowKey($page['page'], $row['y'])] = true;

                continue;
            }

            if ($columns === null) {
                continue;
            }

            $values = self::assign($row['cells'], $columns);
            $tag = self::tag($values['tag'] ?? '', true);

            if ($tag === null) {
                $misses++;

                if ($misses >= 2) {
                    $columns = null;
                }

                continue;
            }

            $misses = 0;
            $keys[self::rowKey($page['page'], $row['y'])] = true;
            $opening = self::openingFromValues($tag, $values, $pageKind, $page['page']);
            $opening['fallback'] = self::point($page, self::tagCell($row['cells'], $tag) ?? $row['cells'][0]);
            self::put($openings, $opening);
        }

        return ['found' => $found, 'rows' => $keys];
    }

    /**
     * @param  array<string, bool>  $scheduleRows
     * @param  array<string, array<string, mixed>>  $openings
     * @param  list<array{page: int, width: float, height: float, origin_x: float, origin_y: float, items: list<array{x: float, y: float, text: string}>}>  $pages
     */
    private static function readLines(array $pages, array $scheduleRows, array &$openings): void
    {
        foreach ($pages as $page) {
            $rows = self::rows($page['items']);
            $pageKind = self::pageKind($rows);

            foreach ($rows as $row) {
                if (isset($scheduleRows[self::rowKey($page['page'], $row['y'])])) {
                    continue;
                }

                $line = trim(implode(' ', array_column($row['cells'], 'text')));
                $opening = self::openingFromLine($line, $pageKind, $page['page']);

                if ($opening === null) {
                    continue;
                }

                $opening['fallback'] = self::point($page, $row['cells'][0]);
                self::put($openings, $opening);
            }
        }
    }

    /**
     * @param  array<string, bool>  $scheduleRows
     * @param  array<string, array<string, mixed>>  $openings
     * @param  list<array{page: int, width: float, height: float, origin_x: float, origin_y: float, items: list<array{x: float, y: float, text: string}>}>  $pages
     */
    private static function readMarkers(array $pages, array $scheduleRows, array &$openings): void
    {
        foreach ($pages as $page) {
            $rows = self::rows($page['items']);
            $pageKind = self::pageKind($rows);

            foreach ($rows as $row) {
                if (isset($scheduleRows[self::rowKey($page['page'], $row['y'])])) {
                    continue;
                }

                foreach ($row['cells'] as $cell) {
                    $tag = self::tag($cell['text'], false);

                    if ($tag === null) {
                        continue;
                    }

                    if (! isset($openings[$tag])) {
                        self::put($openings, self::shell($tag, $pageKind, $page['page']));
                    }

                    $openings[$tag]['plan_markers'][] = self::point($page, $cell);
                }
            }
        }
    }

    /**
     * @param  array<string, array<string, mixed>>  $openings
     * @return list<array<string, mixed>>
     */
    private static function finalize(array $openings): array
    {
        $finished = [];

        foreach ($openings as $opening) {
            $plan = self::uniqueMarkers($opening['plan_markers'] ?? []);
            $fallback = $opening['fallback'] ?? null;
            $markers = $plan !== [] ? $plan : array_values(array_filter([$fallback]));
            $quantity = $opening['quantity'];

            if ($quantity === null) {
                $quantity = max(1, count($plan));
            } elseif (count($plan) > (float) $quantity) {
                $quantity = count($plan);
            }

            $opening['markers'] = $markers;
            $opening['quantity'] = number_format((float) $quantity, 2, '.', '');
            $opening['requirement_page'] ??= $markers[0]['page'] ?? null;
            $opening['requirement_section'] ??= 'Drawing';
            unset($opening['plan_markers'], $opening['fallback']);
            $finished[] = $opening;
        }

        usort($finished, fn (array $a, array $b): int => strnatcasecmp($a['tag'], $b['tag']));

        return $finished;
    }

    /**
     * @param  list<array{x: float, text: string}>  $cells
     * @return list<array{x: float, role: string}>|null
     */
    private static function headerColumns(array $cells): ?array
    {
        $columns = [];

        foreach ($cells as $cell) {
            $role = self::headerRole($cell['text']);

            if ($role === null || isset($columns[$role])) {
                continue;
            }

            $columns[$role] = ['x' => $cell['x'], 'role' => $role];
        }

        $hasSize = isset($columns['width']) || isset($columns['height']) || isset($columns['size']);

        if (! isset($columns['tag']) || ! $hasSize) {
            return null;
        }

        $list = array_values($columns);
        usort($list, fn (array $a, array $b): int => $a['x'] <=> $b['x']);

        return $list;
    }

    private static function headerRole(string $text): ?string
    {
        $text = strtolower(trim($text));
        $text = trim((string) preg_replace('/[^a-z0-9#]+/', ' ', $text));

        if ($text === '' || strlen($text) > 40) {
            return null;
        }

        return match (true) {
            preg_match('/^(marks|mark|tags|tag|opening|door no|door number|door mark|door|window no|window number|window|number|no)$/', $text) === 1 => 'tag',
            preg_match('/^(width|w)\b/', $text) === 1 => 'width',
            preg_match('/^(height|ht|h)\b/', $text) === 1 => 'height',
            preg_match('/^(size|dimensions|dimension)\b/', $text) === 1 => 'size',
            preg_match('/^(quantity|count|qty)\b/', $text) === 1 => 'quantity',
            preg_match('/^(location|room|loc)\b/', $text) === 1 => 'location',
            preg_match('/^(handing|hand|swing)\b/', $text) === 1 => 'handing',
            preg_match('/^(hardware set|hardware|hdwr|hw)\b/', $text) === 1 => 'hardware',
            preg_match('/^(frame type|frame|type)\b/', $text) === 1 => 'frame',
            default => null,
        };
    }

    /**
     * @param  list<array{x: float, text: string}>  $cells
     * @param  list<array{x: float, role: string}>  $columns
     * @return array<string, string>
     */
    private static function assign(array $cells, array $columns): array
    {
        $bounds = [];
        $count = count($columns);

        for ($index = 0; $index < $count; $index++) {
            $left = $index === 0 ? -INF : ($columns[$index - 1]['x'] + $columns[$index]['x']) / 2;
            $right = $index === $count - 1 ? INF : ($columns[$index]['x'] + $columns[$index + 1]['x']) / 2;
            $bounds[] = ['role' => $columns[$index]['role'], 'left' => $left, 'right' => $right];
        }

        $values = [];

        foreach ($cells as $cell) {
            foreach ($bounds as $bound) {
                if ($cell['x'] < $bound['left'] || $cell['x'] >= $bound['right']) {
                    continue;
                }

                $values[$bound['role']] = trim(($values[$bound['role']] ?? '').' '.$cell['text']);
                break;
            }
        }

        return $values;
    }

    /**
     * @param  array<string, string>  $values
     * @return array<string, mixed>
     */
    private static function openingFromValues(string $tag, array $values, string $pageKind, int $page): array
    {
        $size = self::parseSize($values['size'] ?? '');
        $width = self::parseLength($values['width'] ?? '');
        $height = self::parseLength($values['height'] ?? '');

        if ($size !== null) {
            $width ??= ['value' => $size['width'], 'unit' => $size['unit']];
            $height ??= ['value' => $size['height'], 'unit' => $size['unit']];
        }

        $opening = self::shell($tag, $pageKind, $page);
        $opening['location'] = self::location($values['location'] ?? null);
        $opening['quantity'] = self::quantity($values['quantity'] ?? '');
        $opening['width'] = $width['value'] ?? null;
        $opening['height'] = $height['value'] ?? null;
        $opening['dimension_unit'] = self::unit($width, $height);
        $opening['frame_type'] = self::frame($values['frame'] ?? null);
        $opening['handing'] = self::handing($values['handing'] ?? null);
        $opening['hardware_set'] = self::shortText($values['hardware'] ?? null);
        $opening['requirement_page'] = $page;
        $opening['requirement_section'] = $pageKind === 'window' ? 'Window schedule' : 'Door schedule';

        return $opening;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function openingFromLine(string $line, string $pageKind, int $page): ?array
    {
        if (! preg_match('/^\s*((?:WIN|DR|WD|W|D)[-.\s]?\d{1,4}[A-Z]?)\b/i', $line, $tagMatch)) {
            return null;
        }

        $tag = self::tag($tagMatch[1], false);
        $size = self::findSize($line);

        if ($tag === null || $size === null) {
            return null;
        }

        $rest = trim(str_replace($tagMatch[1], '', $line));
        $rest = trim((string) preg_replace('/\d+\s*[\'′]\s*-?\s*\d{0,2}\s*(?:["″]|in\.?)?\s*[x×]\s*\d+\s*[\'′]\s*-?\s*\d{0,2}\s*(?:["″]|in\.?)?/iu', ' ', $rest));
        $rest = trim((string) preg_replace('/\d+(?:\.\d+)?\s*(?:mm|cm|in|["″])?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:mm|cm|in|["″])?/iu', ' ', $rest));
        $handing = null;

        if (preg_match('/\b(LHRA|RHRA|LHR|RHR|LH|RH|RR|LR)\b/i', $rest, $handMatch)) {
            $handing = strtoupper($handMatch[1]);
            $rest = trim(str_ireplace($handMatch[0], '', $rest));
        }

        $opening = self::shell($tag, $pageKind, $page);
        $opening['width'] = $size['width'];
        $opening['height'] = $size['height'];
        $opening['dimension_unit'] = $size['unit'];
        $opening['handing'] = $handing;
        $opening['location'] = self::location($rest);
        $opening['requirement_page'] = $page;
        $opening['requirement_section'] = 'Drawing';

        return $opening;
    }

    /**
     * @return array<string, mixed>
     */
    private static function shell(string $tag, string $pageKind, int $page): array
    {
        return [
            'tag' => $tag,
            'opening_type' => self::typeFromTag($tag, $pageKind),
            'location' => null,
            'quantity' => null,
            'width' => null,
            'height' => null,
            'depth' => null,
            'dimension_unit' => 'in',
            'glazing' => null,
            'finish' => null,
            'acoustic_requirement' => null,
            'notes' => null,
            'frame_type' => null,
            'handing' => null,
            'hardware_set' => null,
            'plan_markers' => [],
            'fallback' => null,
            'requirement_page' => $page,
            'requirement_section' => null,
        ];
    }

    /**
     * @param  array<string, array<string, mixed>>  $openings
     * @param  array<string, mixed>  $opening
     */
    private static function put(array &$openings, array $opening): void
    {
        $tag = $opening['tag'];

        if (! isset($openings[$tag])) {
            $openings[$tag] = $opening;

            return;
        }

        foreach (['location', 'width', 'height', 'depth', 'frame_type', 'handing', 'hardware_set', 'glazing', 'finish', 'acoustic_requirement', 'fire_requirement', 'product_category', 'notes', 'quantity', 'requirement_section', 'fallback'] as $field) {
            if (($openings[$tag][$field] ?? null) === null && ($opening[$field] ?? null) !== null) {
                $openings[$tag][$field] = $opening[$field];
            }
        }

        if (($openings[$tag]['width'] ?? null) === null && ($opening['dimension_unit'] ?? null) !== null) {
            $openings[$tag]['dimension_unit'] = $opening['dimension_unit'];
        }
    }

    private static function tag(string $text, bool $allowNumeric): ?string
    {
        $text = strtoupper(trim($text));
        $text = preg_replace('/\s+/', '', $text) ?? $text;
        $text = trim($text, '.,;:');

        if (preg_match('/^(WIN|DR|WD|W|D)[-.]?\d{1,4}[A-Z]?$/', $text) === 1) {
            return $text;
        }

        if ($allowNumeric && preg_match('/^\d{2,4}[A-Z]?$/', $text) === 1) {
            return $text;
        }

        return null;
    }

    private static function typeFromTag(string $tag, string $pageKind): string
    {
        if (str_starts_with($tag, 'WIN') || (str_starts_with($tag, 'W') && ! str_starts_with($tag, 'WD'))) {
            return 'window';
        }

        if (preg_match('/^(DR|WD|D)/', $tag) === 1) {
            return 'door';
        }

        return $pageKind === 'window' ? 'window' : 'door';
    }

    /**
     * @param  list<array{y: float, cells: list<array{x: float, text: string}>}>  $rows
     */
    private static function pageKind(array $rows): string
    {
        $text = strtolower(implode(' ', array_map(
            fn (array $row): string => implode(' ', array_column($row['cells'], 'text')),
            $rows,
        )));

        if (str_contains($text, 'window schedule') && ! str_contains($text, 'door schedule')) {
            return 'window';
        }

        return 'door';
    }

    /**
     * @return array{width: string, height: string, unit: string}|null
     */
    private static function parseSize(string $text): ?array
    {
        $text = trim($text);

        if ($text === '') {
            return null;
        }

        if (preg_match('/^(\d)(\d)(\d)(\d)$/', $text, $match) === 1) {
            $widthInches = (int) $match[2];
            $heightInches = (int) $match[4];
            $widthFeet = (int) $match[1];
            $heightFeet = (int) $match[3];

            if ($widthInches <= 11 && $heightInches <= 11 && $widthFeet >= 2 && $widthFeet <= 8 && $heightFeet >= 6 && $heightFeet <= 9) {
                return [
                    'width' => (string) (($widthFeet * 12) + $widthInches),
                    'height' => (string) (($heightFeet * 12) + $heightInches),
                    'unit' => 'in',
                ];
            }
        }

        if (preg_match('/^(.+?)\s*[x×]\s*(.+)$/iu', $text, $match) !== 1) {
            return null;
        }

        $width = self::parseLength(trim($match[1]));
        $height = self::parseLength(trim($match[2]));

        if ($width === null || $height === null) {
            return null;
        }

        return [
            'width' => $width['value'],
            'height' => $height['value'],
            'unit' => self::unit($width, $height),
        ];
    }

    /**
     * @return array{width: string, height: string, unit: string}|null
     */
    private static function findSize(string $line): ?array
    {
        $patterns = [
            '/(\d+\s*[\'′]\s*-?\s*\d{0,2}\s*(?:["″]|in\.?)?\s*[x×]\s*\d+\s*[\'′]\s*-?\s*\d{0,2}\s*(?:["″]|in\.?)?)/iu',
            '/(\d+(?:\.\d+)?\s*(?:mm|cm|in|["″])?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:mm|cm|in|["″])?)/iu',
            '/\b([2-8][0-9][6-9][0-9])\b/',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $line, $match) === 1) {
                $size = self::parseSize($match[1]);

                if ($size !== null) {
                    return $size;
                }
            }
        }

        return null;
    }

    /**
     * @return array{value: string, unit: string}|null
     */
    private static function parseLength(string $text): ?array
    {
        $text = trim($text);

        if ($text === '') {
            return null;
        }

        $feetInches = self::feetInches($text);

        if ($feetInches !== null) {
            return ['value' => $feetInches, 'unit' => 'in'];
        }

        if (preg_match('/^(\d+)\s*[-\s]\s*(\d+)\s*\/\s*(\d+)\s*(?:["″]|in\.?)?$/u', $text, $match) === 1 && (int) $match[3] > 0) {
            return ['value' => self::number(((int) $match[1]) + ((int) $match[2] / (int) $match[3])), 'unit' => 'in'];
        }

        if (preg_match('/^(\d+(?:\.\d+)?)\s*(mm|cm|in|["″])?$/iu', $text, $match) !== 1) {
            return null;
        }

        $unit = strtolower((string) ($match[2] ?? ''));
        $value = self::number((float) $match[1]);

        return match ($unit) {
            'mm' => ['value' => $value, 'unit' => 'mm'],
            'cm' => ['value' => $value, 'unit' => 'cm'],
            'in', '"', '″' => ['value' => $value, 'unit' => 'in'],
            default => ['value' => $value, 'unit' => ((float) $match[1]) >= 300 ? 'mm' : 'in'],
        };
    }

    /**
     * @param  array{value: string, unit: string}|null  $width
     * @param  array{value: string, unit: string}|null  $height
     */
    private static function unit(?array $width, ?array $height): string
    {
        $units = array_filter([$width['unit'] ?? null, $height['unit'] ?? null]);

        foreach (['mm', 'cm', 'ft', 'in'] as $unit) {
            if (in_array($unit, $units, true)) {
                return $unit;
            }
        }

        return 'in';
    }

    private static function quantity(string $text): ?float
    {
        $text = trim($text);

        if (preg_match('/^\d+(?:\.\d+)?$/', $text) !== 1) {
            return null;
        }

        $value = (float) $text;

        return $value > 0 && $value <= 9999 ? $value : null;
    }

    private static function location(mixed $text): ?string
    {
        $text = trim((string) $text);

        if ($text === '' || mb_strlen($text) > 255) {
            return null;
        }

        if (self::parseSize($text) !== null || self::handing($text) !== null || self::tag($text, false) !== null) {
            return null;
        }

        return $text;
    }

    private static function handing(mixed $text): ?string
    {
        $key = strtoupper((string) preg_replace('/[^A-Z]/', '', (string) $text));

        return in_array($key, ['LH', 'RH', 'LHR', 'RHR', 'LHRA', 'RHRA', 'RR', 'LR'], true) ? $key : null;
    }

    private static function frame(mixed $text): ?string
    {
        $text = trim((string) $text);

        if ($text === '' || mb_strlen($text) > 40 || self::handing($text) !== null) {
            return null;
        }

        $key = strtoupper((string) preg_replace('/[^A-Z]/', '', $text));

        return match ($key) {
            'HM', 'HOLLOWMETAL' => 'Hollow metal',
            'AL', 'ALUM', 'ALUMINUM' => 'Aluminum',
            'WD', 'WOOD' => 'Wood',
            'FRP' => 'FRP',
            'STL', 'STEEL' => 'Steel',
            default => $text,
        };
    }

    private static function shortText(mixed $text): ?string
    {
        $text = trim((string) $text);

        if ($text === '' || mb_strlen($text) > 40) {
            return null;
        }

        return $text;
    }

    /**
     * @param  list<array{page: int, width: float, height: float, origin_x: float, origin_y: float, items: list<array{x: float, y: float, text: string}>}>  $pages
     * @return array{name: ?string, address: ?string, city: ?string, state: ?string, postal_code: ?string, notes: ?string}
     */
    private static function projectDetails(array $pages): array
    {
        $lines = [];

        foreach ($pages as $page) {
            foreach (self::rows($page['items']) as $row) {
                $line = trim(implode(' ', array_column($row['cells'], 'text')));

                if ($line !== '') {
                    $lines[] = $line;
                }
            }
        }

        $found = self::blankProject();
        $count = count($lines);

        for ($index = 0; $index < $count; $index++) {
            $parsed = self::labeledProjectValue($lines[$index]);

            if ($parsed === null) {
                continue;
            }

            [$key, $value] = $parsed;

            if ($value === '' && isset($lines[$index + 1]) && self::labeledProjectValue($lines[$index + 1]) === null) {
                $value = trim($lines[$index + 1]);
            }

            if ($value === '' || $found[$key] !== null) {
                continue;
            }

            if ($key === 'owner') {
                $label = strtok(strtolower($lines[$index]), " \t:.#-");
                $value = ucfirst((string) $label).': '.$value;
            }

            if ($key === 'name' && self::ignoredProjectName($value)) {
                continue;
            }

            if ($key === 'state') {
                $value = strtoupper(substr((string) preg_replace('/[^A-Za-z]/', '', $value), 0, 2));

                if (strlen($value) !== 2) {
                    continue;
                }
            }

            if ($key === 'postal_code') {
                if (preg_match('/\b(\d{5}(?:-\d{4})?)\b/', $value, $zip) !== 1) {
                    continue;
                }

                $value = $zip[1];
            }

            if ($key === 'address') {
                $split = self::splitAddress($value);
                $found['address'] = $split['address'];
                $found['city'] ??= $split['city'];
                $found['state'] ??= $split['state'];
                $found['postal_code'] ??= $split['postal_code'];

                continue;
            }

            $found[$key] = mb_substr($value, 0, 255);
        }

        if ($found['city'] === null || $found['state'] === null || $found['postal_code'] === null) {
            foreach ($lines as $line) {
                if (preg_match('/^([A-Za-z][A-Za-z .\'-]{1,40}),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/', $line, $match) !== 1) {
                    continue;
                }

                $found['city'] ??= trim($match[1]);
                $found['state'] ??= $match[2];
                $found['postal_code'] ??= $match[3];
                break;
            }
        }

        $notes = [];

        if ($found['owner'] !== null) {
            $notes[] = $found['owner'];
        }

        unset($found['owner']);
        $found['notes'] = $notes === [] ? null : implode("\n", $notes);

        return $found;
    }

    /**
     * @return array{name: null, address: null, city: null, state: null, postal_code: null, notes: null, owner: null}
     */
    private static function blankProject(): array
    {
        return [
            'name' => null,
            'address' => null,
            'city' => null,
            'state' => null,
            'postal_code' => null,
            'notes' => null,
            'owner' => null,
        ];
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    private static function labeledProjectValue(string $line): ?array
    {
        if (preg_match('/^(project address|job address|site address|address|project name|project title|job name|job title|project|city|state|zip code|zip|postal code|postal|owner|client|customer)\s*[:.#-]?\s*(.*)$/i', $line, $match) !== 1) {
            return null;
        }

        $label = strtolower($match[1]);
        $key = match (true) {
            in_array($label, ['project name', 'project title', 'job name', 'job title', 'project'], true) => 'name',
            in_array($label, ['project address', 'job address', 'site address', 'address'], true) => 'address',
            $label === 'city' => 'city',
            $label === 'state' => 'state',
            in_array($label, ['zip code', 'zip', 'postal code', 'postal'], true) => 'postal_code',
            default => 'owner',
        };

        $value = trim($match[2]);

        return [$key, $value];
    }

    private static function ignoredProjectName(string $value): bool
    {
        $value = strtolower(trim($value));

        return $value === ''
            || mb_strlen($value) < 2
            || in_array($value, ['door schedule', 'window schedule', 'opening schedule', 'floor plan', 'drawing', 'schedule', 'mark', 'location'], true)
            || preg_match('/^[a-z]{1,3}-\d{2,4}$/', $value) === 1;
    }

    /**
     * @return array{address: string, city: ?string, state: ?string, postal_code: ?string}
     */
    private static function splitAddress(string $value): array
    {
        if (preg_match('/^(.*?),\s*([A-Za-z][A-Za-z .\'-]{1,40}),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/', $value, $match) === 1) {
            return [
                'address' => mb_substr(trim($match[1]), 0, 255),
                'city' => trim($match[2]),
                'state' => $match[3],
                'postal_code' => $match[4],
            ];
        }

        return [
            'address' => mb_substr($value, 0, 255),
            'city' => null,
            'state' => null,
            'postal_code' => null,
        ];
    }

    /**
     * @param  list<array{y: float, cells: list<array{x: float, text: string}>}>  $rows
     * @return array{title: ?string, number: ?string, revision: ?string}
     */
    private static function metadata(array $page, array $rows): array
    {
        $title = null;
        $number = null;
        $revision = null;
        $bottomNumber = null;

        foreach ($rows as $row) {
            $line = trim(implode(' ', array_column($row['cells'], 'text')));
            $title = self::preferTitle($title, self::sheetTitle($line));

            if ($revision === null && preg_match('/\bREV(?:ISION|\.)\s*[:#]?\s*([A-Z0-9]{1,4})\b|\bREV\s+([A-Z0-9]{1,4})\b/i', $line, $match) === 1) {
                $revision = strtoupper($match[1] !== '' ? $match[1] : $match[2]);
            }

            $candidate = self::sheetNumber($line);

            if ($candidate === null) {
                continue;
            }

            $number ??= $candidate;

            if ($row['y'] < ($page['height'] * 0.25)) {
                $bottomNumber = $candidate;
            }
        }

        return [
            'title' => $title,
            'number' => $bottomNumber ?? $number,
            'revision' => $revision,
        ];
    }

    /**
     * @param  list<array{title: ?string, number: ?string, revision: ?string}>  $pages
     * @return array{title: ?string, number: ?string, revision: ?string}
     */
    private static function chooseSheet(array $pages): array
    {
        $best = ['title' => null, 'number' => null, 'revision' => null];
        $rank = 0;

        foreach ($pages as $page) {
            $pageRank = self::titleRank($page['title']);

            if ($page['title'] !== null && $pageRank >= $rank) {
                $best = $page;
                $rank = $pageRank;
            }
        }

        if ($best['number'] === null) {
            foreach ($pages as $page) {
                if ($page['number'] !== null) {
                    $best['number'] = $page['number'];
                    break;
                }
            }
        }

        if ($best['revision'] === null) {
            foreach ($pages as $page) {
                if ($page['revision'] !== null) {
                    $best['revision'] = $page['revision'];
                    break;
                }
            }
        }

        return $best;
    }

    private static function sheetTitle(string $text): ?string
    {
        return match (true) {
            preg_match('/door(?:\s+and\s+frame)?\s+schedule/i', $text) === 1 => 'Door Schedule',
            preg_match('/window\s+schedule/i', $text) === 1 => 'Window Schedule',
            preg_match('/opening\s+schedule/i', $text) === 1 => 'Opening Schedule',
            preg_match('/floor\s+plan/i', $text) === 1 => 'Floor Plan',
            default => null,
        };
    }

    private static function preferTitle(?string $current, ?string $candidate): ?string
    {
        if ($candidate === null) {
            return $current;
        }

        if ($current === null || self::titleRank($candidate) >= self::titleRank($current)) {
            return $candidate;
        }

        return $current;
    }

    private static function titleRank(?string $title): int
    {
        return match ($title) {
            'Door Schedule' => 4,
            'Window Schedule' => 3,
            'Opening Schedule' => 2,
            'Floor Plan' => 1,
            default => 0,
        };
    }

    private static function sheetNumber(string $text): ?string
    {
        if (preg_match_all('/\b([A-Z]{1,3}-\d{2,4}(?:\.\d{1,2})?)\b/', strtoupper($text), $matches) < 1) {
            return null;
        }

        foreach ($matches[1] as $candidate) {
            $prefix = strtok($candidate, '-');

            if (in_array($prefix, ['D', 'DR', 'W', 'WD', 'WIN'], true)) {
                continue;
            }

            return $candidate;
        }

        return null;
    }

    /**
     * @param  list<array{x: float, text: string}>  $cells
     * @return array{x: float, text: string}|null
     */
    private static function tagCell(array $cells, string $tag): ?array
    {
        foreach ($cells as $cell) {
            if (self::tag($cell['text'], true) === $tag) {
                return $cell;
            }
        }

        return null;
    }

    /**
     * @return array{page: int, x: float, y: float}
     */
    private static function point(array $page, array $cell): array
    {
        $x = ($cell['x'] - $page['origin_x']) / $page['width'];
        $y = 1 - (($cell['y'] - $page['origin_y']) / $page['height']);

        return [
            'page' => $page['page'],
            'x' => min(1, max(0, $x)),
            'y' => min(1, max(0, $y)),
        ];
    }

    /**
     * @param  list<array{page: int, x: float, y: float}>  $markers
     * @return list<array{page: int, x: float, y: float}>
     */
    private static function uniqueMarkers(array $markers): array
    {
        $kept = [];

        foreach ($markers as $marker) {
            $duplicate = false;

            foreach ($kept as $existing) {
                if ($existing['page'] === $marker['page']
                    && abs($existing['x'] - $marker['x']) < 0.02
                    && abs($existing['y'] - $marker['y']) < 0.02) {
                    $duplicate = true;
                    break;
                }
            }

            if (! $duplicate) {
                $kept[] = $marker;
            }
        }

        return $kept;
    }

    private static function rowKey(int $page, float $y): string
    {
        return $page.':'.(int) round($y);
    }

    private static function raiseMemoryLimit(): void
    {
        $current = ini_get('memory_limit');

        if ($current !== '-1') {
            ini_set('memory_limit', '512M');
        }
    }

    private static function number(float $value): string
    {
        $formatted = rtrim(rtrim(number_format($value, 3, '.', ''), '0'), '.');

        return $formatted === '' ? '0' : $formatted;
    }

    /**
     * @return array{sheet_number: null, sheet_title: null, revision_label: null, document_type: string, page_count: ?int, openings: list<empty>, notes: list<string>}
     */
    private static function emptyResult(string $note, ?int $pageCount = null): array
    {
        return [
            'sheet_number' => null,
            'sheet_title' => null,
            'revision_label' => null,
            'document_type' => 'drawing',
            'page_count' => $pageCount,
            'openings' => [],
            'notes' => [$note],
            'project' => self::blankProject(),
        ];
    }
}
