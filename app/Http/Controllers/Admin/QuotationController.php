<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BidTextTemplate;
use App\Models\Company;
use App\Models\Contractor;
use App\Models\ContractorContact;
use App\Models\Product;
use App\Models\PrintLayout;
use App\Models\Project;
use App\Models\Quotation;
use App\Models\QuotationField;
use App\Models\QuotationLineItem;
use App\Models\QuotationProductField;
use App\Models\QuotationRevision;
use App\Models\QuotationRevisionStatus;
use App\Models\QuotationRevisionTitle;
use App\Models\QuotationTable;
use App\Models\QuotationTitle;
use App\Models\User;
use App\Support\BidAccess;
use App\Support\BidApplicationText;
use App\Support\PrintLayoutCatalog;
use App\Support\QuotationAccess;
use App\Support\QuotationDocument;
use App\Support\QuotationListVersion;
use App\Support\QuotationRevisionAssignments;
use App\Support\QuotationRevisionResponsible;
use App\Support\QuotationToBid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class QuotationController extends Controller
{
    private ?bool $contractorsHaveRole = null;

    private ?bool $quotationsHaveProposalTitle = null;

    private ?bool $quotationsHaveAuthorization = null;

    public function index(Request $request): Response
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);

        $search = (string) $request->query('search', '');
        $highlight = (string) $request->query('highlight', '');
        $listingQuery = $this->listingQuery($search);

        return Inertia::render('Admin/Quotations/Index', [
            'filters' => [
                'search' => $search,
                'highlight' => $highlight !== '' ? $highlight : null,
            ],
            'options' => $this->options($request->user()),
            'summary' => $this->quotationStatusSummary($listingQuery),
            'quotations' => (clone $listingQuery)
                ->when($highlight !== '', function ($query) use ($highlight): void {
                    $query->orderByRaw('CASE WHEN quotations.uuid = ? THEN 0 ELSE 1 END', [$highlight]);
                })
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Quotation $quotation): array => $this->quotationPayload($quotation, summary: true)),
            'listVersion' => QuotationListVersion::current(),
        ]);
    }

    public function version(Request $request): JsonResponse
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);

        return response()->json([
            'version' => QuotationListVersion::current(),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless(QuotationAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Quotations/Create', [
            'options' => $this->options($request->user()),
        ]);
    }

    public function storeTitle(Request $request): RedirectResponse
    {
        abort_unless(
            QuotationAccess::canCreate($request->user()) || QuotationAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $title = QuotationTitle::firstOrCreateByName($validated['name']);

        return back()->with(
            'success',
            $title->wasRecentlyCreated
                ? 'Quotation title added successfully.'
                : 'Quotation title already exists.',
        );
    }

    public function storeRevisionStatus(Request $request): RedirectResponse
    {
        return $this->storeRevisionCatalogItem($request, QuotationRevisionStatus::class, 'Revision status');
    }

    public function storeRevisionTitle(Request $request): RedirectResponse
    {
        return $this->storeRevisionCatalogItem($request, QuotationRevisionTitle::class, 'Revision title');
    }

    /**
     * @param  class-string<QuotationRevisionStatus|QuotationRevisionTitle>  $model
     */
    private function storeRevisionCatalogItem(Request $request, string $model, string $label): RedirectResponse
    {
        abort_unless(
            QuotationAccess::canCreate($request->user()) || QuotationAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $item = $model::firstOrCreateByName($validated['name']);

        return back()->with(
            'success',
            $item->wasRecentlyCreated ? "{$label} added successfully." : "{$label} already exists.",
        );
    }

    public function storeField(Request $request): RedirectResponse
    {
        abort_unless(
            QuotationAccess::canCreate($request->user()) || QuotationAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $field = QuotationField::firstOrCreateByName($validated['name']);

        return back()->with(
            'success',
            $field->wasRecentlyCreated
                ? 'Quotation field added successfully.'
                : 'Quotation field already exists.',
        );
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        abort_unless(QuotationAccess::canCreate($request->user()), 403);

        $validated = $this->validatedQuotation($request);

        $quotation = DB::transaction(function () use ($validated, $request): Quotation {
            $quotation = Quotation::create([
                'contractor_id' => $validated['contractor_id'],
                'project_id' => $validated['project_id'] ?? null,
                'project_amount' => $validated['project_amount'] ?? null,
                'title' => $validated['title'],
                'status' => $validated['status'],
                'quoted_at' => $validated['quoted_at'] ?? null,
                'valid_until' => $validated['valid_until'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'print_layout_id' => $validated['print_layout_id'] ?? null,
                'print_layout_version' => $validated['print_layout_version'] ?? null,
                'layout_header' => $validated['layout_header'] ?? null,
                ...$this->proposalTitleAttributes($validated),
                'pricing_conditions' => $validated['pricing_conditions'] ?? null,
                'pricing_basis' => $validated['pricing_basis'] ?? null,
                ...$this->authorizationAttributes($validated),
                'created_by' => $request->user()?->id,
            ]);

            $this->syncLineItems($quotation, $validated['line_items']);
            $this->syncContacts($quotation, $validated['contact_ids'] ?? []);
            $this->syncRevisions($quotation, $validated['revisions'] ?? [], $request->user());
            $this->syncFieldTables($quotation, $validated['field_tables'] ?? []);

            return $quotation;
        });

        if ($request->expectsJson()) {
            return response()->json(['document' => $this->quotationPayload($quotation)], 201);
        }

        return redirect()
            ->route('admin.quotations.index', ['highlight' => $quotation->uuid])
            ->with('success', 'Quotation saved successfully.');
    }

    public function show(Request $request, Quotation $quotation): Response
    {
        $assignedRevisions = $quotation->revisions()
            ->where('responsible_user_id', $request->user()->id)
            ->whereNull('responsible_response')
            ->latest('responsible_assigned_at')
            ->get();

        abort_unless(QuotationAccess::canView($request->user()) || $assignedRevisions->isNotEmpty(), 403);

        $quotation->load(['contractor.contacts', 'contacts', 'project', 'lineItems', 'convertedBid', 'creator:id,name,signature_path', 'revisions.user:id,name', 'revisions.responsibleUser:id,name', 'revisions.status:id,name', 'revisions.title:id,name', 'tables.fields.field', 'tables.fields.product']);

        return Inertia::render('Admin/Quotations/Show', [
            'quotation' => $this->quotationPayload($quotation),
            'options' => $this->options($request->user()),
            'assignedRevisions' => $assignedRevisions
                ->map(fn (QuotationRevision $revision): array => QuotationRevisionAssignments::payload($revision))
                ->values(),
        ]);
    }

    public function convertToBid(Request $request, Quotation $quotation): RedirectResponse
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);
        abort_unless(BidAccess::canCreate($request->user()), 403);

        $quotation->load(['lineItems', 'convertedBid', 'bids']);

        $existingBid = $quotation->convertedBid ?? $quotation->bids->first();

        if ($existingBid) {
            return redirect()
                ->route('admin.bids.edit', $existingBid)
                ->with('success', 'This quotation already has a bid. We opened it for you.');
        }

        $bid = QuotationToBid::convert($quotation, $request->user());

        return redirect()
            ->route('admin.bids.edit', $bid)
            ->with('success', 'Your bid is ready. Review the imported quotation information, then save when everything looks good. The quotation is still on file and linked to this bid.');
    }

    public function print(Request $request, Quotation $quotation): HttpResponse
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);

        return $this->quotationDocument($request, $quotation)
            ->printResponse('admin.quotations.document')
            ->header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    }

    public function exportPdf(Request $request, Quotation $quotation): HttpResponse
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);

        return $this->quotationDocument($request, $quotation)->pdfResponse();
    }

    public function exportWord(Request $request, Quotation $quotation): BinaryFileResponse
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);

        return $this->quotationDocument($request, $quotation)->wordResponse();
    }

    public function edit(Request $request, Quotation $quotation): Response
    {
        abort_unless(QuotationAccess::canUpdate($request->user()), 403);

        $quotation->load(['contractor.contacts', 'contacts', 'project', 'lineItems', 'convertedBid', 'creator:id,name,signature_path', 'revisions.user:id,name', 'revisions.responsibleUser:id,name', 'revisions.status:id,name', 'revisions.title:id,name', 'tables.fields.field', 'tables.fields.product']);

        return Inertia::render('Admin/Quotations/Edit', [
            'quotation' => $this->quotationPayload($quotation),
            'options' => $this->options($request->user()),
        ]);
    }

    public function update(Request $request, Quotation $quotation): RedirectResponse|JsonResponse
    {
        abort_unless(QuotationAccess::canUpdate($request->user()), 403);

        $validated = $this->validatedQuotation($request, $quotation);

        DB::transaction(function () use ($quotation, $validated, $request): void {
            $quotation->update([
                'contractor_id' => $validated['contractor_id'],
                'project_id' => $validated['project_id'] ?? null,
                'project_amount' => $validated['project_amount'] ?? null,
                'title' => $validated['title'],
                'status' => $validated['status'],
                'quoted_at' => $validated['quoted_at'] ?? null,
                'valid_until' => $validated['valid_until'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'print_layout_id' => array_key_exists('print_layout_id', $validated) ? $validated['print_layout_id'] : $quotation->print_layout_id,
                'print_layout_version' => $validated['print_layout_version'] ?? $quotation->print_layout_version,
                'layout_header' => array_key_exists('layout_header', $validated) ? $validated['layout_header'] : $quotation->layout_header,
                ...$this->proposalTitleAttributes($validated),
                'pricing_conditions' => $validated['pricing_conditions'] ?? null,
                'pricing_basis' => $validated['pricing_basis'] ?? null,
                ...$this->authorizationAttributes($validated, $quotation),
            ]);

            $this->syncLineItems($quotation, $validated['line_items']);
            $this->syncContacts($quotation, $validated['contact_ids'] ?? []);
            $this->syncRevisions($quotation, $validated['revisions'] ?? [], $request->user());
            $this->syncFieldTables($quotation, $validated['field_tables'] ?? []);
        });

        if ($request->expectsJson()) {
            return response()->json(['document' => $this->quotationPayload($quotation->fresh())]);
        }

        return redirect()
            ->route('admin.quotations.index', ['highlight' => $quotation->uuid])
            ->with('success', 'Quotation updated successfully.');
    }

    public function autosave(Request $request, Quotation $quotation): JsonResponse
    {
        abort_unless(QuotationAccess::canUpdate($request->user()), 403);

        $validated = $request->validate([
            'pricing_conditions' => ['nullable', 'string', 'max:250000'],
        ]);

        $quotation->update([
            'pricing_conditions' => $this->sanitizedHtml($validated['pricing_conditions'] ?? null),
        ]);

        return response()->json([
            'saved_at' => $quotation->fresh()->updated_at?->toIso8601String(),
        ]);
    }

    public function destroy(Request $request, Quotation $quotation): RedirectResponse
    {
        abort_unless(QuotationAccess::canDelete($request->user()), 403);

        $quotation->delete();

        return redirect()
            ->route('admin.quotations.index')
            ->with('success', 'Quotation removed successfully.');
    }

    /**
     * @return array<string, mixed>
     */
    public function validatedQuotation(Request $request, ?Quotation $quotation = null): array
    {
        $validated = $request->validate([
            'contractor_id' => ['required', 'integer', 'exists:contractors,id'],
            'project_id' => [
                'nullable',
                'integer',
                Rule::exists('projects', 'id'),
            ],
            'title_id' => ['nullable', 'integer', 'exists:quotation_titles,id'],
            'title' => ['nullable', 'string', 'max:255'],
            'status' => ['required', 'string', Rule::in(Quotation::STATUSES)],
            'quoted_at' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date', 'after_or_equal:quoted_at'],
            'project_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999999.99'],
            'notes' => ['nullable', 'string', 'max:250000'],
            'print_layout_id' => ['nullable', 'integer', Rule::exists(PrintLayout::class, 'id')],
            'print_layout_version' => ['nullable', 'string', 'regex:/^[a-f0-9]{64}$/'],
            'layout_header' => ['nullable', 'string', 'max:250000'],
            'proposal_title' => ['nullable', 'string', 'max:255'],
            'pricing_conditions' => ['nullable', 'string', 'max:250000'],
            'pricing_basis' => ['nullable', 'string', 'max:250000'],
            'include_authorization' => ['sometimes', 'boolean'],
            'contact_ids' => ['nullable', 'array'],
            'contact_ids.*' => [
                'integer',
                Rule::exists('contractor_contacts', 'id')->where(
                    fn ($query) => $query->where('contractor_id', $request->integer('contractor_id')),
                ),
            ],
            'line_items' => ['nullable', 'array'],
            'line_items.*.description' => ['nullable', 'string', 'max:255'],
            'line_items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'line_items.*.size' => ['nullable', 'string', 'max:255'],
            'line_items.*.unit_price' => ['nullable', 'numeric'],
            'revisions' => ['array'],
            'revisions.*.id' => [
                'nullable',
                'integer',
                Rule::exists(QuotationRevision::class, 'id')->where(
                    fn ($query) => $quotation
                        ? $query->where('quotation_id', $quotation->id)
                        : $query->whereRaw('0 = 1'),
                ),
            ],
            'revisions.*.number' => ['required', 'string', 'max:50', 'distinct'],
            'revisions.*.revision_date' => ['nullable', 'date'],
            'revisions.*.notes' => ['nullable', 'string', 'max:2000'],
            'revisions.*.status_id' => ['nullable', 'integer', Rule::exists(QuotationRevisionStatus::class, 'id')],
            'revisions.*.title_id' => ['nullable', 'integer', Rule::exists(QuotationRevisionTitle::class, 'id')],
            'revisions.*.responsible_user_id' => [
                'nullable',
                'integer',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! QuotationRevisionResponsible::eligibleUsers()->whereKey($value)->exists()) {
                        $fail('The selected responsible user is not allowed.');
                    }
                },
            ],
            'field_tables' => ['array'],
            'field_tables.*.title' => ['nullable', 'string', 'max:255'],
            'field_tables.*.fields' => ['array'],
            'field_tables.*.fields.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'field_tables.*.fields.*.field_id' => ['nullable', 'integer', 'exists:quotation_fields,id'],
            'field_tables.*.fields.*.field' => ['nullable', 'string', 'max:255'],
            'field_tables.*.fields.*.value' => ['nullable', 'string', 'max:2000'],
            'product_fields' => ['array'],
            'product_fields.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'product_fields.*.field_id' => ['nullable', 'integer', 'exists:quotation_fields,id'],
            'product_fields.*.field' => ['nullable', 'string', 'max:255'],
            'product_fields.*.value' => ['nullable', 'string', 'max:2000'],
        ]);

        $title = filled($validated['title_id'] ?? null)
            ? QuotationTitle::query()->find($validated['title_id'])?->name
            : ($validated['title'] ?? null);
        $title = is_string($title) ? trim($title) : '';

        if ($title === '') {
            throw ValidationException::withMessages([
                'title' => 'Select or add a quotation title.',
            ]);
        }

        $catalogTitle = QuotationTitle::firstOrCreateByName($title);
        $validated['title'] = $catalogTitle->name;

        $validated['notes'] = $this->sanitizedHtml($validated['notes'] ?? null);
        if (array_key_exists('layout_header', $validated)) {
            $validated['layout_header'] = $this->sanitizedHtml($validated['layout_header']);
        }
        $validated['proposal_title'] = $this->proposalTitleValue($validated['proposal_title'] ?? null);
        $validated['pricing_conditions'] = $this->sanitizedHtml($validated['pricing_conditions'] ?? null);
        $validated['pricing_basis'] = $this->sanitizedHtml($validated['pricing_basis'] ?? null);

        $validated['line_items'] = collect($validated['line_items'] ?? [])
            ->values()
            ->map(function (array $item, int $index): ?array {
                $description = trim((string) ($item['description'] ?? ''));
                $quantity = $item['quantity'] ?? null;
                $size = filled($item['size'] ?? null) ? trim((string) $item['size']) : null;
                $unitPrice = $item['unit_price'] ?? null;
                $hasBaseBid = filled($quantity) && filled($size) && filled($unitPrice);

                if ($hasBaseBid && $description === '') {
                    throw ValidationException::withMessages([
                        "line_items.{$index}.description" => 'Enter a description.',
                    ]);
                }

                if ($description === '') {
                    return null;
                }

                return [
                    'description' => $description,
                    'quantity' => $quantity,
                    'size' => $size,
                    'unit_price' => $unitPrice,
                    'extended' => $unitPrice !== null ? round((float) $unitPrice, 2) : null,
                    'sort_order' => $index,
                ];
            })
            ->filter()
            ->values()
            ->map(function (array $item, int $index): array {
                $item['sort_order'] = $index;

                return $item;
            })
            ->all();

        $fieldTables = collect($validated['field_tables'] ?? [])
            ->values()
            ->map(function (array $table, int $tableIndex): ?array {
                $fields = $this->normalizedTableFields($table['fields'] ?? []);

                if ($fields === [] && ! filled($table['title'] ?? null)) {
                    return null;
                }

                $title = trim((string) ($table['title'] ?? ''));

                return [
                    'title' => $title !== '' ? $title : 'Table',
                    'sort_order' => $tableIndex,
                    'fields' => $fields,
                ];
            })
            ->filter()
            ->values()
            ->all();

        if ($fieldTables === [] && filled($validated['product_fields'] ?? null)) {
            $fields = $this->normalizedTableFields($validated['product_fields']);

            if ($fields !== []) {
                $fieldTables = [[
                    'title' => 'Table',
                    'sort_order' => 0,
                    'fields' => $fields,
                ]];
            }
        }

        $validated['field_tables'] = $fieldTables;

        return $validated;
    }

    /**
     * @param  list<int|string>  $contactIds
     */
    public function syncContacts(Quotation $quotation, array $contactIds): void
    {
        $quotation->contacts()->sync(
            collect($contactIds)
                ->map(fn (int|string $id): int => (int) $id)
                ->filter()
                ->unique()
                ->values()
                ->all(),
        );
    }

    public function syncLineItems(Quotation $quotation, array $items): void
    {
        $quotation->lineItems()->delete();

        foreach ($items as $item) {
            $quotation->lineItems()->create($item);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $revisions
     */
    public function syncRevisions(Quotation $quotation, array $revisions, ?User $user): void
    {
        $revisions = collect($revisions)
            ->filter(fn (array $revision): bool => filled($revision['number'] ?? null))
            ->unique(fn (array $revision): string => strtolower(trim((string) $revision['number'])))
            ->values();

        $keptIds = [];

        foreach ($revisions as $revision) {
            $revisionId = (int) ($revision['id'] ?? 0);
            $existing = $revisionId > 0
                ? $quotation->revisions()->whereKey($revisionId)->first()
                : null;

            $attributes = [
                'number' => trim((string) $revision['number']),
                'revision_date' => ($revision['revision_date'] ?? null) ?: null,
                'notes' => $revision['notes'] ?? null,
                'responsible_user_id' => filled($revision['responsible_user_id'] ?? null)
                    ? (int) $revision['responsible_user_id']
                    : null,
                'status_id' => filled($revision['status_id'] ?? null) ? (int) $revision['status_id'] : null,
                'title_id' => filled($revision['title_id'] ?? null) ? (int) $revision['title_id'] : null,
            ];

            if ($existing) {
                $existingDate = $existing->revision_date?->toDateString();
                $changed = $existing->number !== $attributes['number']
                    || $existingDate !== $attributes['revision_date']
                    || trim((string) ($existing->notes ?? '')) !== trim((string) ($attributes['notes'] ?? ''))
                    || $existing->responsible_user_id !== $attributes['responsible_user_id']
                    || $existing->status_id !== $attributes['status_id']
                    || $existing->title_id !== $attributes['title_id'];

                if ($changed && $user) {
                    $attributes['user_id'] = $user->id;
                }

                $responsibleChanged = $existing->responsible_user_id !== $attributes['responsible_user_id'];

                if ($responsibleChanged) {
                    $attributes = [
                        ...$attributes,
                        ...QuotationRevisionAssignments::assignmentAttributes($attributes['responsible_user_id'], $user),
                    ];
                }

                $existing->update($attributes);
                $keptIds[] = $existing->id;

                if ($responsibleChanged) {
                    QuotationRevisionAssignments::notifyAssigned($existing);
                }

                continue;
            }

            $created = $quotation->revisions()->create([
                ...$attributes,
                ...QuotationRevisionAssignments::assignmentAttributes($attributes['responsible_user_id'], $user),
                'user_id' => $user?->id,
            ]);
            $keptIds[] = $created->id;
            QuotationRevisionAssignments::notifyAssigned($created);
        }

        $quotation->revisions()
            ->when(
                $keptIds !== [],
                fn ($query) => $query->whereKeyNot($keptIds),
                fn ($query) => $query,
            )
            ->delete();
    }

    /**
     * @param  array<int, array<string, mixed>>  $tables
     */
    public function syncFieldTables(Quotation $quotation, array $tables): void
    {
        $quotation->productFields()->delete();
        $quotation->tables()->delete();

        foreach ($tables as $table) {
            $created = $quotation->tables()->create([
                'title' => $table['title'],
                'sort_order' => $table['sort_order'],
            ]);

            foreach ($table['fields'] as $field) {
                $created->fields()->create([
                    ...$field,
                    'quotation_id' => $quotation->id,
                ]);
            }
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return list<array{product_id: int|null, quotation_field_id: int, value: string|null, sort_order: int}>
     */
    private function normalizedTableFields(array $items): array
    {
        return collect($items)
            ->values()
            ->map(function (array $item, int $index): ?array {
                $name = filled($item['field_id'] ?? null)
                    ? QuotationField::query()->find($item['field_id'])?->name
                    : ($item['field'] ?? null);
                $name = is_string($name) ? trim($name) : '';

                if ($name === '') {
                    return null;
                }

                $field = QuotationField::firstOrCreateByName($name);

                return [
                    'product_id' => filled($item['product_id'] ?? null) ? (int) $item['product_id'] : null,
                    'quotation_field_id' => $field->id,
                    'value' => filled($item['value'] ?? null) ? trim((string) $item['value']) : null,
                    'sort_order' => $index,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    public function listingQuery(string $search)
    {
        return Quotation::query()
            ->with(['contractor.contacts', 'contacts', 'project', 'lineItems', 'convertedBid', 'bids'])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('title', 'like', "%{$search}%")
                        ->orWhere('quotation_number', 'like', "%{$search}%")
                        ->orWhere('status', 'like', "%{$search}%")
                        ->orWhereHas('contractor', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('project', function ($query) use ($search): void {
                            $query
                                ->where('name', 'like', "%{$search}%")
                                ->orWhere('project_number', 'like', "%{$search}%");
                        });
                });
            })
            ->latest();
    }

    /**
     * @return array<string, mixed>
     */
    public function quotationPayload(Quotation $quotation, bool $summary = false): array
    {
        $quotation->loadMissing(['contractor.contacts', 'contacts', 'project', 'lineItems', 'convertedBid', 'bids', 'creator:id,name,signature_path', 'revisions.user:id,name', 'revisions.responsibleUser:id,name', 'revisions.status:id,name', 'revisions.title:id,name', 'tables.fields.field', 'tables.fields.product', 'productFields.field', 'productFields.product']);

        $contractor = $quotation->contractor;
        $selectedContacts = $quotation->contacts;
        $contact = $selectedContacts->first() ?? $contractor?->primaryContact();
        $project = $quotation->project;
        $linkedBid = $quotation->convertedBid ?? $quotation->bids->first();

        $payload = [
            'id' => $quotation->id,
            'uuid' => $quotation->uuid,
            'quotation_number' => $quotation->quotation_number,
            'title' => $quotation->title,
            'title_id' => QuotationTitle::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower((string) $quotation->title)])
                ->value('id'),
            'status' => $quotation->status,
            'status_label' => Quotation::statusLabel($quotation->status),
            'quoted_at' => $quotation->quoted_at?->toDateString(),
            'valid_until' => $quotation->valid_until?->toDateString(),
            'project_amount' => $quotation->project_amount,
            'notes' => $this->sanitizedHtml($quotation->notes),
            'print_layout_id' => $quotation->print_layout_id,
            'print_layout_version' => $quotation->print_layout_version,
            'layout_header' => $summary ? null : $this->sanitizedHtml($quotation->layout_header),
            'proposal_title' => $quotation->proposalTitle(),
            'pricing_conditions' => $this->sanitizedHtml($quotation->pricing_conditions),
            'pricing_basis' => $this->sanitizedHtml($quotation->pricing_basis),
            'include_authorization' => (bool) ($quotation->include_authorization ?? true),
            'created_by_name' => $quotation->creator?->name,
            'signature_url' => $quotation->creator?->signature_url,
            'total' => $quotation->total(),
            'contractor' => $contractor ? [
                'id' => $contractor->id,
                'name' => $contractor->name,
                'role' => $this->contractorRole($contractor),
                'role_label' => Contractor::roleLabel($this->contractorRole($contractor)),
                'contact_name' => $contact?->name,
                'email' => $contact?->email,
                'phone_number' => $contact?->phone_number,
                'contacts' => $contractor->contacts
                    ->map(fn (ContractorContact $item): array => $this->contactPayload($item))
                    ->values()
                    ->all(),
            ] : null,
            'contacts' => $selectedContacts
                ->map(fn (ContractorContact $item): array => $this->contactPayload($item))
                ->values()
                ->all(),
            'contact_ids' => $selectedContacts->pluck('id')->map(fn ($id): string => (string) $id)->values()->all(),
            'project' => $project ? [
                'id' => $project->id,
                'name' => $project->name,
                'project_number' => $project->project_number,
                'site_address' => collect([
                    $project->site_address_line_1,
                    $project->site_address_line_2,
                    collect([$project->site_city, $project->site_state, $project->site_postal_code])->filter()->implode(', '),
                    $project->site_country,
                ])->filter()->implode(', ') ?: null,
            ] : null,
            'converted_bid' => $linkedBid ? [
                'id' => $linkedBid->id,
                'uuid' => $linkedBid->uuid,
            ] : null,
        ];

        if ($summary) {
            $payload['line_item_count'] = $quotation->lineItems->count();

            return $payload;
        }

        $payload['contractor_id'] = $quotation->contractor_id;
        $payload['project_id'] = $quotation->project_id;
        $payload['revisions'] = $quotation->revisions
            ->map(fn (QuotationRevision $revision): array => [
                'id' => $revision->id,
                'number' => $revision->number,
                'revision_date' => $revision->revision_date?->toDateString(),
                'notes' => $revision->notes,
                'user_id' => $revision->user_id,
                'user' => $revision->user
                    ? [
                        'id' => $revision->user->id,
                        'name' => $revision->user->name,
                    ]
                    : null,
                'responsible_user_id' => $revision->responsible_user_id,
                'responsible_user' => $revision->responsibleUser
                    ? [
                        'id' => $revision->responsibleUser->id,
                        'name' => $revision->responsibleUser->name,
                    ]
                    : null,
                'responsible_response' => $revision->responsible_response,
                'responsible_responded_at' => $revision->responsible_responded_at?->toISOString(),
                'status_id' => $revision->status_id,
                'status' => $revision->status ? ['id' => $revision->status->id, 'name' => $revision->status->name] : null,
                'title_id' => $revision->title_id,
                'title' => $revision->title ? ['id' => $revision->title->id, 'name' => $revision->title->name] : null,
            ])
            ->values()
            ->all();
        $payload['line_items'] = $quotation->lineItems->map(fn (QuotationLineItem $item): array => [
            'id' => $item->id,
            'description' => $item->description,
            'quantity' => $item->quantity,
            'size' => $item->size,
            'unit_price' => $item->unit_price,
            'extended' => $item->extended,
        ])->values()->all();
        $fieldMapper = fn (QuotationProductField $item): array => [
            'id' => $item->id,
            'product_id' => $item->product_id,
            'product_name' => $item->product?->name,
            'field_id' => $item->quotation_field_id,
            'field' => $item->field?->name,
            'value' => $item->value,
        ];

        $payload['field_tables'] = $quotation->tables
            ->map(fn (QuotationTable $table): array => [
                'id' => $table->id,
                'title' => $table->title,
                'fields' => $table->fields->map($fieldMapper)->values()->all(),
            ])
            ->values()
            ->all();

        $payload['product_fields'] = $quotation->tables->isNotEmpty()
            ? $quotation->tables->flatMap(fn (QuotationTable $table) => $table->fields)->map($fieldMapper)->values()->all()
            : $quotation->productFields->map($fieldMapper)->values()->all();

        return $payload;
    }

    /**
     * @return list<array{id: int, name: string, body: string}>
     */
    private function textTemplates(string $kind): array
    {
        return BidTextTemplate::query()
            ->where('kind', $kind)
            ->orderBy('name')
            ->get(['id', 'uuid', 'name', 'body'])
            ->map(fn (BidTextTemplate $template): array => [
                'id' => $template->id,
                'uuid' => $template->uuid,
                'name' => $template->name,
                'body' => $template->body,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{name: string, speciality: ?string, legal_name: ?string, email: ?string, phone: ?string, address: string}
     */
    private function companyOption(): array
    {
        $company = Company::query()
            ->where('is_active', true)
            ->latest()
            ->first();

        return [
            'name' => $company?->name ?: 'Gateway Door Systems',
            'speciality' => $company?->speciality,
            'legal_name' => $company?->legal_name,
            'email' => $company?->email,
            'phone' => $company?->contact_phone_number ?: $company?->phone_number,
            'contact_phone' => $company?->contact_phone_number,
            'website' => $company?->website_url,
            'contact_url' => $company?->contact_url,
            'address' => $company
                ? BidApplicationText::formatAddress(
                    $company->address_line_1,
                    $company->address_line_2,
                    $company->city,
                    $company->state,
                    $company->postal_code,
                    $company->country,
                )
                : '',
        ];
    }

    private function sanitizedHtml(?string $html): ?string
    {
        $sanitized = BidApplicationText::sanitize($html);

        return $sanitized && ! BidApplicationText::isEmpty($sanitized)
            ? $sanitized
            : null;
    }

    private function quotationDocument(Request $request, Quotation $quotation): QuotationDocument
    {
        return QuotationDocument::for($quotation, $request->user())
            ->withProposalTitle($request->query('proposal_title'));
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, string>
     */
    public function proposalTitleAttributes(array $validated): array
    {
        if (! $this->quotationsHaveProposalTitle()) {
            return [];
        }

        return [
            'proposal_title' => $this->proposalTitleValue(
                is_string($validated['proposal_title'] ?? null) ? $validated['proposal_title'] : null,
            ),
        ];
    }

    private function proposalTitleValue(?string $title): string
    {
        $title = trim((string) $title);

        return $title !== '' ? $title : Quotation::DEFAULT_PROPOSAL_TITLE;
    }

    private function quotationsHaveProposalTitle(): bool
    {
        return $this->quotationsHaveProposalTitle ??= Schema::hasColumn('quotations', 'proposal_title');
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, bool>
     */
    public function authorizationAttributes(array $validated, ?Quotation $quotation = null): array
    {
        if (! $this->quotationsHaveAuthorization()) {
            return [];
        }

        $include = array_key_exists('include_authorization', $validated)
            ? (bool) $validated['include_authorization']
            : (bool) ($quotation?->include_authorization ?? true);

        return [
            'include_authorization' => $include,
        ];
    }

    private function quotationsHaveAuthorization(): bool
    {
        return $this->quotationsHaveAuthorization ??= Schema::hasColumn('quotations', 'include_authorization');
    }

    /**
     * @return list<string>
     */
    private function contractorColumns(): array
    {
        $columns = ['id', 'name'];

        if ($this->contractorsHaveRole()) {
            $columns[] = 'role';
        }

        return $columns;
    }

    private function contractorsHaveRole(): bool
    {
        return $this->contractorsHaveRole ??= Schema::hasColumn('contractors', 'role');
    }

    private function contractorRole(Contractor $contractor): string
    {
        if (! $this->contractorsHaveRole()) {
            return Contractor::ROLE_CONTRACTOR;
        }

        $role = $contractor->role;

        return in_array($role, Contractor::ROLES, true)
            ? $role
            : Contractor::ROLE_CONTRACTOR;
    }

    private function contactPayload(ContractorContact $contact): array
    {
        return [
            'id' => $contact->id,
            'name' => $contact->name,
            'title' => $contact->title,
            'email' => $contact->email,
            'phone_number' => $contact->phone_number,
            'is_primary' => (bool) $contact->is_primary,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function options(?User $user): array
    {
        return [
            ...PrintLayoutCatalog::forDocument('quotation'),
            'can' => [
                'create' => $user ? QuotationAccess::canCreate($user) : false,
                'update' => $user ? QuotationAccess::canUpdate($user) : false,
                'delete' => $user ? QuotationAccess::canDelete($user) : false,
                'convert_to_bid' => $user ? BidAccess::canCreate($user) : false,
            ],
            'nextQuotationNumber' => Quotation::nextNumber(),
            'revisionResponsibleUsers' => QuotationRevisionResponsible::options(),
            'revisionStatuses' => QuotationRevisionStatus::options(),
            'revisionTitles' => QuotationRevisionTitle::options(),
            'proposalTextTemplates' => $this->textTemplates(BidTextTemplate::KIND_QUOTATION_PROPOSAL),
            'pricingTextTemplates' => $this->textTemplates(BidTextTemplate::KIND_QUOTATION_PRICING),
            'pricingBasisTextTemplates' => $this->textTemplates(BidTextTemplate::KIND_QUOTATION_PRICING_BASIS),
            'company' => $this->companyOption(),
            'titles' => QuotationTitle::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (QuotationTitle $title): array => [
                    'id' => $title->id,
                    'name' => $title->name,
                ])
                ->values()
                ->all(),
            'fields' => QuotationField::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (QuotationField $field): array => [
                    'id' => $field->id,
                    'name' => $field->name,
                ])
                ->values()
                ->all(),
            'products' => Product::query()
                ->with(['manufacturer', 'configurations', 'handings', 'constructions', 'glassType', 'glazingType', 'seal'])
                ->orderBy('name')
                ->get()
                ->map(fn (Product $product): array => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'abbreviation' => $product->abbreviation,
                    'kind' => $product->kind,
                    'fields' => QuotationField::specificationsFromProduct($product),
                ])
                ->values()
                ->all(),
            'statuses' => collect(Quotation::STATUSES)
                ->map(fn (string $status): array => [
                    'id' => $status,
                    'name' => Quotation::statusLabel($status),
                ])
                ->values()
                ->all(),
            'contractors' => Contractor::query()
                ->with('contacts')
                ->orderBy('name')
                ->get($this->contractorColumns())
                ->map(fn (Contractor $contractor): array => [
                    'id' => $contractor->id,
                    'name' => $contractor->name,
                    'role' => $this->contractorRole($contractor),
                    'role_label' => Contractor::roleLabel($this->contractorRole($contractor)),
                    'contacts' => $contractor->contacts
                        ->map(fn (ContractorContact $contact): array => $this->contactPayload($contact))
                        ->values()
                        ->all(),
                ])
                ->values()
                ->all(),
            'projects' => Project::query()
                ->with('contractors:id')
                ->orderByDesc('id')
                ->get([
                    'id',
                    'name',
                    'project_number',
                    'site_address_line_1',
                    'site_address_line_2',
                    'site_city',
                    'site_state',
                    'site_postal_code',
                    'site_country',
                ])
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'project_number' => $project->project_number,
                    'contractor_ids' => $project->contractors->pluck('id')->all(),
                    'label' => trim(($project->project_number ? $project->project_number.' · ' : '').$project->name),
                    'site_address' => BidApplicationText::formatAddress(
                        $project->site_address_line_1,
                        $project->site_address_line_2,
                        $project->site_city,
                        $project->site_state,
                        $project->site_postal_code,
                        $project->site_country,
                    ) ?: null,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  Builder<Quotation>  $query
     * @return array{statuses: list<array{status: string, status_key: string, count: int, total_amount: float, formatted_total: string}>, total_count: int, total_amount: float, formatted_total_amount: string}
     */
    private function quotationStatusSummary(Builder $query): array
    {
        $allQuotations = (clone $query)->get();

        $statusGroups = $allQuotations
            ->groupBy(fn (Quotation $quotation): string => $quotation->status ?: 'draft');

        $orderedStatuses = Quotation::STATUSES;
        $sortedKeys = $statusGroups->keys()->sort(function (string $a, string $b) use ($orderedStatuses): int {
            $posA = array_search($a, $orderedStatuses, true);
            $posB = array_search($b, $orderedStatuses, true);

            if ($posA !== false && $posB !== false) {
                return $posA <=> $posB;
            }
            if ($posA !== false) {
                return -1;
            }
            if ($posB !== false) {
                return 1;
            }

            return strnatcasecmp($a, $b);
        });

        $statuses = $sortedKeys->map(function (string $statusKey) use ($statusGroups): array {
            /** @var Collection<int, Quotation> $groupQuotations */
            $groupQuotations = $statusGroups->get($statusKey, collect());
            $count = $groupQuotations->count();
            $totalAmount = round(
                (float) $groupQuotations->sum(
                    fn (Quotation $quotation): float => $this->quotationListAmount($quotation),
                ),
                2,
            );

            return [
                'status' => Quotation::statusLabel($statusKey),
                'status_key' => $statusKey,
                'count' => $count,
                'total_amount' => $totalAmount,
                'formatted_total' => '$'.number_format($totalAmount, 2),
            ];
        })->values()->all();

        $overallTotalAmount = round(
            (float) $allQuotations->sum(
                fn (Quotation $quotation): float => $this->quotationListAmount($quotation),
            ),
            2,
        );

        return [
            'statuses' => $statuses,
            'total_count' => $allQuotations->count(),
            'total_amount' => $overallTotalAmount,
            'formatted_total_amount' => '$'.number_format($overallTotalAmount, 2),
        ];
    }

    private function quotationListAmount(Quotation $quotation): float
    {
        return (float) ($quotation->project_amount ?? $quotation->total());
    }
}
