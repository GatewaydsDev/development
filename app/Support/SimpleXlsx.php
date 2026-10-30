<?php

namespace App\Support;

use DOMDocument;
use DOMXPath;
use RuntimeException;
use ZipArchive;

class SimpleXlsx
{
    /**
     * @return array<string, list<array<int, string>>>
     */
    public static function read(string $path): array
    {
        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            throw new RuntimeException('That workbook could not be read.');
        }

        $workbook = $zip->getFromName('xl/workbook.xml');
        $rels = $zip->getFromName('xl/_rels/workbook.xml.rels');

        if ($workbook === false || $rels === false) {
            $zip->close();

            throw new RuntimeException('That workbook could not be read.');
        }

        $strings = self::sharedStrings($zip);
        $targets = [];

        foreach (self::nodes($rels, 'Relationship') as $relationship) {
            $targets[$relationship->getAttribute('Id')] = $relationship->getAttribute('Target');
        }

        $sheets = [];

        foreach (self::nodes($workbook, 'sheet') as $sheet) {
            $name = $sheet->getAttribute('name');
            $id = $sheet->getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');

            if ($id === '') {
                $id = $sheet->getAttribute('r:id');
            }

            $target = $targets[$id] ?? null;

            if ($target === null) {
                continue;
            }

            $target = ltrim($target, '/');

            if (! str_starts_with($target, 'xl/')) {
                $target = 'xl/'.$target;
            }

            $xml = $zip->getFromName($target);

            if ($xml === false) {
                continue;
            }

            $sheets[$name] = self::rows($xml, $strings);
        }

        $zip->close();

        return $sheets;
    }

    /**
     * @param  array<string, list<list<string|int|float|null>>>  $sheets
     */
    public static function save(array $sheets, string $path): void
    {
        $zip = new ZipArchive;

        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('The Excel file could not be created.');
        }

        $zip->addFromString('[Content_Types].xml', self::contentTypes(count($sheets)));
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>');

        $workbookSheets = '';
        $workbookRels = '';
        $index = 1;

        foreach ($sheets as $name => $rows) {
            $safeName = self::sheetName((string) $name);
            $workbookSheets .= '<sheet name="'.self::xml($safeName).'" sheetId="'.$index.'" r:id="rId'.$index.'"/>';
            $workbookRels .= '<Relationship Id="rId'.$index.'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'.$index.'.xml"/>';
            $zip->addFromString('xl/worksheets/sheet'.$index.'.xml', self::worksheet($rows));
            $index++;
        }

        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets>'.$workbookSheets.'</sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'.$workbookRels.'</Relationships>');
        $zip->close();
    }

    /**
     * @return list<array<int, string>>
     */
    private static function rows(string $xml, array $strings): array
    {
        $rows = [];

        foreach (self::nodes($xml, 'row') as $row) {
            $cells = [];

            foreach (self::childNodes($row, 'c') as $cell) {
                $reference = $cell->getAttribute('r');
                $column = self::columnNumber((string) preg_replace('/\d+/', '', $reference));

                if ($column < 1) {
                    continue;
                }

                $cells[$column] = self::cellValue($cell, $strings);
            }

            if ($cells !== []) {
                $rows[] = $cells;
            }
        }

        return $rows;
    }

    /**
     * @param  list<string>  $strings
     */
    private static function cellValue(\DOMElement $cell, array $strings): string
    {
        $type = $cell->getAttribute('t');

        if ($type === 'inlineStr') {
            return self::textNodes($cell);
        }

        $value = '';

        foreach (self::childNodes($cell, 'v') as $node) {
            $value = $node->textContent;
            break;
        }

        if ($type === 's') {
            return $strings[(int) $value] ?? '';
        }

        if ($type === 'b') {
            return $value === '1' ? 'Yes' : 'No';
        }

        return $value;
    }

    /**
     * @return list<string>
     */
    private static function sharedStrings(ZipArchive $zip): array
    {
        $xml = $zip->getFromName('xl/sharedStrings.xml');

        if ($xml === false) {
            return [];
        }

        $strings = [];

        foreach (self::nodes($xml, 'si') as $item) {
            $strings[] = self::textNodes($item);
        }

        return $strings;
    }

    private static function textNodes(\DOMElement $element): string
    {
        $text = '';

        foreach (self::descendantNodes($element, 't') as $node) {
            $text .= $node->textContent;
        }

        return $text;
    }

    /**
     * @return list<\DOMElement>
     */
    private static function nodes(string $xml, string $name): array
    {
        $document = new DOMDocument;

        if (@$document->loadXML($xml, LIBXML_NONET) !== true) {
            return [];
        }

        $xpath = new DOMXPath($document);
        $found = [];

        foreach ($xpath->query('//*[local-name()="'.$name.'"]') ?: [] as $node) {
            if ($node instanceof \DOMElement) {
                $found[] = $node;
            }
        }

        return $found;
    }

    /**
     * @return list<\DOMElement>
     */
    private static function childNodes(\DOMElement $element, string $name): array
    {
        $found = [];

        foreach ($element->childNodes as $node) {
            if ($node instanceof \DOMElement && $node->localName === $name) {
                $found[] = $node;
            }
        }

        return $found;
    }

    /**
     * @return list<\DOMElement>
     */
    private static function descendantNodes(\DOMElement $element, string $name): array
    {
        $found = [];
        $xpath = new DOMXPath($element->ownerDocument);

        foreach ($xpath->query('.//*[local-name()="'.$name.'"]', $element) ?: [] as $node) {
            if ($node instanceof \DOMElement) {
                $found[] = $node;
            }
        }

        return $found;
    }

    private static function columnNumber(string $letters): int
    {
        $number = 0;

        foreach (str_split(strtoupper($letters)) as $letter) {
            if ($letter < 'A' || $letter > 'Z') {
                continue;
            }

            $number = $number * 26 + (ord($letter) - 64);
        }

        return $number;
    }

    /**
     * @param  list<list<string|int|float|null>>  $rows
     */
    private static function worksheet(array $rows): string
    {
        $body = '';
        $rowNumber = 1;

        foreach ($rows as $row) {
            $cells = '';
            $column = 1;

            foreach ($row as $value) {
                $reference = self::columnLetters($column).$rowNumber;
                $cells .= self::cellXml($reference, $value);
                $column++;
            }

            $body .= '<row r="'.$rowNumber.'">'.$cells.'</row>';
            $rowNumber++;
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'.$body.'</sheetData></worksheet>';
    }

    private static function cellXml(string $reference, string|int|float|null $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        if (is_int($value) || is_float($value)) {
            return '<c r="'.$reference.'"><v>'.$value.'</v></c>';
        }

        return '<c r="'.$reference.'" t="inlineStr"><is><t>'.self::xml($value).'</t></is></c>';
    }

    private static function columnLetters(int $column): string
    {
        $letters = '';

        while ($column > 0) {
            $column--;
            $letters = chr(65 + ($column % 26)).$letters;
            $column = intdiv($column, 26);
        }

        return $letters;
    }

    private static function contentTypes(int $sheets): string
    {
        $overrides = '';

        for ($index = 1; $index <= $sheets; $index++) {
            $overrides .= '<Override PartName="/xl/worksheets/sheet'.$index.'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .$overrides
            .'</Types>';
    }

    private static function sheetName(string $name): string
    {
        $name = str_replace(['\\', '/', '?', '*', '[', ']'], ' ', $name);
        $name = trim($name);

        return $name === '' ? 'Sheet' : mb_substr($name, 0, 31);
    }

    private static function xml(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
