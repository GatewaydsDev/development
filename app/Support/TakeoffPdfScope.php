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
    public static function read(string $path): array
    {
        self::raiseMemoryLimit();

        try {
            $parsed = (new Parser)->parseFile($path);
            $pdfPages = array_values($parsed->getPages());
        } catch (Throwable) {
            return self::emptyResult('The PDF could not be read. Scanned or protected files need a text layer.');
        }

        $pages = [];
        $count = count($pdfPages);

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
        }

        $result = self::fromPages($pages);
        $result['page_count'] = $count > 0 ? $count : null;

        if ($count > 30) {
            $result['notes'][] = 'Only the first 30 pages were read.';
        }

        return $result;
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
    public static function fromPages(array $pages): array
    {
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

        foreach ($pages as $page) {
            $rows = self::rows($page['items']);
            $meta[] = ['page' => $page] + self::metadata($page, $rows);
            $schedule = self::readSchedule($page, $rows, $openings);
            $sawSchedule = $sawSchedule || $schedule['found'];
            $scheduleRows += $schedule['rows'];
        }

        self::readLines($pages, $scheduleRows, $openings);
        self::readMarkers($pages, $scheduleRows, $openings);
        $sawSchedule = self::readArchitectural($pages, $openings) || $sawSchedule;
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

        foreach (['location', 'width', 'height', 'depth', 'frame_type', 'handing', 'hardware_set', 'glazing', 'finish', 'acoustic_requirement', 'notes', 'quantity', 'requirement_section', 'fallback'] as $field) {
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
        ];
    }
}
