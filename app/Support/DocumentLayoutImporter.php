<?php

namespace App\Support;

use PhpOffice\PhpWord\Element\AbstractContainer;
use PhpOffice\PhpWord\Element\Table;
use PhpOffice\PhpWord\Element\Text;
use PhpOffice\PhpWord\Element\TextRun;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\Style\Font;
use Smalot\PdfParser\Parser;
use Throwable;

class DocumentLayoutImporter
{
    public const MODE_TEXT = 'text';

    public const MODE_LAYOUT = 'layout';

    /**
     * @return array{elements: list<array<string, mixed>>, notes: list<string>}
     */
    public static function import(string $path, string $extension, string $mode): array
    {
        $extension = strtolower($extension);
        $blocks = $extension === 'pdf' ? self::fromPdf($path) : self::fromDocx($path);
        $notes = $blocks['notes'];
        $elements = [];

        foreach (['header', 'body', 'footer'] as $zone) {
            foreach ($blocks[$zone] ?? [] as $block) {
                $elements[] = [
                    'id' => 'imp-'.bin2hex(random_bytes(4)),
                    'type' => 'text',
                    'zone' => $zone,
                    'content' => $mode === self::MODE_TEXT ? $block['text'] : '',
                    'align' => $block['align'],
                    'width' => 100,
                    'font_size' => $block['size'],
                    'bold' => $block['bold'],
                    'italic' => $block['italic'],
                    'color' => $block['color'] ?? ($zone === 'header' ? '#ffffff' : '#111827'),
                    'height' => 16,
                ];
            }
        }

        $elements = DocumentLayoutElements::sanitize($elements);

        if ($elements === []) {
            $notes[] = 'No text could be found in this file.';
        } elseif ($mode === self::MODE_LAYOUT) {
            $notes[] = 'Only the section layout was copied. Fill in the text for each component.';
        }

        return ['elements' => $elements, 'notes' => $notes];
    }

