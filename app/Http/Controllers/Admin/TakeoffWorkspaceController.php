<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AuthorizesTakeoffs;
use App\Http\Controllers\Controller;
use App\Models\OpeningCategory;
use App\Models\Takeoff;
use App\Models\TakeoffAssemblyTemplate;
use App\Models\TakeoffCost;
use App\Models\TakeoffDocument;
use App\Models\TakeoffGroup;
use App\Models\TakeoffMarker;
use App\Models\TakeoffMarkup;
use App\Models\TakeoffOpening;
use App\Models\TakeoffReference;
use App\Models\TakeoffOpeningType;
use App\Models\TakeoffSection;
use App\Models\TakeoffSupplierQuote;
use App\Models\User;
use App\Support\ProjectControlTakeoff;
use App\Support\TakeoffAccess;
use App\Support\TakeoffGrouping;
use App\Support\TakeoffMoney;
use App\Support\TakeoffNamer;
use App\Support\TakeoffPdfScope;
use App\Support\TakeoffScopeImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TakeoffWorkspaceController extends Controller
{
    use AuthorizesTakeoffs;

    public function storeDocument(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        TakeoffPdfScope::assertUploaded($request->file('file'));
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:'.config('takeoffs.max_kilobytes')],
            'document_type' => ['required', Rule::in(config('takeoffs.document_types'))],
            'revision_label' => ['nullable', 'string', 'max:100'],
            'sheet_number' => ['nullable', 'string', 'max:50'],
            'sheet_title' => ['nullable', 'string', 'max:255'],
        ]);

        $path = $this->storePdf($data['file'], 'takeoffs/'.$takeoff->id);
        $document = $takeoff->documents()->create([
            'original_filename' => $data['file']->getClientOriginalName(),
            'storage_path' => $path,
            'mime' => 'application/pdf',
            'size' => $data['file']->getSize(),
            'document_type' => $data['document_type'],
            'revision_label' => $this->blank($data['revision_label'] ?? null),
            'sheet_number' => $this->blank($data['sheet_number'] ?? null),
            'sheet_title' => $this->blank($data['sheet_title'] ?? null),
            'uploaded_by' => $user->id,
        ]);
        $attached = TakeoffScopeImporter::attach(
            $takeoff,
            $document,
            Storage::disk(config('takeoffs.disk'))->path($path),
        );
        $renamed = TakeoffNamer::apply($takeoff, $attached['scope']);
        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'document.uploaded', 'Uploaded '.$document->original_filename.'.', [
            'document_id' => $document->id,
            'title' => $renamed ? $takeoff->title : null,
        ]);

        return back()->with('success', TakeoffScopeImporter::uploadedMessage($attached['import'], $attached['scope']));
    }

    public function scanDocument(Request $request, Takeoff $takeoff, TakeoffDocument $document): RedirectResponse|JsonResponse|StreamedResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedDocument($takeoff, $document);
        $token = $request->string('progress')->toString();
        $tracked = Str::isUuid($token);
        $write = function (int $percent, string $label, bool $done = false) use ($document, $token, $tracked): void {
            if (! $tracked) {
                return;
            }

            $current = Cache::get($this->scanProgressKey($document, $token));
            $percent = max((int) ($current['percent'] ?? 0), max(0, min(100, $percent)));
            Cache::put($this->scanProgressKey($document, $token), [
                'percent' => $percent,
                'label' => $label,
                'done' => $done,
            ], now()->addMinutes(15));
        };

        if (str_contains((string) $request->header('Accept'), 'text/event-stream')) {
            return response()->stream(function () use ($takeoff, $document, $user, $write): void {
                @ini_set('zlib.output_compression', '0');
                @ini_set('implicit_flush', '1');
                $emit = function (int $percent, string $label, bool $done = false, ?string $message = null) use ($write): void {
                    $write($percent, $label, $done);
                    $this->emitScanEvent([
                        'percent' => max(0, min(100, $percent)),
                        'label' => $label,
                        'done' => $done,
                        'message' => $message,
                    ]);
                };

                try {
                    $emit(4, 'Opening the drawing');
                    $scanned = TakeoffScopeImporter::scan($takeoff, $document, function (int $percent, string $label) use ($emit): void {
                        $emit($percent, $label);
                    });
                    $renamed = TakeoffNamer::apply($takeoff, $scanned['scope']);
                    $this->clearApproval($takeoff, $user);
                    $takeoff->record($user, 'document.scanned', 'Scanned '.$document->original_filename.' for doors and windows.', [
                        'document_id' => $document->id,
                        'title' => $renamed ? $takeoff->title : null,
                    ]);
                    $message = TakeoffScopeImporter::foundMessage('Drawing scanned.', $scanned['scope']);
                    $emit(100, $message, true, $message);
                } catch (\Throwable $exception) {
                    report($exception);
                    $write(100, 'The drawing could not be read.', true);
                    $this->emitScanEvent([
                        'percent' => 100,
                        'label' => 'The drawing could not be read.',
                        'done' => true,
                        'message' => 'The drawing could not be read.',
                        'error' => true,
                    ]);
                }
            }, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache, no-store',
                'X-Accel-Buffering' => 'no',
            ]);
        }

        $write(1, 'Opening the drawing');

        if ($tracked) {
            $request->session()->save();
            session_write_close();
        }

        $scanned = TakeoffScopeImporter::scan($takeoff, $document, $write);
        $renamed = TakeoffNamer::apply($takeoff, $scanned['scope']);
        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'document.scanned', 'Scanned '.$document->original_filename.' for doors and windows.', [
            'document_id' => $document->id,
            'title' => $renamed ? $takeoff->title : null,
        ]);
        $message = TakeoffScopeImporter::foundMessage('Drawing scanned.', $scanned['scope']);
        $write(100, $message, true);

        if ($request->expectsJson()) {
            return response()->json([
                'message' => $message,
                'percent' => 100,
            ]);
        }

        return back()->with('success', $message);
    }

    public function scanProgress(Request $request, Takeoff $takeoff, TakeoffDocument $document, string $progress): JsonResponse
    {
        abort_unless(TakeoffAccess::canView($this->takeoffUser($request)), 403);
        $this->ownedDocument($takeoff, $document);
        abort_unless(Str::isUuid($progress), 404);
        $row = Cache::get($this->scanProgressKey($document, $progress));

        return response()->json([
            'percent' => (int) ($row['percent'] ?? 0),
            'label' => (string) ($row['label'] ?? 'Starting'),
            'done' => (bool) ($row['done'] ?? false),
        ]);
    }

    public function confirmProposal(Request $request, Takeoff $takeoff, TakeoffDocument $document): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedDocument($takeoff, $document);
        $data = $request->validate([
            'tag' => ['required', 'string', 'max:40'],
            'opening_type' => ['required', Rule::in(['door', 'window'])],
        ]);
        $opening = TakeoffScopeImporter::confirm($takeoff, $document, $data['tag'], $data['opening_type']);
        abort_unless($opening, 422);
        $this->clearApproval($takeoff, $user);
        app(ProjectControlTakeoff::class)->connectTakeoff($takeoff);
        $takeoff->record($user, 'opening.confirmed', 'Confirmed '.$opening->tag.' from '.$document->original_filename.'.');

        return back()->with('success', $opening->tag.' added with the measurements and location read from the drawing.');
    }

    public function dismissProposal(Request $request, Takeoff $takeoff, TakeoffDocument $document): RedirectResponse
    {
        $this->ensureEditable($request, $takeoff);
        $this->ownedDocument($takeoff, $document);
        $data = $request->validate([
            'tag' => ['required', 'string', 'max:40'],
        ]);
        TakeoffScopeImporter::dismiss($document, $data['tag']);

        return back()->with('success', $data['tag'].' was skipped.');
    }

    public function updateDocument(Request $request, Takeoff $takeoff, TakeoffDocument $document): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedDocument($takeoff, $document);
        $data = $request->validate([
            'document_type' => ['required', Rule::in(config('takeoffs.document_types'))],
            'revision_label' => ['nullable', 'string', 'max:100'],
            'sheet_number' => ['nullable', 'string', 'max:50'],
            'sheet_title' => ['nullable', 'string', 'max:255'],
        ]);

        $document->update([
            'document_type' => $data['document_type'],
            'revision_label' => $this->blank($data['revision_label'] ?? null),
            'sheet_number' => $this->blank($data['sheet_number'] ?? null),
            'sheet_title' => $this->blank($data['sheet_title'] ?? null),
        ]);
        $takeoff->record($user, 'document.updated', 'Updated details for '.$document->original_filename.'.');

        return back()->with('success', 'Document details saved.');
    }

    public function updateRotation(Request $request, Takeoff $takeoff, TakeoffDocument $document): RedirectResponse
    {
        $this->ensureEditable($request, $takeoff);
        $this->ownedDocument($takeoff, $document);
        $data = $request->validate([
            'rotation' => ['required', 'integer', Rule::in([0, 90, 180, 270])],
        ]);
        $document->update(['rotation' => (int) $data['rotation']]);

        return back();
    }

    public function storeMarkup(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $data = $request->validate([
            'document_id' => ['required', 'integer'],
            'page' => ['required', 'integer', 'min:1'],
            'kind' => ['required', Rule::in(['pen', 'box'])],
            'color' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'points' => ['required', 'array', 'min:2', 'max:500'],
            'points.*.x' => ['required', 'numeric', 'between:0,1'],
            'points.*.y' => ['required', 'numeric', 'between:0,1'],
        ]);
        $this->document($takeoff, (int) $data['document_id']);
        $takeoff->markups()->create([
            'document_id' => $data['document_id'],
            'page' => $data['page'],
            'kind' => $data['kind'],
            'color' => strtoupper($data['color']),
            'points' => array_map(fn (array $point): array => [
                'x' => round((float) $point['x'], 5),
                'y' => round((float) $point['y'], 5),
            ], $data['points']),
            'created_by' => $user->id,
        ]);

        return back();
    }

    public function destroyMarkup(Request $request, Takeoff $takeoff, TakeoffMarkup $markup): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        abort_unless($markup->takeoff_id === $takeoff->id, 404);
        $removed = 0;

        if ($markup->kind === 'openings') {
            $posted = $request->input('opening_ids', []);
            $posted = is_array($posted) ? $posted : [];
            $openings = $takeoff->openings()->whereIn('id', $this->openingIdsForMark($takeoff, $markup, $posted))->get();

            foreach ($openings as $opening) {
                $opening->delete();
            }

            $removed = $openings->count();

            if ($removed > 0) {
                $takeoff->resequenceCounts();
                $this->clearApproval($takeoff, $user);
                $takeoff->record($user, 'section.openings.removed', $removed === 1
                    ? 'Removed 1 opening with its selection.'
                    : 'Removed '.$removed.' openings with their selection.');
            }
        }

        $markup->delete();

        $message = $removed === 0
            ? 'Selection removed.'
            : ($removed === 1
                ? 'Removed the selection and 1 opening.'
                : 'Removed the selection and '.$removed.' openings.');

        return redirect()
            ->route('admin.takeoffs.show', $takeoff)
            ->with('success', $message);
    }

    public function readSection(Request $request, Takeoff $takeoff): JsonResponse|StreamedResponse
    {
        $this->ensureEditable($request, $takeoff);
        $data = $request->validate([
            'document_id' => ['required', 'integer'],
            'page' => ['required', 'integer', 'min:1', 'max:500'],
            'x' => ['required', 'numeric', 'between:0,1'],
            'y' => ['required', 'numeric', 'between:0,1'],
            'x2' => ['required', 'numeric', 'between:0,1'],
            'y2' => ['required', 'numeric', 'between:0,1'],
        ]);
        $document = $this->document($takeoff, (int) $data['document_id']);
        $path = Storage::disk(config('takeoffs.disk'))->path($document->storage_path);
        $read = function (?callable $progress = null) use ($path, $data): array {
            return is_file($path)
                ? TakeoffPdfScope::clip($path, (int) $data['page'], (float) $data['x'], (float) $data['y'], (float) $data['x2'], (float) $data['y2'], $progress)
                : ['title' => '', 'body' => ''];
        };

        if (str_contains((string) $request->header('Accept'), 'text/event-stream')) {
            return response()->stream(function () use ($read): void {
                @ini_set('zlib.output_compression', '0');
                @ini_set('implicit_flush', '1');
                $emit = function (int $percent, string $label, bool $done = false, ?string $title = null, ?string $body = null, bool $error = false): void {
                    $this->emitScanEvent([
                        'percent' => max(0, min(100, $percent)),
                        'label' => $label,
                        'done' => $done,
                        'message' => $error ? $label : null,
                        'title' => $title,
                        'body' => $body,
                        'error' => $error,
                    ]);
                };

                try {
                    $clip = $read(function (int $percent, string $label) use ($emit): void {
                        $emit($percent, $label);
                    });

                    if ($clip['body'] === '') {
                        $emit(100, 'No text was found in that area. Scanned drawings need a text layer.', true, '', '', true);

                        return;
                    }

                    $emit(100, 'Section ready', true, $clip['title'], $clip['body']);
                } catch (\Throwable $exception) {
                    report($exception);
                    $emit(100, 'That part of the drawing could not be read.', true, '', '', true);
                }
            }, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache, no-store',
                'X-Accel-Buffering' => 'no',
            ]);
        }

        return response()->json($read());
    }

    public function storeSection(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $data = $this->sectionData($request);
        $this->document($takeoff, (int) $data['document_id']);
        $takeoff->sections()->create([
            ...$data,
            'created_by' => $user->id,
        ]);
        $takeoff->record($user, 'section.saved', 'Saved section '.$data['title'].'.');

        return back()->with('success', 'Section saved.');
    }

    public function updateSection(Request $request, Takeoff $takeoff, TakeoffSection $section): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        abort_unless($section->takeoff_id === $takeoff->id, 404);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
        ]);
        $title = trim($data['title']);
        $body = trim($data['body']);
        abort_if($title === '' || $body === '', 422);
        $section->update([
            'title' => $title,
            'body' => $body,
        ]);
        $takeoff->record($user, 'section.updated', 'Updated section '.$section->title.'.');

        return back()->with('success', 'Section saved.');
    }

    public function destroySection(Request $request, Takeoff $takeoff, TakeoffSection $section): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        abort_unless($section->takeoff_id === $takeoff->id, 404);
        $title = $section->title;
        $removed = $this->removeSectionOpenings($takeoff, $section);
        $section->delete();
        $takeoff->resequenceCounts();
        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'section.deleted', 'Removed section '.$title.'.');

        return back()->with('success', $removed === 0
            ? 'Section removed.'
            : ($removed === 1 ? 'Section removed, along with 1 opening.' : 'Section removed, along with '.$removed.' openings.'));
    }

    public function openingsFromSection(Request $request, Takeoff $takeoff, TakeoffSection $section): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        abort_unless($section->takeoff_id === $takeoff->id, 404);
        $document = $this->document($takeoff, (int) $section->document_id);
        $rows = TakeoffPdfScope::openingsFromSection($section->title, (string) $section->body, (int) $section->page);

        if ($rows === []) {
            return back()->with('error', 'No openings were found in '.$section->title.'. Use a door or window schedule, with a mark on each line such as D1 or W1.');
        }

        $result = TakeoffScopeImporter::importSection($takeoff, $document, $rows);
        $this->clearApproval($takeoff, $user);
        app(ProjectControlTakeoff::class)->connectTakeoff($takeoff->fresh() ?? $takeoff);
        $takeoff->resequenceCounts();
        $takeoff->record($user, 'section.openings', $this->sectionOpeningSummary($section->title, $result));

        return back()->with('success', $this->sectionOpeningSummary($section->title, $result));
    }

    public function openingsFromText(Request $request, Takeoff $takeoff): JsonResponse|RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $data = $request->validate([
            'document_id' => ['required', 'integer'],
            'page' => ['required', 'integer', 'min:1', 'max:500'],
            'opening_type' => ['required', 'string', 'max:80'],
            'title' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
            'x' => ['nullable', 'numeric', 'between:0,1'],
            'y' => ['nullable', 'numeric', 'between:0,1'],
            'x2' => ['nullable', 'numeric', 'between:0,1'],
            'y2' => ['nullable', 'numeric', 'between:0,1'],
        ]);
        $document = $this->document($takeoff, (int) $data['document_id']);
        $rawType = trim($data['opening_type']);
        $lowerType = strtolower($rawType);
        $lowerType = $lowerType === 'windows' ? 'window' : ($lowerType === 'doors' ? 'door' : $lowerType);
        $type = $lowerType === 'window' || $lowerType === 'door' ? $lowerType : $rawType;
        $title = trim((string) ($data['title'] ?? ''));

        if ($title === '') {
            $title = $type === 'window' ? 'Window' : ($type === 'door' ? 'Door' : $type);
        }

        $body = trim($data['body']);
        $rows = TakeoffPdfScope::openingsFromSection($title, $body, (int) $data['page'], $type);
        $named = $type === 'window' ? 'window' : ($type === 'door' ? 'door' : $type);
        if ($rows === []) {
            $message = 'This '.$named.' selection cannot be created. No marks were found inside the box.';

            return $request->expectsJson()
                ? response()->json(['ok' => false, 'message' => $message, 'openings' => []], 422)
                : redirect()->route('admin.takeoffs.show', $takeoff)->with('error', $message);
        }

        $parsed = $rows;
        $takeoff->unsetRelation('openings');
        $known = [];

        foreach ($takeoff->openings()->pluck('tag') as $savedTag) {
            $savedTag = strtoupper(trim((string) $savedTag));

            if ($savedTag !== '') {
                $known[$savedTag] = true;
            }
        }

        $fresh = [];
        $already = 0;

        foreach ($rows as $row) {
            $tag = strtoupper(trim((string) ($row['tag'] ?? '')));

            if ($tag !== '' && isset($known[$tag])) {
                $already++;

                continue;
            }

            $fresh[] = $row;
        }

        $label = $type === 'window' ? 'Window' : ($type === 'door' ? 'Door' : $type);
        TakeoffOpeningType::remember($label);

        if ($fresh === []) {
            $message = 'Those openings are already on the list.';
            $markup = $this->rememberOpeningMark($takeoff, $document, $data, $label, (int) $user->id, $this->idsForTags($takeoff, $rows), $body);
            $takeoff->record($user, 'section.openings', $message);

            return $request->expectsJson()
                ? response()->json(['ok' => true, 'message' => $message, 'openings' => [], 'markup_id' => $markup?->id])
                : redirect()->route('admin.takeoffs.show', $takeoff)
                    ->with('success', $message)
                    ->with('created_openings', [])
                    ->with('created_markup_id', $markup?->id);
        }

        $rows = $fresh;
        $result = TakeoffScopeImporter::importSection($takeoff, $document, $rows);
        $this->clearApproval($takeoff, $user);
        app(ProjectControlTakeoff::class)->connectTakeoff($takeoff->fresh() ?? $takeoff);
        $takeoff->resequenceCounts();
        $summary = $this->sectionOpeningSummary($title, $result);

        if ($already > 0) {
            $summary .= $already === 1
                ? ' 1 opening was already on the list and was not added.'
                : ' '.$already.' openings were already on the list and were not added.';
        }

        $takeoff->record($user, 'section.openings', $summary);
        $createdIds = array_flip($result['created_ids'] ?? []);
        $openings = array_values(array_filter(array_map(fn (array $row): array => [
            'id' => (int) ($row['id'] ?? 0),
            'tag' => (string) ($row['tag'] ?? ''),
            'opening_type' => $type,
            'quantity' => (string) ($row['quantity'] ?? '1.00'),
            'width' => $row['width'] ?? null,
            'height' => $row['height'] ?? null,
            'location' => $row['location'] ?? null,
        ], $result['openings'] ?? []), fn (array $row): bool => isset($createdIds[$row['id']])));
        $linkedIds = array_values(array_unique(array_merge(
            $this->idsForTags($takeoff, $parsed),
            array_map('intval', $result['created_ids'] ?? []),
        )));
        $markup = $this->rememberOpeningMark($takeoff, $document, $data, $label, (int) $user->id, $linkedIds, $body);
        $numbers = $this->numberSelection($takeoff, $document, $data, $this->inReadingOrder($openings, $body), $type);
        $openings = array_map(function (array $row) use ($numbers): array {
            $row['callout'] = $numbers[(int) ($row['id'] ?? 0)] ?? null;

            return $row;
        }, $openings);

        if ($request->expectsJson()) {
            return response()->json([
                'ok' => true,
                'message' => $summary,
                'openings' => $openings,
                'markup_id' => $markup?->id,
            ]);
        }

        return redirect()
            ->route('admin.takeoffs.show', $takeoff)
            ->with('success', $summary)
            ->with('created_openings', $openings)
            ->with('created_markup_id', $markup?->id);
    }

    public function forgetOpenings(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer'],
            'section_id' => ['nullable', 'integer'],
        ]);
        $openings = $takeoff->openings()->whereIn('id', $data['ids'])->get();
        $section = isset($data['section_id'])
            ? $takeoff->sections()->whereKey((int) $data['section_id'])->first()
            : null;

        foreach ($openings as $opening) {
            $opening->delete();
        }

        $section?->delete();

        $takeoff->resequenceCounts();
        $this->clearApproval($takeoff, $user);
        $count = $openings->count();
        $takeoff->record($user, 'section.openings.removed', $count === 1 ? 'Removed 1 opening from a cancelled selection.' : 'Removed '.$count.' openings from a cancelled selection.');

        return redirect()
            ->route('admin.takeoffs.show', $takeoff)
            ->with('success', $count === 1 ? 'Removed 1 opening from the selection.' : 'Removed '.$count.' openings from the selection.');
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<array<string, mixed>>  $created
     * @return array<int, string>
     */
    private function numberSelection(Takeoff $takeoff, TakeoffDocument $document, array $data, array $created, string $type): array
    {
        if ($created === [] || ! isset($data['x'], $data['y'], $data['x2'], $data['y2'])) {
            return [];
        }

        $prefix = $this->countPrefix($type);
        $number = $this->nextCountNumber($takeoff, $prefix);
        $left = min((float) $data['x'], (float) $data['x2']);
        $right = max((float) $data['x'], (float) $data['x2']);
        $top = min((float) $data['y'], (float) $data['y2']);
        $bottom = max((float) $data['y'], (float) $data['y2']);
        $count = count($created);
        $span = max(0.0, $bottom - $top);
        $pitch = $count <= 1 ? 1.0 : $span / ($count - 1);
        $crowded = $count > 1 && $pitch < 0.045;
        $startRoom = $left;
        $endRoom = 1 - $right;
        $atEnd = ($crowded || $startRoom < 0.07) && ($endRoom >= 0.07 || $endRoom > $startRoom);
        $step = $count <= 1 ? 0.0 : max(0.045, $pitch);
        $end = $top + ($step * max(0, $count - 1));
        $shift = $end > 0.98 ? $end - 0.98 : 0.0;

        if ($atEnd) {
            $column = min(0.98, $right + 0.055);
            $anchorX = max(0.02, min($right - 0.012, $column - 0.04));
        } else {
            $column = max(0.02, $left - 0.055);
            $anchorX = min(0.98, max($column + 0.04, min($right - 0.01, $left + 0.012)));
        }
        $assigned = [];
        $sort = (int) $takeoff->openings()->whereNotIn('id', array_map(fn (array $row): int => (int) ($row['id'] ?? 0), $created))->max('sort_order');

        foreach (array_values($created) as $index => $row) {
            $opening = $takeoff->openings()->whereKey((int) ($row['id'] ?? 0))->first();

            if (! $opening instanceof TakeoffOpening) {
                continue;
            }

            $callout = $prefix.$number;
            $number++;
            $sort++;
            $y = max(0.02, min(0.98, $top + ($step * $index) - $shift));
            $opening->update(['callout' => $callout, 'sort_order' => $sort]);
            $assigned[(int) $opening->id] = $callout;
            $this->createMarker($takeoff, $opening, [
                'document_id' => $document->id,
                'page' => (int) $data['page'],
                'x' => $anchorX,
                'y' => $y,
                'label_x' => $column,
                'label_y' => $y,
            ]);
        }

        return $assigned;
    }

    /**
     * @param  list<array<string, mixed>>  $openings
     * @return list<array<string, mixed>>
     */
    private function inReadingOrder(array $openings, string $body): array
    {
        $upper = strtoupper($body);

        usort($openings, function (array $left, array $right) use ($upper): int {
            $leftAt = strpos($upper, strtoupper((string) ($left['tag'] ?? '')));
            $rightAt = strpos($upper, strtoupper((string) ($right['tag'] ?? '')));

            return ($leftAt === false ? PHP_INT_MAX : $leftAt) <=> ($rightAt === false ? PHP_INT_MAX : $rightAt);
        });

        return array_values($openings);
    }

    private function storedOpeningType(string $type): string
    {
        $display = TakeoffOpeningType::remember($type);

        if ($display === null) {
            return 'door';
        }

        $lower = mb_strtolower($display);

        if ($lower === 'window') {
            return 'window';
        }

        if ($lower === 'door') {
            return 'door';
        }

        return $display;
    }

    private function countPrefix(string $type): string
    {
        $name = strtolower(trim($type));

        if ($name === 'window' || $name === 'windows') {
            return 'W';
        }

        if ($name === 'door' || $name === 'doors') {
            return 'D';
        }

        $letter = strtoupper(mb_substr($name, 0, 1));

        return preg_match('/^[A-Z]$/', $letter) === 1 ? $letter : 'D';
    }

    private function nextCountNumber(Takeoff $takeoff, string $prefix): int
    {
        $max = 0;

        foreach ($takeoff->openings()->get(['tag', 'callout', 'counted_tag']) as $opening) {
            foreach ([$opening->callout, $opening->counted_tag ? $opening->tag : null] as $value) {
                if (preg_match('/^'.preg_quote($prefix, '/').'(\d+)$/i', (string) $value, $match) === 1) {
                    $max = max($max, (int) $match[1]);
                }
            }
        }

        return $max + 1;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<int>  $openingIds
     */
    private function rememberOpeningMark(Takeoff $takeoff, TakeoffDocument $document, array $data, string $label, int $userId, array $openingIds, string $body): ?TakeoffMarkup
    {
        if (! isset($data['x'], $data['y'], $data['x2'], $data['y2'])) {
            return null;
        }

        return $takeoff->markups()->create([
            'document_id' => $document->id,
            'page' => (int) $data['page'],
            'kind' => 'openings',
            'color' => '#4F46E5',
            'label' => $label,
            'opening_ids' => array_values(array_unique(array_filter(array_map('intval', $openingIds)))),
            'body' => mb_substr($body, 0, 20000),
            'points' => [
                ['x' => round((float) $data['x'], 5), 'y' => round((float) $data['y'], 5)],
                ['x' => round((float) $data['x2'], 5), 'y' => round((float) $data['y2'], 5)],
            ],
            'created_by' => $userId,
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<int>
     */
    private function idsForTags(Takeoff $takeoff, array $rows): array
    {
        $tags = [];

        foreach ($rows as $row) {
            $tag = strtoupper(trim((string) ($row['tag'] ?? '')));

            if ($tag !== '') {
                $tags[$tag] = true;
            }
        }

        if ($tags === []) {
            return [];
        }

        return $takeoff->openings()->get()
            ->filter(fn (TakeoffOpening $opening): bool => isset($tags[strtoupper(trim((string) $opening->tag))]))
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @param  list<mixed>  $posted
     * @return list<int>
     */
    private function openingIdsForMark(Takeoff $takeoff, TakeoffMarkup $markup, array $posted): array
    {
        $ids = [];

        foreach ([...($markup->opening_ids ?? []), ...$posted] as $id) {
            $id = (int) $id;

            if ($id > 0) {
                $ids[$id] = $id;
            }
        }

        $body = trim((string) $markup->body);

        if ($body !== '') {
            $label = trim((string) ($markup->label ?: 'Door'));
            $rows = TakeoffPdfScope::openingsFromSection($label, $body, (int) $markup->page, $label);

            foreach ($this->idsForTags($takeoff, $rows) as $id) {
                $ids[$id] = $id;
            }
        }

        if ($ids !== []) {
            return array_values($ids);
        }

        if ($markup->created_at === null) {
            return [];
        }

        return $takeoff->openings()
            ->where('requirement_document_id', $markup->document_id)
            ->where('requirement_page', $markup->page)
            ->whereBetween('created_at', [$markup->created_at->copy()->subMinutes(10), $markup->created_at->copy()->addSeconds(10)])
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->all();
    }

    private function removeSectionOpenings(Takeoff $takeoff, TakeoffSection $section): int
    {
        $ids = array_values(array_filter(array_map('intval', $section->opening_ids ?? [])));

        if ($ids === []) {
            $type = strtolower(trim($section->title));
            $asType = match ($type) {
                'door', 'doors' => 'door',
                'window', 'windows' => 'window',
                default => $section->title,
            };
            $rows = TakeoffPdfScope::openingsFromSection($section->title, (string) $section->body, (int) $section->page, $asType);
            $tags = array_map(fn (array $row): string => strtoupper((string) ($row['tag'] ?? '')), $rows);
            $ids = $takeoff->openings()->get()
                ->filter(fn ($opening): bool => in_array(strtoupper((string) $opening->tag), $tags, true))
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();
        }

        $openings = $takeoff->openings()->whereIn('id', $ids)->get();

        foreach ($openings as $opening) {
            $opening->delete();
        }

        return $openings->count();
    }

    /**
     * @param  array{created: int, doors: int, windows: int, filled: int, skipped: int, openings?: list<array<string, mixed>>}  $result
     */
    private function sectionOpeningSummary(string $title, array $result): string
    {
        $parts = [];

        if ($result['created'] > 0) {
            $kinds = [];

            if ($result['doors'] > 0) {
                $kinds[] = $result['doors'] === 1 ? '1 door' : $result['doors'].' doors';
            }

            if ($result['windows'] > 0) {
                $kinds[] = $result['windows'] === 1 ? '1 window' : $result['windows'].' windows';
            }

            foreach ($result['others'] ?? [] as $name => $count) {
                $kinds[] = ((int) $count === 1 ? '1 ' : $count.' ').$name;
            }

            if ($kinds !== []) {
                $parts[] = 'Added '.implode(' and ', $kinds).' from '.$title.'.';
            }
        }

        if ($result['filled'] > 0) {
            $parts[] = $result['filled'] === 1
                ? 'Filled missing details on 1 opening already on the list.'
                : 'Filled missing details on '.$result['filled'].' openings already on the list.';
        }

        if ($parts === []) {
            return 'Those openings are already on the list.';
        }

        return implode(' ', $parts);
    }

    /**
     * @return array{document_id: int, page: int, title: string, body: string, x: float, y: float, x2: float, y2: float}
     */
    private function sectionData(Request $request): array
    {
        $data = $request->validate([
            'document_id' => ['required', 'integer'],
            'page' => ['required', 'integer', 'min:1', 'max:500'],
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
            'x' => ['required', 'numeric', 'between:0,1'],
            'y' => ['required', 'numeric', 'between:0,1'],
            'x2' => ['required', 'numeric', 'between:0,1'],
            'y2' => ['required', 'numeric', 'between:0,1'],
        ]);

        $title = trim($data['title']);
        $body = trim($data['body']);
        abort_if($title === '' || $body === '', 422);

        return [
            'document_id' => (int) $data['document_id'],
            'page' => (int) $data['page'],
            'title' => $title,
            'body' => $body,
            'x' => round((float) $data['x'], 6),
            'y' => round((float) $data['y'], 6),
            'x2' => round((float) $data['x2'], 6),
            'y2' => round((float) $data['y2'], 6),
        ];
    }

    public function destroyDocument(Request $request, Takeoff $takeoff, TakeoffDocument $document): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedDocument($takeoff, $document);
        $name = $document->original_filename;
        $document->delete();
        $takeoff->record($user, 'document.deleted', 'Removed document '.$name.'.');

        return back()->with('success', 'Document removed.');
    }

    public function showDocument(Request $request, Takeoff $takeoff, TakeoffDocument $document): BinaryFileResponse
    {
        abort_unless(TakeoffAccess::canView($this->takeoffUser($request)), 403);
        $this->ownedDocument($takeoff, $document);
        $filename = str_replace(['"', '\\', "\r", "\n"], '', $document->original_filename);

        return response()->file(Storage::disk(config('takeoffs.disk'))->path($document->storage_path), [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function storeCount(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $data = $request->validate([
            'opening_type' => ['required', Rule::in(['door', 'window'])],
            'document_id' => ['required', 'integer'],
            'page' => ['required', 'integer', 'min:1', 'max:500'],
            'x' => ['required', 'numeric', 'between:0,1'],
            'y' => ['required', 'numeric', 'between:0,1'],
            'x2' => ['nullable', 'numeric', 'between:0,1'],
            'y2' => ['nullable', 'numeric', 'between:0,1'],
        ]);
        $document = $this->document($takeoff, (int) $data['document_id']);
        $hasBox = isset($data['x2'], $data['y2']);
        $markX = $hasBox ? ((float) $data['x'] + (float) $data['x2']) / 2 : (float) $data['x'];
        $markY = $hasBox ? ((float) $data['y'] + (float) $data['y2']) / 2 : (float) $data['y'];
        $specs = TakeoffScopeImporter::specsAt($document, (int) $data['page'], $markX, $markY) ?? [];
        $type = ($specs['opening_type'] ?? $data['opening_type']) === 'window' ? 'window' : 'door';
        $tag = strtoupper(trim((string) ($specs['tag'] ?? '')));
        $countedTag = false;

        if ($tag === '') {
            $tag = $this->nextCountTag($takeoff, $type === 'window' ? 'W' : 'D');
            $countedTag = true;
        } elseif ($takeoff->openings()->whereRaw('upper(tag) = ?', [$tag])->exists()) {
            return back()->with('error', 'Door '.$tag.' is already on this scope.');
        }

        $fromSchedule = ($specs['width'] ?? null) !== null;
        $unit = $specs['dimension_unit'] ?? 'in';
        $opening = $takeoff->openings()->create([
            'tag' => $tag,
            'counted_tag' => $countedTag,
            'is_bulk' => false,
            'opening_type' => $type,
            'location' => $specs['location'] ?? null,
            'quantity' => TakeoffMoney::money(1),
            'width' => TakeoffMoney::dimension($specs['width'] ?? null),
            'height' => TakeoffMoney::dimension($specs['height'] ?? null),
            'depth' => TakeoffMoney::dimension($specs['depth'] ?? null),
            'dimension_unit' => in_array($unit, config('takeoffs.units'), true) ? $unit : 'in',
            'frame_type' => $specs['frame_type'] ?? null,
            'handing' => $specs['handing'] ?? null,
            'hardware_set' => $specs['hardware_set'] ?? null,
            'glazing' => $specs['glazing'] ?? null,
            'finish' => $specs['finish'] ?? null,
            'notes' => $specs['notes'] ?? null,
            'acoustic_requirement' => $specs['acoustic_requirement'] ?? null,
            'fire_requirement' => $specs['fire_requirement'] ?? null,
            'scope' => 'both',
            'disposition' => 'active',
            'verification_status' => 'recorded',
            'needs_review' => true,
            'assumptions' => $fromSchedule
                ? 'Size, room, frame, hardware, and the other schedule specs were taken from the row you clicked. Confirm them before pricing.'
                : 'Counted on the drawing. No schedule row was under that click, so the specs are blank.',
            'requirement_document_id' => $document->id,
            'requirement_page' => $data['page'],
            'requirement_section' => $fromSchedule ? ($specs['requirement_section'] ?? 'Door schedule') : 'Drawing',
            'sort_order' => ((int) $takeoff->openings()->max('sort_order')) + 1,
        ]);
        $this->createMarker($takeoff, $opening, $data);
        $takeoff->resequenceCounts();
        $opening->refresh();
        $tag = (string) $opening->tag;
        $opening->references()->create([
            'document_id' => $document->id,
            'page' => $data['page'],
            'section' => $opening->requirement_section,
            'note' => $fromSchedule ? 'Specs read from the schedule row at this mark.' : 'Marked on the drawing.',
        ]);
        $this->clearApproval($takeoff, $user);
        app(ProjectControlTakeoff::class)->connectTakeoff($takeoff);
        $takeoff->record($user, 'opening.counted', 'Counted '.$tag.' on the drawing.');

        return back()
            ->with('success', $fromSchedule ? $tag.' added with the specs from that schedule row.' : $tag.' marked. No schedule row was under that click.')
            ->with('counted_opening_id', $opening->id);
    }

    public function storeOpening(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $data = $this->validatedOpening($request, $takeoff);
        $opening = $takeoff->openings()->create($this->openingAttributes($data, $user) + [
            'sort_order' => ((int) $takeoff->openings()->max('sort_order')) + 1,
        ]);

        if (! empty($data['marker'])) {
            $this->createMarker($takeoff, $opening, $data['marker']);
        }

        $this->clearApproval($takeoff, $user);
        app(ProjectControlTakeoff::class)->connectTakeoff($takeoff);
        $takeoff->record($user, 'opening.created', 'Added opening '.$opening->label().'.');

        return back()->with('success', 'Opening saved.');
    }

    public function updateOpening(Request $request, Takeoff $takeoff, TakeoffOpening $opening): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedOpening($takeoff, $opening);
        $this->guardFresh($request, $opening);
        $data = $this->validatedOpening($request, $takeoff);
        $attributes = $this->openingAttributes($data, $user, $opening);

        if (($attributes['tag'] ?? null) !== $opening->tag) {
            $attributes['counted_tag'] = false;
        }

        $opening->update($attributes);

        if ($opening->group_id) {
            $this->refreshMismatch($opening->group);
        }

        $this->clearApproval($takeoff, $user);
        app(ProjectControlTakeoff::class)->reflectOpening($opening->fresh() ?? $opening);
        $takeoff->record($user, 'opening.updated', 'Updated opening '.$opening->label().'.');

        return back()->with('success', 'Opening saved.');
    }

    public function destroyOpening(Request $request, Takeoff $takeoff, TakeoffOpening $opening): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedOpening($takeoff, $opening);
        $label = $opening->label();
        $opening->delete();
        $takeoff->resequenceCounts();
        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'opening.deleted', 'Removed opening '.$label.'.');

        return back()->with('success', 'Opening removed.');
    }

    public function updateCallout(Request $request, Takeoff $takeoff, TakeoffOpening $opening): RedirectResponse
    {
        $this->ensureEditable($request, $takeoff);
        $this->ownedOpening($takeoff, $opening);
        $data = $request->validate([
            'callout' => ['nullable', 'string', 'max:12'],
        ]);
        $opening->update([
            'callout' => $this->blank($data['callout'] ?? null),
        ]);
        app(ProjectControlTakeoff::class)->reflectOpening($opening->fresh() ?? $opening);

        return back()->with('success', 'Count number updated.');
    }

    public function storeMarker(Request $request, Takeoff $takeoff, TakeoffOpening $opening): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedOpening($takeoff, $opening);
        $data = $request->validate($this->markerRules());
        $this->createMarker($takeoff, $opening, $data);
        $takeoff->record($user, 'marker.created', 'Added a drawing marker to '.$opening->label().'. Quantity was not changed.');

        return back()->with('success', 'Marker added. Quantity stays '.$opening->quantity.'.');
    }

    public function updateMarker(Request $request, Takeoff $takeoff, TakeoffMarker $marker): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        abort_unless((int) $marker->opening->takeoff_id === (int) $takeoff->id, 404);
        $data = $request->validate([
            'x' => ['required', 'numeric', 'between:0,1'],
            'y' => ['required', 'numeric', 'between:0,1'],
            'page' => ['required', 'integer', 'min:1', 'max:500'],
            'label_x' => ['nullable', 'numeric', 'between:0,1'],
            'label_y' => ['nullable', 'numeric', 'between:0,1'],
            'x2' => ['nullable', 'numeric', 'between:0,1'],
            'y2' => ['nullable', 'numeric', 'between:0,1'],
        ]);
        $changes = [
            'x' => bcadd(TakeoffMoney::raw($data['x']), '0', 6),
            'y' => bcadd(TakeoffMoney::raw($data['y']), '0', 6),
            'page' => $data['page'],
        ];

        if ($request->exists('x2') || $request->exists('y2')) {
            $changes['x2'] = isset($data['x2']) ? bcadd(TakeoffMoney::raw($data['x2']), '0', 6) : null;
            $changes['y2'] = isset($data['y2']) ? bcadd(TakeoffMoney::raw($data['y2']), '0', 6) : null;
        }

        if ($request->exists('label_x') || $request->exists('label_y')) {
            $changes['label_x'] = isset($data['label_x']) ? bcadd(TakeoffMoney::raw($data['label_x']), '0', 6) : null;
            $changes['label_y'] = isset($data['label_y']) ? bcadd(TakeoffMoney::raw($data['label_y']), '0', 6) : null;
        }

        $marker->update($changes);
        $takeoff->record($user, 'marker.updated', 'Moved a count arrow for '.$marker->opening->label().'.');

        return back()->with('success', 'Count arrow moved.');
    }

    public function destroyMarker(Request $request, Takeoff $takeoff, TakeoffMarker $marker): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        abort_unless((int) $marker->opening->takeoff_id === (int) $takeoff->id, 404);
        $marker->delete();
        $takeoff->record($user, 'marker.deleted', 'Removed a drawing marker.');

        return back()->with('success', 'Marker removed.');
    }

    public function storeReference(Request $request, Takeoff $takeoff, TakeoffOpening $opening): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedOpening($takeoff, $opening);
        $data = $request->validate([
            'document_id' => ['nullable', 'integer'],
            'page' => ['nullable', 'integer', 'min:1'],
            'section' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        if (! empty($data['document_id'])) {
            $this->ownedDocument($takeoff, $this->document($takeoff, (int) $data['document_id']));
        }

        $opening->references()->create([
            'document_id' => $data['document_id'] ?? null,
            'page' => $data['page'] ?? null,
            'section' => $this->blank($data['section'] ?? null),
            'note' => $this->blank($data['note'] ?? null),
        ]);
        $takeoff->record($user, 'reference.created', 'Added a reference to '.$opening->label().'. Quantity was not changed.');

        return back()->with('success', 'Reference added.');
    }

    public function destroyReference(Request $request, Takeoff $takeoff, TakeoffReference $reference): RedirectResponse
    {
        $this->ensureEditable($request, $takeoff);
        abort_unless((int) $reference->opening->takeoff_id === (int) $takeoff->id, 404);
        $reference->delete();

        return back()->with('success', 'Reference removed.');
    }

    public function storeGroup(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'opening_ids' => ['required', 'array', 'min:1'],
            'opening_ids.*' => ['integer'],
        ]);
        $openings = $this->openingsFor($takeoff, $data['opening_ids']);
        $group = $takeoff->groups()->create([
            'name' => $data['name'],
            'manual' => true,
            'mismatch' => $openings->map(fn (TakeoffOpening $opening): string => TakeoffGrouping::signature($opening))->unique()->count() > 1,
            'sort_order' => ((int) $takeoff->groups()->max('sort_order')) + 1,
        ]);
        TakeoffOpening::query()->whereIn('id', $openings->pluck('id'))->update(['group_id' => $group->id]);
        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'group.created', $group->mismatch
            ? 'Created manual group '.$group->name.' with a configuration mismatch warning.'
            : 'Created group '.$group->name.'.');

        return back()->with('success', $group->mismatch
            ? 'Group saved with a warning because the openings do not all match.'
            : 'Group saved.');
    }

    public function destroyGroup(Request $request, Takeoff $takeoff, TakeoffGroup $group): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        abort_unless((int) $group->takeoff_id === (int) $takeoff->id, 404);
        $name = $group->name;
        $group->openings()->update(['group_id' => null]);
        $group->delete();
        $takeoff->record($user, 'group.deleted', 'Removed group '.$name.'. Opening records were kept.');

        return back()->with('success', 'Group removed. Openings were kept.');
    }

    public function autoGroup(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $buckets = [];

        foreach ($takeoff->openings()->whereNull('group_id')->where('disposition', 'active')->get() as $opening) {
            $buckets[TakeoffGrouping::signature($opening)][] = $opening;
        }

        $created = 0;

        foreach ($buckets as $openings) {
            if (count($openings) < 2) {
                continue;
            }

            $first = $openings[0];
            $group = $takeoff->groups()->create([
                'name' => trim(($first->product_category ?: ucfirst($first->opening_type)).' '.$first->width.' x '.$first->height),
                'manual' => false,
                'mismatch' => false,
                'sort_order' => ((int) $takeoff->groups()->max('sort_order')) + 1,
            ]);
            TakeoffOpening::query()->whereIn('id', collect($openings)->pluck('id'))->update(['group_id' => $group->id]);
            $created++;
        }

        $takeoff->record($user, 'group.auto', 'Grouped '.$created.' matching assembly set(s).');

        return back()->with('success', $created.' matching group(s) created.');
    }

    public function storeCost(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensurePriced($request, $takeoff);
        $data = $this->validatedCost($request, $takeoff);
        $takeoff->costs()->create($data);
        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'pricing.updated', 'Added a '.$data['kind'].' cost.');

        return back()->with('success', 'Cost saved.');
    }

    public function updateCost(Request $request, Takeoff $takeoff, TakeoffCost $cost): RedirectResponse
    {
        $user = $this->ensurePriced($request, $takeoff);
        abort_unless((int) $cost->takeoff_id === (int) $takeoff->id, 404);
        $cost->update($this->validatedCost($request, $takeoff));
        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'pricing.updated', 'Updated a '.$cost->kind.' cost.');

        return back()->with('success', 'Cost saved.');
    }

    public function destroyCost(Request $request, Takeoff $takeoff, TakeoffCost $cost): RedirectResponse
    {
        $user = $this->ensurePriced($request, $takeoff);
        abort_unless((int) $cost->takeoff_id === (int) $takeoff->id, 404);
        $cost->delete();
        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'pricing.updated', 'Removed a cost.');

        return back()->with('success', 'Cost removed.');
    }

    public function storeQuote(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensurePriced($request, $takeoff);
        $takeoff->supplierQuotes()->create($this->quoteAttributes($request, $takeoff, $user));
        $takeoff->record($user, 'supplier_quote.created', 'Added a supplier quotation.');

        return back()->with('success', 'Supplier quote saved.');
    }

    public function reviseQuote(Request $request, Takeoff $takeoff, TakeoffSupplierQuote $quote): RedirectResponse
    {
        $user = $this->ensurePriced($request, $takeoff);
        $this->ownedQuote($takeoff, $quote);
        $attributes = $this->quoteAttributes($request, $takeoff, $user);
        $attributes['supersedes_id'] = $quote->id;
        $attributes['accepted_at'] = null;
        $takeoff->supplierQuotes()->create($attributes);
        $takeoff->record($user, 'supplier_quote.revised', 'Added a new supplier quote revision. The previous accepted pricing was kept.');

        return back()->with('success', 'New supplier quote revision saved. The previous revision was not overwritten.');
    }

    public function acceptQuote(Request $request, Takeoff $takeoff, TakeoffSupplierQuote $quote): RedirectResponse
    {
        $user = $this->ensurePriced($request, $takeoff);
        $this->ownedQuote($takeoff, $quote);

        if ($quote->accepted_at) {
            return back()->with('success', 'This supplier quote revision is already accepted.');
        }

        $quote->update(['accepted_at' => now()]);
        $takeoff->record($user, 'supplier_quote.accepted', 'Accepted supplier quote '.($quote->quote_number ?: $quote->supplier_name).'.');

        return back()->with('success', 'Supplier quote accepted.');
    }

    public function showQuote(Request $request, Takeoff $takeoff, TakeoffSupplierQuote $quote): BinaryFileResponse
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canViewPricing($user), 403);
        $this->ownedQuote($takeoff, $quote);
        abort_unless($quote->storage_path, 404);
        $filename = str_replace(['"', '\\', "\r", "\n"], '', (string) $quote->original_filename);

        return response()->file(Storage::disk(config('takeoffs.disk'))->path($quote->storage_path), [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function storeTemplate(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $data = $this->validatedTemplate($request);
        TakeoffAssemblyTemplate::query()->create($data + ['created_by' => $user->id]);
        $takeoff->record($user, 'template.created', 'Saved assembly template '.$data['name'].'.');

        return back()->with('success', 'Assembly template saved.');
    }

    public function applyTemplate(Request $request, Takeoff $takeoff, TakeoffOpening $opening): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedOpening($takeoff, $opening);
        $template = TakeoffAssemblyTemplate::query()->findOrFail($request->validate([
            'template_id' => ['required', 'integer'],
        ])['template_id']);
        $snapshot = $template->snapshot();
        $opening->update([
            'template_id' => $template->id,
            'template_snapshot' => $snapshot,
            'opening_type' => $template->opening_type,
            'product_category' => $template->product_category,
            'frame_type' => $template->frame_type,
            'handing' => $template->handing,
            'hardware_set' => $template->hardware_set,
            'glazing' => $template->glazing,
            'finish' => $template->finish,
            'manufacturer' => $template->manufacturer,
            'product_model' => $template->product_model,
            'product_id' => $template->product_id,
        ]);
        $opening->costs()->where('from_template', true)->delete();

        foreach ($template->default_costs ?? [] as $index => $cost) {
            $opening->costs()->create([
                'takeoff_id' => $takeoff->id,
                'kind' => $cost['kind'] ?? 'material',
                'basis' => $cost['basis'] ?? 'per_unit',
                'description' => $cost['description'] ?? $template->name,
                'amount' => isset($cost['amount']) ? TakeoffMoney::money($cost['amount']) : null,
                'labor_hours' => isset($cost['labor_hours']) ? TakeoffMoney::money($cost['labor_hours']) : null,
                'hourly_rate' => isset($cost['hourly_rate']) ? TakeoffMoney::money($cost['hourly_rate']) : null,
                'from_template' => true,
                'sort_order' => $index,
            ]);
        }

        $this->clearApproval($takeoff, $user);
        app(ProjectControlTakeoff::class)->reflectOpening($opening->fresh() ?? $opening);
        $takeoff->record($user, 'template.applied', 'Applied template '.$template->name.' to '.$opening->label().'. The template itself was not changed.');

        return back()->with('success', 'Template applied as a snapshot.');
    }

    /**
     * @return list<array{opening: ?TakeoffOpening, attributes: array<string, mixed>, marker: ?array<string, mixed>}>
     */
    public function validatedOpeningDrafts(Takeoff $takeoff, User $user, mixed $drafts): array
    {
        if (! is_array($drafts) || $drafts === []) {
            return [];
        }

        return $this->prepareOpeningDrafts($takeoff, $user, $drafts);
    }

    /**
     * @param  list<array{opening: ?TakeoffOpening, attributes: array<string, mixed>, marker: ?array<string, mixed>}>  $prepared
     */
    public function storeOpeningDrafts(Takeoff $takeoff, array $prepared): int
    {
        if ($prepared === []) {
            return 0;
        }

        DB::transaction(function () use ($takeoff, $prepared): void {
            foreach ($prepared as $item) {
                $opening = $item['opening'];
                $attributes = $item['attributes'];

                if ($opening instanceof TakeoffOpening) {
                    if (($attributes['tag'] ?? null) !== $opening->tag) {
                        $attributes['counted_tag'] = false;
                    }

                    $opening->update($attributes);

                    if ($opening->group_id) {
                        $this->refreshMismatch($opening->group);
                    }

                    continue;
                }

                $created = $takeoff->openings()->create($attributes + [
                    'sort_order' => ((int) $takeoff->openings()->max('sort_order')) + 1,
                ]);

                if (is_array($item['marker'])) {
                    $this->createMarker($takeoff, $created, $item['marker']);
                }
            }
        });

        app(ProjectControlTakeoff::class)->connectTakeoff($takeoff->fresh() ?? $takeoff);

        return count($prepared);
    }

    /**
     * @param  array<string, mixed>  $drafts
     * @return list<array{opening: ?TakeoffOpening, attributes: array<string, mixed>, marker: ?array<string, mixed>}>
     */
    private function prepareOpeningDrafts(Takeoff $takeoff, User $user, array $drafts): array
    {
        $prepared = [];
        $errors = [];

        foreach ($drafts as $key => $draft) {
            $prefix = 'openings.'.$key;

            if (! is_array($draft)) {
                $errors[$prefix] = 'This opening could not be read.';

                continue;
            }

            $validator = Validator::make($draft, $this->openingRules());

            if ($validator->fails()) {
                foreach ($validator->errors()->messages() as $field => $messages) {
                    $errors[$prefix.'.'.$field] = $messages[0] ?? 'Check this field.';
                }

                continue;
            }

            $data = $validator->validated();
            $problem = $this->openingDraftProblem($takeoff, $data);

            if ($problem !== null) {
                $errors[$prefix.'.'.$problem['field']] = $problem['message'];

                continue;
            }

            $opening = null;

            if ($key !== 'new') {
                $opening = $takeoff->openings()->whereKey((int) $key)->first();

                if (! $opening instanceof TakeoffOpening) {
                    $errors[$prefix] = 'This opening is not on the takeoff.';

                    continue;
                }

                $stamp = $draft['updated_at'] ?? null;

                if (is_string($stamp) && $stamp !== '' && $opening->updated_at) {
                    $current = $opening->updated_at->utc()->format('Y-m-d H:i:s');
                    $expected = Carbon::parse($stamp)->utc()->format('Y-m-d H:i:s');

                    if ($current !== $expected) {
                        $errors[$prefix.'.updated_at'] = 'This opening was updated by someone else. Reload the takeoff before saving.';

                        continue;
                    }
                }
            }

            $prepared[] = [
                'opening' => $opening,
                'attributes' => $this->openingAttributes($data, $user, $opening),
                'marker' => is_array($draft['marker'] ?? null) ? $draft['marker'] : null,
            ];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $prepared;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return ?array{field: string, message: string}
     */
    private function openingDraftProblem(Takeoff $takeoff, array $data): ?array
    {
        if (! ($data['is_bulk'] ?? false) && $this->blank($data['tag'] ?? null) === null) {
            return ['field' => 'tag', 'message' => 'A tagged opening needs an opening tag. Use a bulk record for quantity-only items.'];
        }

        if (($data['disposition'] ?? 'active') !== 'active' && $this->blank($data['disposition_reason'] ?? null) === null) {
            return ['field' => 'disposition_reason', 'message' => 'Enter a reason for an exclusion or not-applicable decision.'];
        }

        if (! empty($data['requirement_document_id']) && ! $takeoff->documents()->whereKey((int) $data['requirement_document_id'])->exists()) {
            return ['field' => 'requirement_document_id', 'message' => 'Choose a document on this takeoff.'];
        }

        if (! empty($data['group_id']) && ! $takeoff->groups()->whereKey((int) $data['group_id'])->exists()) {
            return ['field' => 'group_id', 'message' => 'Choose a group on this takeoff.'];
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function openingRules(): array
    {
        return [
            'tag' => ['nullable', 'string', 'max:50'],
            'is_bulk' => ['required', 'boolean'],
            'opening_type' => ['required', 'string', 'max:80'],
            'door_configuration_id' => ['nullable', 'integer', 'exists:door_configurations,id'],
            'location' => ['nullable', 'string', 'max:255'],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:999999'],
            'product_category' => ['nullable', 'string', 'max:255'],
            'width' => ['nullable', 'numeric', 'min:0'],
            'height' => ['nullable', 'numeric', 'min:0'],
            'depth' => ['nullable', 'numeric', 'min:0'],
            'dimension_unit' => ['required', Rule::in(config('takeoffs.units'))],
            'frame_type' => ['nullable', 'string', 'max:255'],
            'handing' => ['nullable', 'string', 'max:255'],
            'hardware_set' => ['nullable', 'string', 'max:255'],
            'glazing' => ['nullable', 'string', 'max:255'],
            'finish' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'product_model' => ['nullable', 'string', 'max:255'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'scope' => ['required', Rule::in(config('takeoffs.scopes'))],
            'notes' => ['nullable', 'string', 'max:5000'],
            'exclusions' => ['nullable', 'string', 'max:5000'],
            'assumptions' => ['nullable', 'string', 'max:5000'],
            'disposition' => ['required', Rule::in(['active', 'excluded', 'not_applicable'])],
            'disposition_reason' => ['nullable', 'string', 'max:2000'],
            'waived_checks' => ['nullable', 'array'],
            'waived_checks.dimensions' => ['nullable', 'string', 'max:500'],
            'waived_checks.product' => ['nullable', 'string', 'max:500'],
            'waived_checks.technical' => ['nullable', 'string', 'max:500'],
            'waived_checks.hardware' => ['nullable', 'string', 'max:500'],
            'waived_checks.pricing' => ['nullable', 'string', 'max:500'],
            'acoustic_requirement' => ['nullable', 'string', 'max:5000'],
            'rf_requirement' => ['nullable', 'string', 'max:10000'],
            'fire_requirement' => ['nullable', 'string', 'max:5000'],
            'ballistic_requirement' => ['nullable', 'string', 'max:5000'],
            'other_requirements' => ['nullable', 'string', 'max:5000'],
            'verified_acoustic' => ['nullable', 'string', 'max:5000'],
            'verified_rf' => ['nullable', 'string', 'max:10000'],
            'verified_fire' => ['nullable', 'string', 'max:5000'],
            'verified_ballistic' => ['nullable', 'string', 'max:5000'],
            'verification_status' => ['required', Rule::in(['recorded', 'proposed', 'pending', 'completed'])],
            'requirement_document_id' => ['nullable', 'integer'],
            'requirement_page' => ['nullable', 'integer', 'min:1'],
            'requirement_section' => ['nullable', 'string', 'max:255'],
            'group_id' => ['nullable', 'integer'],
            'needs_review' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedOpening(Request $request, Takeoff $takeoff): array
    {
        $data = $request->validate($this->openingRules() + [
            'updated_at' => ['nullable', 'string'],
            'marker' => ['nullable', 'array'],
            'marker.document_id' => ['required_with:marker', 'integer'],
            'marker.page' => ['required_with:marker', 'integer', 'min:1'],
            'marker.x' => ['required_with:marker', 'numeric', 'between:0,1'],
            'marker.y' => ['required_with:marker', 'numeric', 'between:0,1'],
        ]);

        if (! $request->boolean('is_bulk') && $this->blank($data['tag'] ?? null) === null) {
            throw ValidationException::withMessages(['tag' => 'A tagged opening needs an opening tag. Use a bulk record for quantity-only items.']);
        }

        if ($data['disposition'] !== 'active' && $this->blank($data['disposition_reason'] ?? null) === null) {
            throw ValidationException::withMessages(['disposition_reason' => 'Enter a reason for an exclusion or not-applicable decision.']);
        }

        if (! empty($data['requirement_document_id'])) {
            $this->ownedDocument($takeoff, $this->document($takeoff, (int) $data['requirement_document_id']));
        }

        if (! empty($data['group_id'])) {
            abort_unless($takeoff->groups()->whereKey($data['group_id'])->exists(), 422);
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function openingAttributes(array $data, User $user, ?TakeoffOpening $current = null): array
    {
        $status = $data['verification_status'];
        $verifiedBy = $current?->verified_by;
        $verifiedAt = $current?->verified_at;

        if ($status === 'completed' && $current?->verification_status !== 'completed') {
            $verifiedBy = $user->id;
            $verifiedAt = now();
        }

        if ($status !== 'completed') {
            $verifiedBy = null;
            $verifiedAt = null;
        }

        $waived = [];

        foreach (['dimensions', 'product', 'technical', 'hardware', 'pricing'] as $check) {
            $reason = $this->blank($data['waived_checks'][$check] ?? null);

            if ($reason !== null) {
                $waived[$check] = $reason;
            }
        }

        $openingType = $this->storedOpeningType((string) ($data['opening_type'] ?? ''));

        return [
            'tag' => $this->blank($data['tag'] ?? null),
            'is_bulk' => (bool) $data['is_bulk'],
            'opening_type' => $openingType,
            'door_configuration_id' => $openingType === 'door' ? ($data['door_configuration_id'] ?? null) : null,
            'location' => $this->blank($data['location'] ?? null),
            'quantity' => TakeoffMoney::money($data['quantity']),
            'product_category' => OpeningCategory::remember($data['product_category'] ?? null),
            'width' => TakeoffMoney::dimension($data['width'] ?? null),
            'height' => TakeoffMoney::dimension($data['height'] ?? null),
            'depth' => TakeoffMoney::dimension($data['depth'] ?? null),
            'dimension_unit' => $data['dimension_unit'],
            'frame_type' => $this->blank($data['frame_type'] ?? null),
            'handing' => $this->blank($data['handing'] ?? null),
            'hardware_set' => $this->blank($data['hardware_set'] ?? null),
            'glazing' => $this->blank($data['glazing'] ?? null),
            'finish' => $this->blank($data['finish'] ?? null),
            'manufacturer' => $this->blank($data['manufacturer'] ?? null),
            'product_model' => $this->blank($data['product_model'] ?? null),
            'product_id' => $data['product_id'] ?? null,
            'scope' => $data['scope'],
            'notes' => $this->blank($data['notes'] ?? null),
            'exclusions' => $this->blank($data['exclusions'] ?? null),
            'assumptions' => $this->blank($data['assumptions'] ?? null),
            'disposition' => $data['disposition'],
            'disposition_reason' => $this->blank($data['disposition_reason'] ?? null),
            'waived_checks' => $waived,
            'acoustic_requirement' => $this->blank($data['acoustic_requirement'] ?? null),
            'rf_requirement' => $this->blank($data['rf_requirement'] ?? null),
            'fire_requirement' => $this->blank($data['fire_requirement'] ?? null),
            'ballistic_requirement' => $this->blank($data['ballistic_requirement'] ?? null),
            'other_requirements' => $this->blank($data['other_requirements'] ?? null),
            'verified_acoustic' => $this->blank($data['verified_acoustic'] ?? null),
            'verified_rf' => $this->blank($data['verified_rf'] ?? null),
            'verified_fire' => $this->blank($data['verified_fire'] ?? null),
            'verified_ballistic' => $this->blank($data['verified_ballistic'] ?? null),
            'verification_status' => $status,
            'verified_by' => $verifiedBy,
            'verified_at' => $verifiedAt,
            'requirement_document_id' => $data['requirement_document_id'] ?? null,
            'requirement_page' => $data['requirement_page'] ?? null,
            'requirement_section' => $this->blank($data['requirement_section'] ?? null),
            'group_id' => $data['group_id'] ?? null,
            'needs_review' => (bool) ($data['needs_review'] ?? false),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nextCountTag(Takeoff $takeoff, string $prefix): string
    {
        $max = 0;

        foreach ($takeoff->openings()->pluck('tag') as $tag) {
            if (preg_match('/^'.preg_quote($prefix, '/').'(\d+)$/i', (string) $tag, $match) === 1) {
                $max = max($max, (int) $match[1]);
            }
        }

        return $prefix.($max + 1);
    }

    private function markerRules(): array
    {
        return [
            'document_id' => ['required', 'integer'],
            'page' => ['required', 'integer', 'min:1'],
            'x' => ['required', 'numeric', 'between:0,1'],
            'y' => ['required', 'numeric', 'between:0,1'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function createMarker(Takeoff $takeoff, TakeoffOpening $opening, array $data): TakeoffMarker
    {
        $document = $this->document($takeoff, (int) $data['document_id']);

        if ($document->page_count && (int) $data['page'] > $document->page_count) {
            throw ValidationException::withMessages(['page' => 'That page is not in this document.']);
        }

        return $opening->markers()->create([
            'document_id' => $document->id,
            'page' => (int) $data['page'],
            'x' => bcadd(TakeoffMoney::raw($data['x']), '0', 6),
            'y' => bcadd(TakeoffMoney::raw($data['y']), '0', 6),
            'x2' => isset($data['x2']) ? bcadd(TakeoffMoney::raw($data['x2']), '0', 6) : null,
            'y2' => isset($data['y2']) ? bcadd(TakeoffMoney::raw($data['y2']), '0', 6) : null,
            'label_x' => isset($data['label_x']) ? bcadd(TakeoffMoney::raw($data['label_x']), '0', 6) : null,
            'label_y' => isset($data['label_y']) ? bcadd(TakeoffMoney::raw($data['label_y']), '0', 6) : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedCost(Request $request, Takeoff $takeoff): array
    {
        $data = $request->validate([
            'opening_id' => ['nullable', 'integer'],
            'group_id' => ['nullable', 'integer'],
            'kind' => ['required', Rule::in(['material', 'labor', 'freight', 'equipment', 'subcontract', 'other'])],
            'basis' => ['required', Rule::in(['per_unit', 'one_time'])],
            'description' => ['nullable', 'string', 'max:255'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'labor_hours' => ['nullable', 'numeric', 'min:0'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
        ]);
        $hasOpening = ! empty($data['opening_id']);
        $hasGroup = ! empty($data['group_id']);

        if ($hasOpening === $hasGroup) {
            throw ValidationException::withMessages(['opening_id' => 'Assign the cost to one opening or one group.']);
        }

        if ($hasOpening) {
            $this->ownedOpening($takeoff, $this->opening($takeoff, (int) $data['opening_id']));
        }

        if ($hasGroup) {
            abort_unless($takeoff->groups()->whereKey($data['group_id'])->exists(), 422);
        }

        if ($data['kind'] === 'labor') {
            if (! isset($data['labor_hours'], $data['hourly_rate'])) {
                throw ValidationException::withMessages(['labor_hours' => 'Enter labor hours and an hourly rate.']);
            }
        } elseif (! isset($data['amount']) || $data['amount'] === '') {
            throw ValidationException::withMessages(['amount' => 'Enter an amount.']);
        }

        if ($data['kind'] === 'material') {
            $data['basis'] = 'per_unit';
        }

        return [
            'opening_id' => $data['opening_id'] ?? null,
            'group_id' => $data['group_id'] ?? null,
            'kind' => $data['kind'],
            'basis' => $data['basis'],
            'description' => $this->blank($data['description'] ?? null),
            'amount' => isset($data['amount']) && $data['amount'] !== '' ? TakeoffMoney::money($data['amount']) : null,
            'labor_hours' => isset($data['labor_hours']) && $data['labor_hours'] !== '' ? TakeoffMoney::money($data['labor_hours']) : null,
            'hourly_rate' => isset($data['hourly_rate']) && $data['hourly_rate'] !== '' ? TakeoffMoney::money($data['hourly_rate']) : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function quoteAttributes(Request $request, Takeoff $takeoff, User $user): array
    {
        $data = $request->validate([
            'supplier_name' => ['required', 'string', 'max:255'],
            'quote_number' => ['nullable', 'string', 'max:100'],
            'revision_label' => ['nullable', 'string', 'max:100'],
            'quote_date' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date'],
            'opening_id' => ['nullable', 'integer'],
            'group_id' => ['nullable', 'integer'],
            'included_scope' => ['nullable', 'string', 'max:5000'],
            'exclusions' => ['nullable', 'string', 'max:5000'],
            'pricing_notes' => ['nullable', 'string', 'max:5000'],
            'file' => ['nullable', 'file', 'mimes:pdf', 'max:'.config('takeoffs.max_kilobytes')],
        ]);

        if (! empty($data['opening_id'])) {
            $this->ownedOpening($takeoff, $this->opening($takeoff, (int) $data['opening_id']));
        }

        if (! empty($data['group_id'])) {
            abort_unless($takeoff->groups()->whereKey($data['group_id'])->exists(), 422);
        }

        $path = null;
        $filename = null;

        if ($request->file('file') instanceof UploadedFile) {
            $path = $this->storePdf($request->file('file'), 'takeoffs/'.$takeoff->id.'/quotes');
            $filename = $request->file('file')->getClientOriginalName();
        }

        return [
            'supplier_name' => $data['supplier_name'],
            'quote_number' => $this->blank($data['quote_number'] ?? null),
            'revision_label' => $this->blank($data['revision_label'] ?? null),
            'quote_date' => $data['quote_date'] ?? null,
            'expires_at' => $data['expires_at'] ?? null,
            'opening_id' => $data['opening_id'] ?? null,
            'group_id' => $data['group_id'] ?? null,
            'included_scope' => $this->blank($data['included_scope'] ?? null),
            'exclusions' => $this->blank($data['exclusions'] ?? null),
            'pricing_notes' => $this->blank($data['pricing_notes'] ?? null),
            'storage_path' => $path,
            'original_filename' => $filename,
            'created_by' => $user->id,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedTemplate(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'opening_type' => ['required', Rule::in(config('takeoffs.opening_types'))],
            'product_category' => ['nullable', 'string', 'max:255'],
            'frame_type' => ['nullable', 'string', 'max:255'],
            'handing' => ['nullable', 'string', 'max:255'],
            'hardware_set' => ['nullable', 'string', 'max:255'],
            'glazing' => ['nullable', 'string', 'max:255'],
            'finish' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'product_model' => ['nullable', 'string', 'max:255'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'components' => ['nullable', 'array'],
            'default_costs' => ['nullable', 'array'],
            'default_costs.*.kind' => ['required_with:default_costs', Rule::in(['material', 'labor', 'freight', 'equipment', 'subcontract', 'other'])],
            'default_costs.*.basis' => ['required_with:default_costs', Rule::in(['per_unit', 'one_time'])],
            'default_costs.*.amount' => ['nullable', 'numeric', 'min:0'],
            'default_costs.*.labor_hours' => ['nullable', 'numeric', 'min:0'],
            'default_costs.*.hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'default_costs.*.description' => ['nullable', 'string', 'max:255'],
        ]);

        return [
            'name' => $data['name'],
            'opening_type' => $data['opening_type'],
            'product_category' => $this->blank($data['product_category'] ?? null),
            'frame_type' => $this->blank($data['frame_type'] ?? null),
            'handing' => $this->blank($data['handing'] ?? null),
            'hardware_set' => $this->blank($data['hardware_set'] ?? null),
            'glazing' => $this->blank($data['glazing'] ?? null),
            'finish' => $this->blank($data['finish'] ?? null),
            'manufacturer' => $this->blank($data['manufacturer'] ?? null),
            'product_model' => $this->blank($data['product_model'] ?? null),
            'product_id' => $data['product_id'] ?? null,
            'components' => $data['components'] ?? null,
            'default_costs' => $data['default_costs'] ?? [],
        ];
    }

    private function ensurePriced(Request $request, Takeoff $takeoff): User
    {
        $user = $this->ensureEditable($request, $takeoff);
        abort_unless(TakeoffAccess::canViewPricing($user), 403);

        return $user;
    }

    private function guardFresh(Request $request, TakeoffOpening $opening): void
    {
        $stamp = $request->input('updated_at');

        if (! is_string($stamp) || $stamp === '' || ! $opening->updated_at) {
            return;
        }

        $current = $opening->updated_at->utc()->format('Y-m-d H:i:s');
        $expected = Carbon::parse($stamp)->utc()->format('Y-m-d H:i:s');

        if ($current === $expected) {
            return;
        }

        if ($request->expectsJson()) {
            abort(response()->json([
                'message' => 'This opening was updated by someone else. Reload the takeoff before saving.',
            ], 409));
        }

        throw ValidationException::withMessages([
            'updated_at' => 'This opening was updated by someone else. Reload the takeoff before saving.',
        ]);
    }

    private function refreshMismatch(?TakeoffGroup $group): void
    {
        if (! $group) {
            return;
        }

        $count = $group->openings()->get()
            ->map(fn (TakeoffOpening $opening): string => TakeoffGrouping::signature($opening))
            ->unique()
            ->count();
        $group->update(['mismatch' => $count > 1]);
    }

    private function storePdf(UploadedFile $file, string $directory): string
    {
        TakeoffPdfScope::assertPdf($file);

        $path = $file->store($directory, config('takeoffs.disk'));

        if (! is_string($path)) {
            throw ValidationException::withMessages(['file' => 'The file could not be stored.']);
        }

        return $path;
    }

    private function scanProgressKey(TakeoffDocument $document, string $progress): string
    {
        return 'takeoff-scan.'.$document->id.'.'.$progress;
    }

    /**
     * @param  array{percent: int, label: string, done: bool, message: ?string}  $payload
     */
    private function emitScanEvent(array $payload): void
    {
        echo 'data: '.json_encode($payload, JSON_UNESCAPED_UNICODE)."\n";
        echo ': '.str_repeat(' ', 2048)."\n\n";

        if (ob_get_level() > 0) {
            @ob_flush();
        }

        flush();
    }

    private function ownedDocument(Takeoff $takeoff, TakeoffDocument $document): void
    {
        abort_unless((int) $document->takeoff_id === (int) $takeoff->id, 404);
    }

    private function ownedOpening(Takeoff $takeoff, TakeoffOpening $opening): void
    {
        abort_unless((int) $opening->takeoff_id === (int) $takeoff->id, 404);
    }

    private function ownedQuote(Takeoff $takeoff, TakeoffSupplierQuote $quote): void
    {
        abort_unless((int) $quote->takeoff_id === (int) $takeoff->id, 404);
    }

    private function document(Takeoff $takeoff, int $id): TakeoffDocument
    {
        $document = $takeoff->documents()->whereKey($id)->first();
        abort_unless($document, 422);

        return $document;
    }

    private function opening(Takeoff $takeoff, int $id): TakeoffOpening
    {
        $opening = $takeoff->openings()->whereKey($id)->first();
        abort_unless($opening, 422);

        return $opening;
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, TakeoffOpening>
     */
    private function openingsFor(Takeoff $takeoff, array $ids)
    {
        $openings = $takeoff->openings()->whereIn('id', $ids)->get();

        if ($openings->count() !== count(array_unique($ids))) {
            throw ValidationException::withMessages(['opening_ids' => 'Choose openings from this takeoff.']);
        }

        return $openings;
    }

    private function blank(mixed $value): ?string
    {
        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }
}
