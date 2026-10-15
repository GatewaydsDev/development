<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AuthorizesTakeoffs;
use App\Http\Controllers\Controller;
use App\Models\Takeoff;
use App\Models\TakeoffAssemblyTemplate;
use App\Models\TakeoffCost;
use App\Models\TakeoffDocument;
use App\Models\TakeoffGroup;
use App\Models\TakeoffMarker;
use App\Models\TakeoffOpening;
use App\Models\TakeoffReference;
use App\Models\TakeoffSupplierQuote;
use App\Models\User;
use App\Support\TakeoffAccess;
use App\Support\TakeoffGrouping;
use App\Support\TakeoffMoney;
use App\Support\TakeoffNamer;
use App\Support\TakeoffPdfScope;
use App\Support\TakeoffScopeImporter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

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

    public function scanDocument(Request $request, Takeoff $takeoff, TakeoffDocument $document): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedDocument($takeoff, $document);
        $scanned = TakeoffScopeImporter::scan($takeoff, $document);
        $renamed = TakeoffNamer::apply($takeoff, $scanned['scope']);
        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'document.scanned', 'Scanned '.$document->original_filename.' for doors and windows.', [
            'document_id' => $document->id,
            'title' => $renamed ? $takeoff->title : null,
        ]);

        return back()->with('success', TakeoffScopeImporter::uploadedMessage($scanned['import'], $scanned['scope']));
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
        ]);
        $document = $this->document($takeoff, (int) $data['document_id']);
        $specs = TakeoffScopeImporter::specsAt($document, (int) $data['page'], (float) $data['x'], (float) $data['y']) ?? [];
        $type = ($specs['opening_type'] ?? $data['opening_type']) === 'window' ? 'window' : 'door';
        $tag = strtoupper(trim((string) ($specs['tag'] ?? '')));

        if ($tag === '') {
            $tag = $this->nextCountTag($takeoff, $type === 'window' ? 'W' : 'D');
        } elseif ($takeoff->openings()->whereRaw('upper(tag) = ?', [$tag])->exists()) {
            return back()->with('error', 'Door '.$tag.' is already on this scope.');
        }

        $fromSchedule = ($specs['width'] ?? null) !== null;
        $unit = $specs['dimension_unit'] ?? 'in';
        $opening = $takeoff->openings()->create([
            'tag' => $tag,
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
        $opening->references()->create([
            'document_id' => $document->id,
            'page' => $data['page'],
            'section' => $opening->requirement_section,
            'note' => $fromSchedule ? 'Specs read from the schedule row at this mark.' : 'Marked on the drawing.',
        ]);
        $this->clearApproval($takeoff, $user);
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
        $takeoff->record($user, 'opening.created', 'Added opening '.$opening->label().'.');

        return back()->with('success', 'Opening saved.');
    }

    public function updateOpening(Request $request, Takeoff $takeoff, TakeoffOpening $opening): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedOpening($takeoff, $opening);
        $this->guardFresh($request, $opening);
        $data = $this->validatedOpening($request, $takeoff);
        $opening->update($this->openingAttributes($data, $user, $opening));

        if ($opening->group_id) {
            $this->refreshMismatch($opening->group);
        }

        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'opening.updated', 'Updated opening '.$opening->label().'.');

        return back()->with('success', 'Opening saved.');
    }

    public function destroyOpening(Request $request, Takeoff $takeoff, TakeoffOpening $opening): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $this->ownedOpening($takeoff, $opening);
        $label = $opening->label();
        $opening->delete();
        $this->clearApproval($takeoff, $user);
        $takeoff->record($user, 'opening.deleted', 'Removed opening '.$label.'.');

        return back()->with('success', 'Opening removed.');
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
        ]);
        $marker->update([
            'x' => bcadd(TakeoffMoney::raw($data['x']), '0', 6),
            'y' => bcadd(TakeoffMoney::raw($data['y']), '0', 6),
            'page' => $data['page'],
        ]);
        $takeoff->record($user, 'marker.updated', 'Moved a marker for '.$marker->opening->label().'.');

        return back()->with('success', 'Marker moved.');
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
        $takeoff->record($user, 'template.applied', 'Applied template '.$template->name.' to '.$opening->label().'. The template itself was not changed.');

        return back()->with('success', 'Template applied as a snapshot.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedOpening(Request $request, Takeoff $takeoff): array
    {
        $data = $request->validate([
            'tag' => ['nullable', 'string', 'max:50'],
            'is_bulk' => ['required', 'boolean'],
            'opening_type' => ['required', Rule::in(config('takeoffs.opening_types'))],
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

        return [
            'tag' => $this->blank($data['tag'] ?? null),
            'is_bulk' => (bool) $data['is_bulk'],
            'opening_type' => $data['opening_type'],
            'location' => $this->blank($data['location'] ?? null),
            'quantity' => TakeoffMoney::money($data['quantity']),
            'product_category' => $this->blank($data['product_category'] ?? null),
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