    /**
     * @return array{header: list<array<string, mixed>>, body: list<array<string, mixed>>, footer: list<array<string, mixed>>, notes: list<string>}
     */
    private static function fromDocx(string $path): array
    {
        $result = ['header' => [], 'body' => [], 'footer' => [], 'notes' => []];

        try {
            $word = IOFactory::load($path, 'Word2007');
        } catch (Throwable) {
            $result['notes'][] = 'That Word file could not be read.';

            return $result;
        }

        $bodyBlocks = [];

        foreach ($word->getSections() as $section) {
            foreach ($section->getHeaders() as $header) {
                array_push($result['header'], ...self::docxBlocks($header));
            }
            foreach ($section->getFooters() as $footer) {
                array_push($result['footer'], ...self::docxBlocks($footer));
            }

            foreach ($section->getElements() as $element) {
                array_push($bodyBlocks, ...self::docxBlocks($element));
            }
        }

        $result['header'] = self::unique($result['header']);
        $result['footer'] = self::unique($result['footer']);

        if ($result['header'] === []) {
            $result['header'] = array_slice($bodyBlocks, 0, 3);
            $bodyBlocks = array_slice($bodyBlocks, 3);
            if ($result['header'] !== []) {
                $result['notes'][] = 'This file has no Word header, so the first lines of the page were used as the header.';
            }
        }

        $result['body'] = $bodyBlocks;

        $result['notes'][] = 'Images in the file are not imported. Add them with the Image component.';

        return $result;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function docxBlocks(mixed $container): array
    {
        $blocks = [];

        if ($container instanceof Text) {
            $block = self::docxBlock([$container], null);

            return $block ? [$block] : [];
        }

        if ($container instanceof TextRun) {
            $block = self::docxBlock($container->getElements(), $container->getParagraphStyle());

            return $block ? [$block] : [];
        }

        if ($container instanceof Table) {
            foreach ($container->getRows() as $row) {
                foreach ($row->getCells() as $cell) {
                    array_push($blocks, ...self::docxBlocks($cell));
                }
            }

            return $blocks;
        }

        if ($container instanceof AbstractContainer) {
            foreach ($container->getElements() as $element) {
                array_push($blocks, ...self::docxBlocks($element));
            }
        }

        return $blocks;
    }

    /**
     * @param  array<int, mixed>  $parts
     * @return array<string, mixed>|null
     */
    private static function docxBlock(array $parts, mixed $paragraphStyle): ?array
    {
        $text = '';
        $style = null;

        foreach ($parts as $part) {
            if (! $part instanceof Text) {
                continue;
            }
            $text .= $part->getText();
            $style ??= $part->getFontStyle();
            $paragraphStyle ??= $part->getParagraphStyle();
        }

        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');

        if ($text === '') {
            return null;
        }

        $font = $style instanceof Font ? $style : null;
        $alignment = is_object($paragraphStyle) && method_exists($paragraphStyle, 'getAlignment')
            ? $paragraphStyle->getAlignment()
            : null;
        $color = $font?->getColor();

        return [
            'text' => $text,
            'align' => match ($alignment) {
                'center' => 'center',
                'right', 'end' => 'right',
                default => 'left',
            },
            'size' => $font?->getSize() ? (int) round(((float) $font->getSize()) * 4 / 3) : 14,
            'bold' => (bool) $font?->isBold(),
            'italic' => (bool) $font?->isItalic(),
            'color' => is_string($color) && preg_match('/^[0-9A-Fa-f]{6}$/', $color) === 1 ? '#'.strtolower($color) : null,
        ];
    }

    /**
     * @return array{header: list<array<string, mixed>>, body: list<array<string, mixed>>, footer: list<array<string, mixed>>, notes: list<string>}
     */
    private static function fromPdf(string $path): array
    {
        $result = ['header' => [], 'body' => [], 'footer' => [], 'notes' => []];

        try {
            $pages = (new Parser)->parseFile($path)->getPages();
        } catch (Throwable) {
            $result['notes'][] = 'That PDF could not be read. Scanned or protected PDFs are not supported.';

            return $result;
        }

        if ($pages === []) {
            return $result;
        }

        foreach (array_slice($pages, 0, 10) as $index => $page) {
            $rows = self::pdfRows($page);
            $height = $rows['height'];
            $rows = $rows['rows'];

            if ($index > 0) {
                array_push($result['body'], ...array_map(fn (array $row): array => $row['block'], $rows));

                continue;
            }

            $header = array_filter($rows, fn (array $row): bool => $row['y'] > $height * 0.88);
            $footer = array_filter($rows, fn (array $row): bool => $row['y'] < $height * 0.08);

            if ($header === []) {
                $header = array_slice($rows, 0, 3, true);
                if ($header !== []) {
                    $result['notes'][] = 'No text was found in the top margin, so the first lines of the page were used as the header.';
                }
            }

            $middle = array_diff_key($rows, $header, $footer);
            $result['header'] = array_values(array_map(fn (array $row): array => $row['block'], $header));
            $result['footer'] = array_values(array_map(fn (array $row): array => $row['block'], $footer));
            $result['body'] = array_values(array_map(fn (array $row): array => $row['block'], $middle));
        }

        $result['notes'][] = 'Header and footer come from the first page; images are not imported.';

        return $result;
    }

    /**
     * @return array{height: float, rows: array<int, array{y: float, block: array<string, mixed>}>}
     */
    private static function pdfRows(mixed $page): array
    {
        $box = $page->getDetails()['MediaBox'] ?? [0, 0, 612, 792];
        $width = max(1.0, (float) ($box[2] ?? 612) - (float) ($box[0] ?? 0));
        $height = max(1.0, (float) ($box[3] ?? 792) - (float) ($box[1] ?? 0));

        $lines = [];

        foreach ($page->getDataTm() as [$matrix, $text]) {
            $text = trim((string) $text);
            if ($text === '') {
                continue;
            }

            $x = (float) $matrix[4];
            $y = (float) $matrix[5];
            $size = hypot((float) $matrix[2], (float) $matrix[3]);
            $key = (int) round($y / 3);

            $lines[$key]['y'] = $y;
            $lines[$key]['items'][] = ['x' => $x, 'text' => $text, 'size' => $size];
        }

        krsort($lines);
        $rows = [];

        foreach ($lines as $line) {
            usort($line['items'], fn (array $a, array $b): int => $a['x'] <=> $b['x']);
            $text = trim(preg_replace('/\s+/u', ' ', implode(' ', array_column($line['items'], 'text'))) ?? '');
            if ($text === '') {
                continue;
            }

            $first = $line['items'][0];
            $size = max(array_column($line['items'], 'size'));
            $left = $first['x'];
            $right = $left + mb_strlen($text) * ($size > 1 ? $size : 12) * 0.5;
            $center = ($left + $right) / 2;

            $rows[] = [
                'y' => $line['y'],
                'block' => [
                    'text' => $text,
                    'align' => abs($center - $width / 2) < $width * 0.06 && $left > $width * 0.15
                        ? 'center'
                        : ($left > $width * 0.55 ? 'right' : 'left'),
                    'size' => $size >= 5 && $size <= 72 ? (int) round($size * 4 / 3) : 14,
                    'bold' => false,
                    'italic' => false,
                    'color' => null,
                ],
            ];
        }

        return ['height' => $height, 'rows' => $rows];
    }

    /**
     * @param  list<array<string, mixed>>  $blocks
     * @return list<array<string, mixed>>
     */
    private static function unique(array $blocks): array
    {
        $seen = [];

        return array_values(array_filter($blocks, function (array $block) use (&$seen): bool {
            $key = $block['text'].'|'.$block['align'];
            if (isset($seen[$key])) {
                return false;
            }

            return $seen[$key] = true;
        }));
    }
}
