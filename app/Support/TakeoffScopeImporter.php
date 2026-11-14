<?php

namespace App\Support;

use App\Models\Takeoff;
use App\Models\TakeoffDocument;
use App\Models\TakeoffOpening;
use Illuminate\Support\Facades\Storage;

class TakeoffScopeImporter
{
    /**
     * @return array{scope: array<string, mixed>, import: array{created: list<array<string, mixed>>, skipped: int, markers_added: int}}
     */
    public static function attach(Takeoff $takeoff, TakeoffDocument $document, string $path): array
    {
        $scope = TakeoffPdfScope::read($path);
        self::remember($document, $scope['openings'] ?? []);
        $document->fill([
            'page_count' => $scope['page_count'] ?? $document->page_count,
            'document_type' => $document->document_type === 'drawing' && $scope['document_type'] === 'schedule'
                ? 'schedule'
                : $document->document_type,
            'sheet_number' => $document->sheet_number ?: $scope['sheet_number'],
            'sheet_title' => $document->sheet_title ?: $scope['sheet_title'],
            'revision_label' => $document->revision_label ?: $scope['revision_label'],
        ])->save();

        return [
            'scope' => $scope,
            'import' => ['created' => [], 'skipped' => 0, 'markers_added' => 0],
        ];
    }

    /**
     * @return array{scope: array<string, mixed>, import: array{created: list<array<string, mixed>>, skipped: int, markers_added: int}}
     */
    public static function scan(Takeoff $takeoff, TakeoffDocument $document): array
    {
        $disk = Storage::disk(config('takeoffs.disk'));
        $disk->delete(self::cachePath($document));
        $scope = TakeoffPdfScope::read($disk->path($document->storage_path));
        self::remember($document, $scope['openings'] ?? []);
        $document->fill([
            'page_count' => $scope['page_count'] ?? $document->page_count,
            'document_type' => $document->document_type === 'drawing' && ($scope['document_type'] ?? null) === 'schedule'
                ? 'schedule'
                : $document->document_type,
            'sheet_number' => $document->sheet_number ?: ($scope['sheet_number'] ?? null),
            'sheet_title' => $document->sheet_title ?: ($scope['sheet_title'] ?? null),
            'revision_label' => $document->revision_label ?: ($scope['revision_label'] ?? null),
        ])->save();

        return [
            'scope' => $scope,
            'import' => ['created' => [], 'skipped' => 0, 'markers_added' => 0],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function proposalsFor(Takeoff $takeoff): array
    {
        $taken = [];

        foreach ($takeoff->openings as $opening) {
            $tag = strtoupper(trim((string) $opening->tag));

            if ($tag !== '') {
                $taken[$tag] = true;
            }
        }

        $rows = [];

        foreach ($takeoff->documents as $document) {
            $dismissed = self::dismissedTags($document);

            foreach (self::storedOpenings($document) as $row) {
                $tag = strtoupper(trim((string) ($row['tag'] ?? '')));

                if ($tag === '' || isset($taken[$tag]) || isset($dismissed[$tag])) {
                    continue;
                }

                $rows[] = self::proposalPayload($document, $row);
            }
        }

        return $rows;
    }

    public static function confirm(Takeoff $takeoff, TakeoffDocument $document, string $tag, string $type): ?TakeoffOpening
    {
        $row = self::storedRow($document, $tag);

        if ($row === null) {
            return null;
        }

        $row['opening_type'] = $type === 'window' ? 'window' : 'door';
        self::import($takeoff, $document, ['openings' => [$row]]);
        $opening = $takeoff->openings()->whereRaw('upper(tag) = ?', [strtoupper(trim($tag))])->first();

        if ($opening) {
            $opening->update([
                'opening_type' => $row['opening_type'],
                'assumptions' => 'Read from the drawing and confirmed before it was added.',
                'needs_review' => false,
            ]);
            $takeoff->resequenceCounts();
        }

        return $opening;
    }

    public static function dismiss(TakeoffDocument $document, string $tag): void
    {
        $tag = strtoupper(trim($tag));

        if ($tag === '') {
            return;
        }

        $tags = self::dismissedTags($document);
        $tags[$tag] = true;
        Storage::disk(config('takeoffs.disk'))->put(
            self::dismissedPath($document),
            json_encode(array_keys($tags)) ?: '[]',
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function specsAt(TakeoffDocument $document, int $page, float $x, float $y): ?array
    {
        $match = TakeoffPdfScope::matchAt(self::cachedOpenings($document), $page, $x, $y);

        return is_array($match) ? $match : null;
    }

    /**
     * @param  list<array<string, mixed>>  $openings
     */
    public static function remember(TakeoffDocument $document, array $openings): void
    {
        Storage::disk(config('takeoffs.disk'))->put(self::cachePath($document), json_encode($openings) ?: '[]');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function cachedOpenings(TakeoffDocument $document): array
    {
        $disk = Storage::disk(config('takeoffs.disk'));
        $cache = self::cachePath($document);

        if (! $disk->exists($cache)) {
            $path = $disk->path($document->storage_path);

            if (! is_file($path)) {
                return [];
            }

            $scope = TakeoffPdfScope::read($path);
            self::remember($document, $scope['openings'] ?? []);
        }

        $decoded = json_decode($disk->get($cache) ?: '[]', true);

        return is_array($decoded) ? $decoded : [];
    }

    private static function cachePath(TakeoffDocument $document): string
    {
        return $document->storage_path.'.scope.json';
    }

    private static function dismissedPath(TakeoffDocument $document): string
    {
        return $document->storage_path.'.dismissed.json';
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function storedOpenings(TakeoffDocument $document): array
    {
        $disk = Storage::disk(config('takeoffs.disk'));
        $cache = self::cachePath($document);

        if (! $disk->exists($cache)) {
            return [];
        }

        $decoded = json_decode($disk->get($cache) ?: '[]', true);

        return is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];
    }

    /**
     * @return array<string, true>
     */
    private static function dismissedTags(TakeoffDocument $document): array
    {
        $disk = Storage::disk(config('takeoffs.disk'));
        $path = self::dismissedPath($document);

        if (! $disk->exists($path)) {
            return [];
        }

        $decoded = json_decode($disk->get($path) ?: '[]', true);
        $tags = [];

        foreach (is_array($decoded) ? $decoded : [] as $tag) {
            $tag = strtoupper(trim((string) $tag));

            if ($tag !== '') {
                $tags[$tag] = true;
            }
        }

        return $tags;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function storedRow(TakeoffDocument $document, string $tag): ?array
    {
        $wanted = strtoupper(trim($tag));

        foreach (self::storedOpenings($document) as $row) {
            if (strtoupper(trim((string) ($row['tag'] ?? ''))) === $wanted) {
                return $row;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private static function proposalPayload(TakeoffDocument $document, array $row): array
    {
        $markers = [];

        foreach ($row['markers'] ?? [] as $marker) {
            if (! is_array($marker) || (int) ($marker['page'] ?? 0) < 1) {
                continue;
            }

            $markers[] = [
                'page' => (int) $marker['page'],
                'x' => min(1, max(0, (float) ($marker['x'] ?? 0))),
                'y' => min(1, max(0, (float) ($marker['y'] ?? 0))),
            ];
        }

        $type = ($row['opening_type'] ?? '') === 'window' ? 'window' : 'door';

        return [
            'document_id' => $document->id,
            'tag' => trim((string) ($row['tag'] ?? '')),
            'opening_type' => $type,
            'location' => self::text($row['location'] ?? null),
            'quantity' => self::text($row['quantity'] ?? null),
            'width' => self::text($row['width'] ?? null),
            'height' => self::text($row['height'] ?? null),
            'depth' => self::text($row['depth'] ?? null),
            'dimension_unit' => self::text($row['dimension_unit'] ?? null) ?? 'in',
            'frame_type' => self::text($row['frame_type'] ?? null),
            'handing' => self::text($row['handing'] ?? null),
            'hardware_set' => self::text($row['hardware_set'] ?? null),
            'glazing' => self::text($row['glazing'] ?? null),
            'finish' => self::text($row['finish'] ?? null),
            'acoustic_requirement' => self::text($row['acoustic_requirement'] ?? null),
            'fire_requirement' => self::text($row['fire_requirement'] ?? null),
            'notes' => self::text($row['notes'] ?? null),
            'requirement_page' => isset($row['requirement_page']) ? (int) $row['requirement_page'] : null,
            'requirement_section' => self::text($row['requirement_section'] ?? null),
            'markers' => $markers,
        ];
    }

    private static function text(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : $text;
    }

    /**
     * @param  array<string, mixed>  $scope
     * @return array{created: list<array<string, mixed>>, skipped: int, markers_added: int}
     */
    public static function import(Takeoff $takeoff, TakeoffDocument $document, array $scope): array
    {
        $existing = $takeoff->openings()->with('markers')->get()->keyBy(
            fn (TakeoffOpening $opening): string => strtoupper((string) $opening->tag),
        );
        $sort = (int) $takeoff->openings()->max('sort_order');
        $created = [];
        $skipped = 0;
        $markersAdded = 0;

        foreach ($scope['openings'] ?? [] as $row) {
            $tag = strtoupper((string) ($row['tag'] ?? ''));

            if ($tag === '') {
                continue;
            }

            $opening = $existing->get($tag);

            if (! $opening) {
                $sort++;
                $opening = $takeoff->openings()->create([
                    'tag' => $row['tag'],
                    'is_bulk' => false,
                    'opening_type' => $row['opening_type'] === 'window' ? 'window' : 'door',
                    'location' => $row['location'] ?? null,
                    'quantity' => TakeoffMoney::money($row['quantity'] ?? 1),
                    'width' => TakeoffMoney::dimension($row['width'] ?? null),
                    'height' => TakeoffMoney::dimension($row['height'] ?? null),
                    'depth' => TakeoffMoney::dimension($row['depth'] ?? null),
                    'dimension_unit' => in_array($row['dimension_unit'] ?? 'in', config('takeoffs.units'), true) ? $row['dimension_unit'] : 'in',
                    'frame_type' => $row['frame_type'] ?? null,
                    'handing' => $row['handing'] ?? null,
                    'hardware_set' => $row['hardware_set'] ?? null,
                    'glazing' => $row['glazing'] ?? null,
                    'finish' => $row['finish'] ?? null,
                    'notes' => $row['notes'] ?? null,
                    'acoustic_requirement' => $row['acoustic_requirement'] ?? null,
                    'fire_requirement' => $row['fire_requirement'] ?? null,
                    'scope' => 'both',
                    'disposition' => 'active',
                    'verification_status' => 'recorded',
                    'needs_review' => true,
                    'assumptions' => 'Specs were read from the drawing. Remove this opening if it is not part of the work.',
                    'requirement_document_id' => $document->id,
                    'requirement_page' => $row['requirement_page'] ?? null,
                    'requirement_section' => $row['requirement_section'] ?? null,
                    'sort_order' => $sort,
                ]);
                $opening->references()->create([
                    'document_id' => $document->id,
                    'page' => $row['requirement_page'] ?? null,
                    'section' => $row['requirement_section'] ?? null,
                    'note' => 'Read from the drawing.',
                ]);
                $existing->put($tag, $opening);
                $created[] = [
                    'opening_type' => $opening->opening_type,
                    'quantity' => (string) $opening->quantity,
                ];
            } else {
                $skipped++;
            }

            $markersAdded += self::markers($opening, $document, $row['markers'] ?? []);
        }

        return [
            'created' => $created,
            'skipped' => $skipped,
            'markers_added' => $markersAdded,
        ];
    }

    /**
     * @param  array{created: list<array<string, mixed>>, skipped: int, markers_added: int}  $import
     * @param  array<string, mixed>  $scope
     */
    public static function createdMessage(bool $hadFile, array $import, array $scope): string
    {
        if (! $hadFile) {
            return 'Takeoff created.';
        }

        return self::foundMessage('Takeoff created.', $scope);
    }

    /**
     * @param  array{created: list<array<string, mixed>>, skipped: int, markers_added: int}  $import
     * @param  array<string, mixed>  $scope
     */
    public static function uploadedMessage(array $import, array $scope): string
    {
        return self::foundMessage('Drawing uploaded.', $scope);
    }

    /**
     * @param  array<string, mixed>  $scope
     */
    public static function foundMessage(string $lead, array $scope): string
    {
        $count = count(array_filter(
            $scope['openings'] ?? [],
            fn (mixed $row): bool => is_array($row) && trim((string) ($row['tag'] ?? '')) !== '',
        ));

        if ($count === 0) {
            $note = trim((string) ($scope['notes'][0] ?? ''));

            return $lead.' '.($note !== '' ? $note : 'No doors or windows could be read from this file.');
        }

        return $lead.' Found '.$count.' possible '.($count === 1 ? 'opening' : 'openings').'. Confirm each one before it is added.';
    }

    /**
     * @param  array{created: list<array<string, mixed>>, skipped: int, markers_added: int}  $import
     * @param  array<string, mixed>  $scope
     */
    private static function scanMessage(string $lead, array $import, array $scope): string
    {
        $phrase = TakeoffNamer::countPhrase($import['created']);

        if ($phrase !== '') {
            $message = $lead.' Added '.$phrase.' with their specs.';

            if ($import['skipped'] > 0) {
                $message .= ' '.$import['skipped'].' already on this takeoff '.($import['skipped'] === 1 ? 'was' : 'were').' left as is.';
            }

            return $message.' Remove any opening you will not use.';
        }

        if ($import['skipped'] > 0) {
            return $lead.' Those doors and windows are already on this takeoff.';
        }

        $note = trim((string) ($scope['notes'][0] ?? ''));

        return $lead.' '.($note !== '' ? $note : 'No doors or windows were found in this drawing.');
    }

    /**
     * @param  list<array{page?: int, x?: float, y?: float}>  $markers
     */
    private static function markers(TakeoffOpening $opening, TakeoffDocument $document, array $markers): int
    {
        $existing = $opening->markers;
        $added = 0;

        foreach ($markers as $marker) {
            $page = (int) ($marker['page'] ?? 0);
            $x = min(1, max(0, (float) ($marker['x'] ?? 0)));
            $y = min(1, max(0, (float) ($marker['y'] ?? 0)));

            if ($page < 1) {
                continue;
            }

            $close = $existing->contains(function ($current) use ($page, $x, $y): bool {
                return (int) $current->page === $page
                    && abs((float) $current->x - $x) < 0.02
                    && abs((float) $current->y - $y) < 0.02;
            });

            if ($close) {
                continue;
            }

            $created = $opening->markers()->create([
                'document_id' => $document->id,
                'page' => $page,
                'x' => number_format($x, 6, '.', ''),
                'y' => number_format($y, 6, '.', ''),
            ]);
            $existing->push($created);
            $added++;
        }

        return $added;
    }

    /**
     * @param  array<string, mixed>  $scope
     */
    private static function reason(array $scope): string
    {
        $note = trim((string) ($scope['notes'][0] ?? ''));

        if ($note === '') {
            $note = 'No door or window tags were found in the text of this PDF.';
        }

        return lcfirst($note);
    }
}
