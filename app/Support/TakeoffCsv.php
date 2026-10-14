<?php

namespace App\Support;

class TakeoffCsv
{
    public const COLUMNS = [
        'tag',
        'is_bulk',
        'opening_type',
        'location',
        'quantity',
        'product_category',
        'width',
        'height',
        'depth',
        'dimension_unit',
        'frame_type',
        'handing',
        'hardware_set',
        'glazing',
        'finish',
        'manufacturer',
        'product_model',
        'scope',
        'notes',
        'exclusions',
        'assumptions',
        'acoustic_requirement',
        'rf_requirement',
        'fire_requirement',
        'ballistic_requirement',
        'other_requirements',
        'requirement_page',
        'requirement_section',
    ];

    /**
     * @return array{rows: list<array<string, mixed>>, errors: list<array{row: int, messages: list<string>}>}
     */
    public static function parse(string $contents): array
    {
        $contents = preg_replace('/^\xEF\xBB\xBF/', '', $contents) ?? $contents;
        $handle = fopen('php://temp', 'r+');

        if ($handle === false) {
            return ['rows' => [], 'errors' => [['row' => 1, 'messages' => ['The file could not be read.']]]];
        }

        fwrite($handle, $contents);
        rewind($handle);
        $header = fgetcsv($handle);

        if (! is_array($header)) {
            fclose($handle);

            return ['rows' => [], 'errors' => [['row' => 1, 'messages' => ['The file has no header row.']]]];
        }

        $header = array_map(fn ($column) => strtolower(trim((string) $column)), $header);

        if ($header !== self::COLUMNS) {
            fclose($handle);

            return ['rows' => [], 'errors' => [['row' => 1, 'messages' => ['Use the takeoff import template. The columns do not match.']]]];
        }

        $rows = [];
        $errors = [];
        $number = 1;

        while (($data = fgetcsv($handle)) !== false) {
            $number++;

            if (self::blankRow($data)) {
                continue;
            }

            $values = [];

            foreach (self::COLUMNS as $index => $column) {
                $values[$column] = trim((string) ($data[$index] ?? ''));
            }

            $messages = self::validate($values);

            if ($messages !== []) {
                $errors[] = ['row' => $number, 'messages' => $messages];

                continue;
            }

            $rows[] = self::normalize($values) + ['row' => $number];
        }

        fclose($handle);

        return ['rows' => $rows, 'errors' => $errors];
    }

    public static function template(): string
    {
        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, self::COLUMNS);
        rewind($handle);
        $contents = stream_get_contents($handle) ?: '';
        fclose($handle);

        return $contents;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    public static function export(array $rows): string
    {
        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, self::COLUMNS);

        foreach ($rows as $row) {
            $line = [];

            foreach (self::COLUMNS as $column) {
                $line[] = self::cell((string) ($row[$column] ?? ''));
            }

            fputcsv($handle, $line);
        }

        rewind($handle);
        $contents = stream_get_contents($handle) ?: '';
        fclose($handle);

        return "\xEF\xBB\xBF".$contents;
    }

    /**
     * @param  array<string, string>  $values
     * @return list<string>
     */
    private static function validate(array $values): array
    {
        $messages = [];
        $bulk = self::truthy($values['is_bulk']);

        if (! $bulk && $values['tag'] === '') {
            $messages[] = 'A tagged opening needs an opening tag.';
        }

        if (! in_array($values['opening_type'], config('takeoffs.opening_types'), true)) {
            $messages[] = 'Opening type must be door or window.';
        }

        if ($values['quantity'] === '' || ! is_numeric($values['quantity']) || (float) $values['quantity'] <= 0) {
            $messages[] = 'Quantity must be a number greater than zero.';
        }

        foreach (['width', 'height', 'depth'] as $dimension) {
            if ($values[$dimension] !== '' && ! is_numeric($values[$dimension])) {
                $messages[] = ucfirst($dimension).' must be a number or blank.';
            }
        }

        if (! in_array($values['dimension_unit'], config('takeoffs.units'), true)) {
            $messages[] = 'Dimension unit must be in, ft, mm, or cm.';
        }

        if (! in_array($values['scope'], config('takeoffs.scopes'), true)) {
            $messages[] = 'Scope must be supply, installation, or both.';
        }

        if ($values['requirement_page'] !== '' && ! ctype_digit($values['requirement_page'])) {
            $messages[] = 'Requirement page must be a whole number or blank.';
        }

        return $messages;
    }

    /**
     * @param  array<string, string>  $values
     * @return array<string, mixed>
     */
    private static function normalize(array $values): array
    {
        return [
            'tag' => $values['tag'] !== '' ? $values['tag'] : null,
            'is_bulk' => self::truthy($values['is_bulk']),
            'opening_type' => $values['opening_type'],
            'location' => $values['location'] !== '' ? $values['location'] : null,
            'quantity' => TakeoffMoney::money($values['quantity']),
            'product_category' => $values['product_category'] !== '' ? $values['product_category'] : null,
            'width' => TakeoffMoney::dimension($values['width'] !== '' ? $values['width'] : null),
            'height' => TakeoffMoney::dimension($values['height'] !== '' ? $values['height'] : null),
            'depth' => TakeoffMoney::dimension($values['depth'] !== '' ? $values['depth'] : null),
            'dimension_unit' => $values['dimension_unit'],
            'frame_type' => $values['frame_type'] !== '' ? $values['frame_type'] : null,
            'handing' => $values['handing'] !== '' ? $values['handing'] : null,
            'hardware_set' => $values['hardware_set'] !== '' ? $values['hardware_set'] : null,
            'glazing' => $values['glazing'] !== '' ? $values['glazing'] : null,
            'finish' => $values['finish'] !== '' ? $values['finish'] : null,
            'manufacturer' => $values['manufacturer'] !== '' ? $values['manufacturer'] : null,
            'product_model' => $values['product_model'] !== '' ? $values['product_model'] : null,
            'scope' => $values['scope'],
            'notes' => $values['notes'] !== '' ? $values['notes'] : null,
            'exclusions' => $values['exclusions'] !== '' ? $values['exclusions'] : null,
            'assumptions' => $values['assumptions'] !== '' ? $values['assumptions'] : null,
            'acoustic_requirement' => $values['acoustic_requirement'] !== '' ? $values['acoustic_requirement'] : null,
            'rf_requirement' => $values['rf_requirement'] !== '' ? $values['rf_requirement'] : null,
            'fire_requirement' => $values['fire_requirement'] !== '' ? $values['fire_requirement'] : null,
            'ballistic_requirement' => $values['ballistic_requirement'] !== '' ? $values['ballistic_requirement'] : null,
            'other_requirements' => $values['other_requirements'] !== '' ? $values['other_requirements'] : null,
            'requirement_page' => $values['requirement_page'] !== '' ? (int) $values['requirement_page'] : null,
            'requirement_section' => $values['requirement_section'] !== '' ? $values['requirement_section'] : null,
        ];
    }

    /**
     * @param  array<int, string|null>  $data
     */
    private static function blankRow(array $data): bool
    {
        foreach ($data as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }

    private static function truthy(string $value): bool
    {
        return in_array(strtolower($value), ['1', 'true', 'yes', 'y'], true);
    }

    public static function cell(string $value): string
    {
        if (preg_match('/^[=+\-@\t\r]/', $value) === 1) {
            return "'".$value;
        }

        return $value;
    }
}
