<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\BidPricing;
use App\Models\BidPricingItem;
use App\Models\BidPricingStatus;
use App\Models\BidRevision;
use App\Models\BidScope;
use App\Models\BidScopeProduct;
use App\Models\BidScopeTitle;
use App\Models\BidStage;
use App\Models\BidStageType;
use App\Models\BidTextTemplate;
use App\Models\Company;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectScopeType;
use App\Models\Quotation;
use App\Models\Service;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\BidAccess;
use App\Support\BidApplicationText;
use App\Support\BidDocument;
use App\Support\BidListDocument;
use App\Support\DocumentLogo;
use App\Support\QuotationAccess;
use App\Support\QuotationToBid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BidController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless(BidAccess::canView($request->user()), 403);

        $search = (string) $request->query('search', '');
        $highlight = (int) $request->query('highlight', 0);

        return Inertia::render('Admin/Bids/Index', [
            'filters' => [
                'search' => $search,
                'highlight' => $highlight > 0 ? $highlight : null,
            ],
            'options' => $this->options($request->user()),
            'bids' => $this->bidListingQuery($request)
                ->when($highlight > 0, function ($query) use ($highlight): void {
                    $query->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$highlight]);
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Bid $bid): array => $this->bidPayload($bid, summary: true)),
        ]);
    }

    public function printList(Request $request): View
    {
        abort_unless(BidAccess::canView($request->user()), 403);

        return view('admin.bids.list', $this->listDocument($request)->viewData(mode: 'print'));
    }

    public function exportListPdf(Request $request): HttpResponse
    {
        abort_unless(BidAccess::canView($request->user()), 403);

        return $this->listDocument($request)->pdfResponse();
    }

    public function exportListWord(Request $request): BinaryFileResponse
    {
        abort_unless(BidAccess::canView($request->user()), 403);

        return $this->listDocument($request)->wordResponse();
    }

    public function create(Request $request): Response
    {
        abort_unless(BidAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Bids/Create', [
            'options' => $this->options($request->user()),
            'importQuotationId' => $request->integer('quotation') ?: null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(BidAccess::canCreate($request->user()), 403);

        $validated = $this->validatedBid($request);

        $bid = DB::transaction(function () use ($request, $validated): Bid {
            $bid = Bid::create([
                'project_id' => $validated['project_id'],
                'quotation_id' => $validated['quotation_id'] ?? null,
                'assigned_to' => $validated['assigned_to'] ?? null,
                'notes' => $this->shippingText($validated),
                'bid_shipping_text_template_id' => $validated['bid_shipping_text_template_id'] ?? null,
                'bid_text_template_id' => $validated['bid_text_template_id'] ?? null,
                'application_text' => $this->applicationText($validated),
                'bid_scope_text_template_id' => $validated['bid_scope_text_template_id'] ?? null,
                'scope_of_work_text' => $this->scopeOfWorkText($validated),
                'created_by' => $request->user()->id,
            ]);

            $this->syncBidRelations($bid, $validated, $request->user());

            return $bid;
        });

        return redirect()
            ->route('admin.bids.index', ['highlight' => $bid->id])
            ->with('success', 'Bid created successfully.');
    }

    public function show(Request $request, Bid $bid): Response
    {
        abort_unless(BidAccess::canView($request->user()), 403);

        $bid->load([
            'project:id,name,project_number,site_address_line_1,site_address_line_2,site_city,site_state,site_postal_code,site_country',
            'project.contractors.contacts',
            'quotation:id,quotation_number,title',
            'creator:id,name',
            'assignee:id,name',
            'stages.type',
            'scopes.title',
            'scopes.products.product',
            'scopes.products.service',
            'pricings.items.status',
            'revisions.user:id,name',
        ]);

        return Inertia::render('Admin/Bids/Show', [
            'bid' => $this->bidPayload($bid),
            'options' => $this->options($request->user()),
        ]);
    }

    public function print(Request $request, Bid $bid): View
    {
        abort_unless(BidAccess::canView($request->user()), 403);

        return view('admin.bids.document', BidDocument::for($bid, $request->user())->viewData(mode: 'print'));
    }

    public function exportPdf(Request $request, Bid $bid): HttpResponse
    {
        abort_unless(BidAccess::canView($request->user()), 403);

        return BidDocument::for($bid, $request->user())->pdfResponse();
    }

    public function exportWord(Request $request, Bid $bid): BinaryFileResponse
    {
        abort_unless(BidAccess::canView($request->user()), 403);

        return BidDocument::for($bid, $request->user())->wordResponse();
    }

    public function edit(Request $request, Bid $bid): Response
    {
        abort_unless(BidAccess::canUpdate($request->user()), 403);

        $bid->load([
            'project:id,name,project_number,site_address_line_1,site_address_line_2,site_city,site_state,site_postal_code,site_country',
            'project.contractors.contacts',
            'quotation:id,quotation_number,title',
            'assignee:id,name',
            'stages.type',
            'scopes.title',
            'scopes.products.product',
            'scopes.products.service',
            'pricings.items.status',
            'revisions.user:id,name',
        ]);

        return Inertia::render('Admin/Bids/Edit', [
            'bid' => $this->bidPayload($bid),
            'options' => $this->options($request->user()),
        ]);
    }

    public function update(Request $request, Bid $bid): RedirectResponse
    {
        abort_unless(BidAccess::canUpdate($request->user()), 403);

        $validated = $this->validatedBid($request, $bid);

        DB::transaction(function () use ($request, $bid, $validated): void {
            $bid->fill([
                'project_id' => $validated['project_id'],
                'quotation_id' => $validated['quotation_id'] ?? null,
                'assigned_to' => $validated['assigned_to'] ?? null,
                'notes' => $this->shippingText($validated),
                'bid_shipping_text_template_id' => $validated['bid_shipping_text_template_id'] ?? null,
                'bid_text_template_id' => $validated['bid_text_template_id'] ?? null,
                'application_text' => $this->applicationText($validated),
                'bid_scope_text_template_id' => $validated['bid_scope_text_template_id'] ?? null,
                'scope_of_work_text' => $this->scopeOfWorkText($validated),
            ])->save();

            $this->syncBidRelations($bid, $validated, $request->user());
        });

        return redirect()
            ->route('admin.bids.index', ['highlight' => $bid->id])
            ->with('success', 'Bid updated successfully.');
    }

    public function destroy(Request $request, Bid $bid): RedirectResponse
    {
        abort_unless(BidAccess::canDelete($request->user()), 403);

        $bid->delete();

        return redirect()
            ->route('admin.bids.index')
            ->with('success', 'Bid removed successfully.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedBid(Request $request, ?Bid $bid = null): array
    {
        $validated = $request->validate([
            'project_id' => ['required', 'integer', Rule::exists(Project::class, 'id')],
            'assigned_to' => ['nullable', 'integer', Rule::exists(User::class, 'id')],
            'notes' => ['nullable', 'string', 'max:250000'],
            'bid_shipping_text_template_id' => [
                'nullable',
                'integer',
                Rule::exists(BidTextTemplate::class, 'id')->where(
                    'kind',
                    BidTextTemplate::KIND_SHIPPING,
                ),
            ],
            'bid_text_template_id' => [
                'nullable',
                'integer',
                Rule::exists(BidTextTemplate::class, 'id')->where(
                    'kind',
                    BidTextTemplate::KIND_APPLICATION,
                ),
            ],
            'application_text' => ['nullable', 'string', 'max:250000'],
            'bid_scope_text_template_id' => [
                'nullable',
                'integer',
                Rule::exists(BidTextTemplate::class, 'id')->where(
                    'kind',
                    BidTextTemplate::KIND_SCOPE,
                ),
            ],
            'scope_of_work_text' => ['nullable', 'string', 'max:250000'],
            'stages' => ['array'],
            'stages.*.stage_type_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists(BidStageType::class, 'id'),
            ],
            'stages.*.stage_date' => ['nullable', 'date'],
            'stages.*.notes' => ['nullable', 'string', 'max:2000'],
            'revisions' => ['array'],
            'revisions.*.id' => [
                'nullable',
                'integer',
                Rule::exists(BidRevision::class, 'id')->where(
                    fn ($query) => $bid
                        ? $query->where('bid_id', $bid->id)
                        : $query->whereRaw('0 = 1'),
                ),
            ],
            'revisions.*.number' => ['required', 'string', 'max:50', 'distinct'],
            'revisions.*.revision_date' => ['nullable', 'date'],
            'revisions.*.notes' => ['nullable', 'string', 'max:2000'],
            'scopes' => ['array'],
            'scopes.*.title_id' => [
                'nullable',
                'integer',
                Rule::exists(ProjectScopeType::class, 'id'),
            ],
            'scopes.*.scope_type' => [
                'nullable',
                'string',
                Rule::exists(ProjectScopeType::class, 'slug'),
            ],
            'scopes.*.notations' => ['nullable', 'string', 'max:250000'],
            'scopes.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'scopes.*.unit_bid' => ['nullable', 'numeric', 'min:0'],
            'scopes.*.extended' => ['nullable', 'numeric', 'min:0'],
            'scopes.*.products' => ['array'],
            'scopes.*.products.*.product_id' => [
                'required',
                'integer',
                Rule::exists(Product::class, 'id'),
            ],
            'scopes.*.products.*.service_id' => [
                'required',
                'integer',
                Rule::exists(Service::class, 'id'),
            ],
            'scopes.*.products.*.location' => ['nullable', 'string', 'max:255'],
            'scopes.*.products.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'scopes.*.products.*.unit_bid' => ['nullable', 'numeric', 'min:0'],
            'scopes.*.products.*.extended' => ['nullable', 'numeric', 'min:0'],
            'scopes.*.products.*.allocated_handling' => ['nullable', 'numeric', 'min:0'],
            'pricings' => ['array'],
            'pricings.*.name' => ['required', 'string', 'max:255'],
            'pricings.*.revision_date' => ['nullable', 'date'],
            'pricings.*.notes' => ['nullable', 'string', 'max:2000'],
            'pricings.*.items' => ['array'],
            'pricings.*.items.*.description' => ['nullable', 'string', 'max:255'],
            'pricings.*.items.*.pricing_basis' => ['nullable', 'string', 'max:2000'],
            'pricings.*.items.*.status_id' => [
                'nullable',
                'integer',
                Rule::exists(BidPricingStatus::class, 'id'),
            ],
            'pricings.*.items.*.amount' => ['nullable', 'numeric', 'min:0'],
            'quotation_id' => ['nullable', 'integer', Rule::exists(Quotation::class, 'id')],
        ]);

        if (! empty($validated['quotation_id'])) {
            $quotation = Quotation::query()->find($validated['quotation_id']);

            if ($quotation?->project_id
                && (int) $quotation->project_id !== (int) $validated['project_id']
            ) {
                throw ValidationException::withMessages([
                    'quotation_id' => 'That quotation belongs to a different project.',
                ]);
            }
        }

        return $validated;
    }

    /**
     * @param  array<int, array<string, mixed>>  $revisions
     */
    private function syncRevisions(Bid $bid, array $revisions, User $user): void
    {
        $revisions = collect($revisions)
            ->filter(fn (array $revision): bool => filled($revision['number'] ?? null))
            ->unique(fn (array $revision): string => strtolower(trim((string) $revision['number'])))
            ->values();

        $keptIds = [];

        foreach ($revisions as $revision) {
            $revisionId = (int) ($revision['id'] ?? 0);
            $existing = $revisionId > 0
                ? $bid->revisions()->whereKey($revisionId)->first()
                : null;

            $attributes = [
                'number' => trim((string) $revision['number']),
                'revision_date' => $revision['revision_date'] ?: null,
                'notes' => $revision['notes'] ?? null,
            ];

            if ($existing) {
                $existingDate = $existing->revision_date?->toDateString();
                $changed = $existing->number !== $attributes['number']
                    || $existingDate !== $attributes['revision_date']
                    || trim((string) ($existing->notes ?? '')) !== trim((string) ($attributes['notes'] ?? ''));

                if ($changed) {
                    $attributes['user_id'] = $user->id;
                }

                $existing->update($attributes);
                $keptIds[] = $existing->id;

                continue;
            }

            $created = $bid->revisions()->create([
                ...$attributes,
                'user_id' => $user->id,
            ]);
            $keptIds[] = $created->id;
        }

        $bid->revisions()
            ->when(
                $keptIds !== [],
                fn ($query) => $query->whereKeyNot($keptIds),
                fn ($query) => $query,
            )
            ->delete();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function syncBidRelations(Bid $bid, array $validated, User $user): void
    {
        $this->syncRevisions($bid, $validated['revisions'] ?? [], $user);

        $stageIds = [];

        foreach (array_values($validated['stages'] ?? []) as $index => $stage) {
            $record = BidStage::query()->create([
                'bid_id' => $bid->id,
                'bid_stage_type_id' => $stage['stage_type_id'],
                'stage_date' => $stage['stage_date'] ?: null,
                'notes' => $stage['notes'] ?? null,
                'sort_order' => $index,
            ]);
            $stageIds[] = $record->id;
        }

        BidStage::query()
            ->where('bid_id', $bid->id)
            ->whereNotIn('id', $stageIds)
            ->delete();

        $scopeIds = [];

        foreach (array_values($validated['scopes'] ?? []) as $index => $scope) {
            $titleId = $this->resolvedScopeTitleId($scope);

            if (! $titleId) {
                continue;
            }

            $lines = $this->scopeProductLines($scope);

            $record = BidScope::query()->create([
                'bid_id' => $bid->id,
                'bid_scope_title_id' => $titleId,
                'notations' => $this->sanitizedScopeNotations($scope['notations'] ?? null),
                ...$this->rolledScopeAmounts($lines),
                'sort_order' => $index,
            ]);

            foreach ($lines as $productIndex => $item) {
                $catalogProduct = Product::query()->find($item['product_id']);
                $service = Service::query()->find($item['service_id']);
                $quantity = $this->nullableDecimal($item['quantity'] ?? null);
                $unitBid = $this->nullableDecimal($item['unit_bid'] ?? null);

                BidScopeProduct::query()->create([
                    'bid_scope_id' => $record->id,
                    'product_id' => $item['product_id'],
                    'service_id' => $item['service_id'],
                    'location' => filled($item['location'] ?? null) ? trim((string) $item['location']) : null,
                    'description' => $this->scopeLineDescription($catalogProduct, $service),
                    'quantity' => $quantity,
                    'unit_bid' => $unitBid,
                    'extended' => $this->scopeExtendedAmount(
                        $item['quantity'] ?? null,
                        $item['unit_bid'] ?? null,
                        $item['allocated_handling'] ?? null,
                    ),
                    'allocated_handling' => $this->nullableDecimal($item['allocated_handling'] ?? null),
                    'sort_order' => $productIndex,
                ]);
            }

            $scopeIds[] = $record->id;
        }

        BidScope::query()
            ->where('bid_id', $bid->id)
            ->whereNotIn('id', $scopeIds)
            ->delete();

        if (! array_key_exists('pricings', $validated)) {
            return;
        }

        $pricingIds = [];

        foreach (array_values($validated['pricings'] ?? []) as $index => $pricing) {
            $record = BidPricing::query()->create([
                'bid_id' => $bid->id,
                'name' => $pricing['name'],
                'revision_date' => $pricing['revision_date'] ?: null,
                'notes' => $pricing['notes'] ?? null,
                'sort_order' => $index,
            ]);

            foreach (array_values($pricing['items'] ?? []) as $itemIndex => $item) {
                $description = trim((string) ($item['description'] ?? ''));
                $pricingBasis = trim((string) ($item['pricing_basis'] ?? ''));
                $amount = $item['amount'] !== null && $item['amount'] !== ''
                    ? $item['amount']
                    : null;

                if ($description === '' && $pricingBasis === '' && $amount === null) {
                    continue;
                }

                BidPricingItem::query()->create([
                    'bid_pricing_id' => $record->id,
                    'description' => $description !== '' ? $description : 'Item',
                    'pricing_basis' => $pricingBasis !== '' ? $pricingBasis : null,
                    'bid_pricing_status_id' => $item['status_id'] ?: null,
                    'amount' => $amount,
                    'sort_order' => $itemIndex,
                ]);
            }

            $pricingIds[] = $record->id;
        }

        BidPricing::query()
            ->where('bid_id', $bid->id)
            ->whereNotIn('id', $pricingIds)
            ->delete();
    }

    /**
     * @param  array<string, mixed>  $scope
     */
    private function resolvedScopeTitleId(array $scope): ?int
    {
        $titleId = isset($scope['title_id']) ? (int) $scope['title_id'] : 0;

        if ($titleId > 0) {
            $type = ProjectScopeType::query()->find($titleId);

            if ($type) {
                return $this->bidScopeTitleIdForName($type->name);
            }
        }

        $type = trim((string) ($scope['scope_type'] ?? ''));

        if ($type === '') {
            return null;
        }

        return $this->bidScopeTitleIdForName(Project::serviceTypeLabel($type));
    }

    private function bidScopeTitleIdForName(string $name): int
    {
        $existing = BidScopeTitle::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return $existing->id;
        }

        return BidScopeTitle::query()->create(['name' => $name])->id;
    }

    private function scopeTypeIdForTitle(?BidScopeTitle $title): ?int
    {
        if ($title === null || trim($title->name) === '') {
            return null;
        }

        return ProjectScopeType::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($title->name)])
            ->value('id');
    }

    private function sanitizedScopeNotations(mixed $notations): ?string
    {
        if (! is_string($notations) || trim($notations) === '') {
            return null;
        }

        if (strip_tags($notations) === $notations) {
            return trim($notations);
        }

        return BidApplicationText::sanitize($notations);
    }

    /**
     * @param  array<string, mixed>  $scope
     * @return list<array<string, mixed>>
     */
    private function scopeProductLines(array $scope): array
    {
        $lines = array_values($scope['products'] ?? []);

        if (count($lines) === 1) {
            if (($lines[0]['quantity'] ?? null) === null || ($lines[0]['quantity'] ?? '') === '') {
                $lines[0]['quantity'] = $scope['quantity'] ?? $lines[0]['quantity'] ?? null;
            }

            if (($lines[0]['unit_bid'] ?? null) === null || ($lines[0]['unit_bid'] ?? '') === '') {
                $lines[0]['unit_bid'] = $scope['unit_bid'] ?? $lines[0]['unit_bid'] ?? null;
            }
        }

        return $lines;
    }

    /**
     * @param  list<array<string, mixed>>  $lines
     * @return array{quantity: ?string, unit_bid: ?string, extended: ?string}
     */
    private function rolledScopeAmounts(array $lines): array
    {
        $quantitySum = 0.0;
        $extendedSum = 0.0;
        $hasQuantity = false;
        $hasExtended = false;
        $units = [];

        foreach ($lines as $item) {
            $quantity = $this->nullableDecimal($item['quantity'] ?? null);
            $unitBid = $this->nullableDecimal($item['unit_bid'] ?? null);
            $extended = $this->scopeExtendedAmount(
                $item['quantity'] ?? null,
                $item['unit_bid'] ?? null,
                $item['allocated_handling'] ?? null,
            );

            if ($quantity !== null) {
                $quantitySum += (float) $quantity;
                $hasQuantity = true;
            }

            if ($unitBid !== null) {
                $units[] = $unitBid;
            }

            if ($extended !== null) {
                $extendedSum += (float) $extended;
                $hasExtended = true;
            }
        }

        $uniqueUnits = array_values(array_unique($units));

        return [
            'quantity' => $hasQuantity ? number_format($quantitySum, 2, '.', '') : null,
            'unit_bid' => count($uniqueUnits) === 1 ? $uniqueUnits[0] : null,
            'extended' => $hasExtended ? number_format($extendedSum, 2, '.', '') : null,
        ];
    }

    private function nullableDecimal(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return number_format((float) $value, 2, '.', '');
    }

    private function scopeExtendedAmount(mixed $quantity, mixed $unitBid, mixed $allocatedHandling = null): ?string
    {
        $hasQuantity = $quantity !== null && $quantity !== '';
        $hasUnit = $unitBid !== null && $unitBid !== '';
        $hasAllocated = $allocatedHandling !== null && $allocatedHandling !== '';

        if ($hasQuantity && $hasUnit) {
            $allocated = $hasAllocated ? (float) $allocatedHandling : 0.0;

            return number_format((float) $quantity * (float) $unitBid + $allocated, 2, '.', '');
        }

        if ($hasAllocated) {
            return number_format((float) $allocatedHandling, 2, '.', '');
        }

        return null;
    }

    private function plainScopeNotations(mixed $notations): string
    {
        if (! is_string($notations)) {
            return '';
        }

        return trim(html_entity_decode(strip_tags($notations), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    private function scopeLineDescription(?Product $product, ?Service $service): ?string
    {
        $parts = array_values(array_filter([
            $product?->name,
            $service?->name,
        ], fn (?string $value): bool => filled($value)));

        return $parts === [] ? null : implode(' — ', $parts);
    }

    /**
     * @return array<string, mixed>
     */
    private function bidPayload(Bid $bid, bool $summary = false): array
    {
        $currentStage = $bid->stages->last();
        $bid->loadMissing('quotation', 'assignee:id,name', 'revisions.user:id,name');

        return [
            'id' => $bid->id,
            'uuid' => $bid->uuid,
            'notes' => $summary ? null : BidApplicationText::sanitize($bid->notes),
            'bid_shipping_text_template_id' => $summary ? null : $bid->bid_shipping_text_template_id,
            'bid_text_template_id' => $summary ? null : $bid->bid_text_template_id,
            'application_text' => $summary ? null : BidApplicationText::sanitize($bid->application_text),
            'bid_scope_text_template_id' => $summary ? null : $bid->bid_scope_text_template_id,
            'scope_of_work_text' => $summary ? null : BidApplicationText::sanitize($bid->scope_of_work_text),
            'created_at' => $bid->created_at?->toDateString(),
            'updated_at' => $bid->updated_at?->toDateString(),
            'project' => [
                'id' => $bid->project?->id,
                'name' => $bid->project?->name,
                'project_number' => $bid->project?->project_number,
                'site_address' => $bid->project
                    ? BidApplicationText::formatAddress(
                        $bid->project->site_address_line_1,
                        $bid->project->site_address_line_2,
                        $bid->project->site_city,
                        $bid->project->site_state,
                        $bid->project->site_postal_code,
                        $bid->project->site_country,
                    )
                    : null,
                'contractors' => $bid->project?->contractors
                    ? $bid->project->contractors
                        ->map(fn ($contractor): array => [
                            'id' => $contractor->id,
                            'name' => $contractor->name,
                            'contact_name' => $contractor->contact_name,
                            'email' => $contractor->email,
                            'phone_number' => $contractor->phone_number,
                        ])
                        ->values()
                        ->all()
                    : [],
            ],
            'quotation' => $bid->quotation ? [
                'id' => $bid->quotation->id,
                'quotation_number' => $bid->quotation->quotation_number,
                'title' => $bid->quotation->title,
            ] : null,
            'assigned_to' => $bid->assigned_to,
            'assignee' => $bid->assignee
                ? [
                    'id' => $bid->assignee->id,
                    'name' => $bid->assignee->name,
                ]
                : null,
            'creator' => $summary ? null : [
                'id' => $bid->creator?->id,
                'name' => $bid->creator?->name,
            ],
            'current_stage' => $currentStage?->type?->name,
            'latest_total' => number_format($bid->latestTotal(), 2, '.', ''),
            'revisions' => $summary
                ? []
                : $bid->revisions
                    ->map(fn (BidRevision $revision): array => [
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
                    ])
                    ->values()
                    ->all(),
            'stages' => $bid->stages
                ->map(fn (BidStage $stage): array => [
                    'id' => $stage->id,
                    'stage_type_id' => $stage->bid_stage_type_id,
                    'name' => $stage->type?->name,
                    'stage_date' => $stage->stage_date?->toDateString(),
                    'notes' => $summary ? null : $stage->notes,
                ])
                ->values()
                ->all(),
            'scopes' => $bid->scopes
                ->map(fn (BidScope $scope): array => [
                    'id' => $scope->id,
                    'title_id' => $this->scopeTypeIdForTitle($scope->title),
                    'name' => $scope->title?->name,
                    'notations' => $summary ? null : $scope->notations,
                    'quantity' => $scope->quantity,
                    'unit_bid' => $scope->unit_bid,
                    'extended' => $scope->extended,
                    'products' => $scope->products
                        ->map(fn (BidScopeProduct $product): array => [
                            'id' => $product->id,
                            'product_id' => $product->product_id,
                            'name' => $product->product?->name ?? $product->description,
                            'abbreviation' => $product->product?->abbreviation,
                            'kind' => $product->product?->kind,
                            'service_id' => $product->service_id,
                            'service_name' => $product->service?->name,
                            'location' => $product->location,
                            'description' => $product->description,
                            'quantity' => $product->quantity,
                            'unit_bid' => $product->unit_bid,
                            'extended' => $this->scopeExtendedAmount(
                                $product->quantity,
                                $product->unit_bid,
                                $product->allocated_handling,
                            ) ?? $product->extended,
                            'allocated_handling' => $product->allocated_handling,
                        ])
                        ->values()
                        ->all(),
                ])
                ->values()
                ->all(),
            'pricings' => $bid->pricings
                ->map(function (BidPricing $pricing) use ($summary): array {
                    $total = $pricing->items->sum(
                        fn (BidPricingItem $item): float => (float) ($item->amount ?? 0),
                    );

                    return [
                        'id' => $pricing->id,
                        'name' => $pricing->name,
                        'revision_date' => $pricing->revision_date?->toDateString(),
                        'notes' => $summary ? null : $pricing->notes,
                        'total' => number_format((float) $total, 2, '.', ''),
                        'items' => $summary
                            ? []
                            : $pricing->items
                                ->map(fn (BidPricingItem $item): array => [
                                    'id' => $item->id,
                                    'description' => $item->description,
                                    'pricing_basis' => $item->pricing_basis,
                                    'status_id' => $item->bid_pricing_status_id,
                                    'status_name' => $item->status?->name,
                                    'amount' => $item->amount,
                                ])
                                ->values()
                                ->all(),
                    ];
                })
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function applicationText(array $validated): ?string
    {
        return $this->filledBidHtml($validated, 'application_text');
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function shippingText(array $validated): ?string
    {
        return $this->filledBidHtml($validated, 'notes');
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function scopeOfWorkText(array $validated): ?string
    {
        return $this->filledBidHtml($validated, 'scope_of_work_text');
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function filledBidHtml(array $validated, string $field): ?string
    {
        $project = Project::query()
            ->with(['contractors.contacts', 'scopes'])
            ->findOrFail($validated['project_id']);
        $company = Company::query()->where('is_active', true)->latest()->first();
        $scopeLines = collect($validated['scopes'] ?? [])
            ->map(function (array $scope): ?string {
                $title = isset($scope['title_id'])
                    ? ProjectScopeType::query()->find($scope['title_id'])?->name
                    : null;
                $name = $title
                    ?: (filled($scope['scope_type'] ?? null)
                        ? Project::serviceTypeLabel((string) $scope['scope_type'])
                        : null);

                if (! $name) {
                    return null;
                }

                $notes = $this->plainScopeNotations($scope['notations'] ?? null);

                return $notes !== '' ? $name.': '.$notes : $name;
            })
            ->filter()
            ->values()
            ->all();

        return BidApplicationText::fill(
            BidApplicationText::sanitize($validated[$field] ?? null),
            BidApplicationText::valuesFor(
                $project,
                $company,
                $scopeLines !== [] ? $scopeLines : null,
            ),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function options(?User $user): array
    {
        $company = Company::query()->where('is_active', true)->latest()->first();

        return [
            'projects' => Project::query()
                ->with(['scopes.product', 'scopes.service', 'contractors.contacts'])
                ->orderBy('name')
                ->get()
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'project_number' => $project->project_number,
                    'customer_name' => $project->contractors->first()?->contact_name,
                    'customer_company' => $project->contractors->first()?->name,
                    'contractor_name' => $project->contractors->first()?->name,
                    'site_address' => BidApplicationText::formatAddress(
                        $project->site_address_line_1,
                        $project->site_address_line_2,
                        $project->site_city,
                        $project->site_state,
                        $project->site_postal_code,
                        $project->site_country,
                    ),
                    'estimated_start_date' => $project->estimated_start_date?->format('F j, Y'),
                    'estimated_end_date' => $project->estimated_end_date?->format('F j, Y'),
                    'site_state' => $project->site_state,
                    'scopes' => $project->scopes
                        ->map(fn ($scope): array => [
                            'type' => $scope->scope_type,
                            'name' => Project::serviceTypeLabel((string) $scope->scope_type),
                            'notes' => $scope->notes,
                            'product_id' => $scope->product_id,
                            'service_id' => $scope->service_id,
                        ])
                        ->values()
                        ->all(),
                ])
                ->all(),
            'stageTypes' => BidStageType::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (BidStageType $type): array => [
                    'id' => $type->id,
                    'name' => $type->name,
                ])
                ->all(),
            'scopeTitles' => ProjectScopeType::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (ProjectScopeType $type): array => [
                    'id' => $type->id,
                    'name' => $type->name,
                ])
                ->all(),
            'products' => Product::query()
                ->whereIn('kind', Product::KINDS)
                ->with(['statePrices.taxState'])
                ->orderBy('kind')
                ->orderBy('name')
                ->get()
                ->map(fn (Product $product): array => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'abbreviation' => $product->abbreviation,
                    'kind' => $product->kind,
                    'description' => $product->description,
                    'price' => $product->price,
                    'markup_percent' => $product->markup_percent,
                    'sell_price' => $product->sellPriceForState(null),
                    'state_prices' => $product->statePrices
                        ->map(fn ($statePrice): array => [
                            'tax_state_id' => $statePrice->tax_state_id,
                            'tax_state' => $statePrice->taxState
                                ? [
                                    'id' => $statePrice->taxState->id,
                                    'name' => $statePrice->taxState->name,
                                    'rate' => $statePrice->taxState->rate === null
                                        ? null
                                        : (float) $statePrice->taxState->rate,
                                ]
                                : null,
                            'price' => $statePrice->price,
                            'markup_percent' => $statePrice->markup_percent,
                            'sell_price' => $product->sellPriceForState(
                                $statePrice->taxState?->name,
                            ),
                        ])
                        ->values()
                        ->all(),
                ])
                ->all(),
            'services' => Service::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Service $service): array => [
                    'id' => $service->id,
                    'name' => $service->name,
                ])
                ->all(),
            'pricingStatuses' => BidPricingStatus::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (BidPricingStatus $status): array => [
                    'id' => $status->id,
                    'name' => $status->name,
                ])
                ->all(),
            'textTemplates' => BidTextTemplate::query()
                ->where('kind', BidTextTemplate::KIND_APPLICATION)
                ->orderBy('name')
                ->get(['id', 'name', 'body'])
                ->map(fn (BidTextTemplate $template): array => [
                    'id' => $template->id,
                    'name' => $template->name,
                    'body' => $template->body,
                ])
                ->all(),
            'scopeTextTemplates' => BidTextTemplate::query()
                ->where('kind', BidTextTemplate::KIND_SCOPE)
                ->orderBy('name')
                ->get(['id', 'name', 'body'])
                ->map(fn (BidTextTemplate $template): array => [
                    'id' => $template->id,
                    'name' => $template->name,
                    'body' => $template->body,
                ])
                ->all(),
            'shippingTextTemplates' => BidTextTemplate::query()
                ->where('kind', BidTextTemplate::KIND_SHIPPING)
                ->orderBy('name')
                ->get(['id', 'name', 'body'])
                ->map(fn (BidTextTemplate $template): array => [
                    'id' => $template->id,
                    'name' => $template->name,
                    'body' => $template->body,
                ])
                ->all(),
            'company' => [
                'name' => $company?->name ?: 'Gateway Door Systems',
                'legal_name' => $company?->legal_name,
                'email' => $company?->email,
                'phone' => $company?->contact_phone_number ?: $company?->phone_number,
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
            ],
            'quotations' => $user && QuotationAccess::canView($user)
                ? Quotation::query()
                    ->with(['contractor:id,name', 'lineItems'])
                    ->latest()
                    ->limit(200)
                    ->get()
                    ->map(fn (Quotation $quotation): array => QuotationToBid::optionPayload($quotation))
                    ->values()
                    ->all()
                : [],
            'assignees' => User::query()
                ->whereHas('level', fn ($query) => $query->whereIn('name', [
                    UserLevel::SUPER_ADMIN,
                    UserLevel::ADMINISTRATOR,
                    UserLevel::ADMIN,
                    UserLevel::PROJECT_MANAGER,
                ]))
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (User $assignee): array => [
                    'id' => $assignee->id,
                    'name' => $assignee->name,
                ])
                ->all(),
            'can' => [
                'create' => $user ? BidAccess::canCreate($user) : false,
                'update' => $user ? BidAccess::canUpdate($user) : false,
                'delete' => $user ? BidAccess::canDelete($user) : false,
            ],
        ];
    }

    private function listDocument(Request $request): BidListDocument
    {
        return new BidListDocument(
            bids: $this->bidListingQuery($request)->latest()->get(),
            company: DocumentLogo::company(),
            user: $request->user(),
            search: (string) $request->query('search', ''),
        );
    }

    private function bidListingQuery(Request $request): Builder
    {
        $search = (string) $request->query('search', '');

        return Bid::query()
            ->with([
                'project:id,name,project_number',
                'project.contractors.contacts',
                'assignee:id,name',
                'stages.type',
                'scopes.title',
                'scopes.products.product',
                'scopes.products.service',
                'pricings.items',
            ])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('notes', 'like', "%{$search}%")
                        ->orWhere('application_text', 'like', "%{$search}%")
                        ->orWhere('scope_of_work_text', 'like', "%{$search}%")
                        ->orWhereHas('project', function ($query) use ($search): void {
                            $query
                                ->where('name', 'like', "%{$search}%")
                                ->orWhere('project_number', 'like', "%{$search}%");
                        })
                        ->orWhereHas('stages.type', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('scopes.title', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('scopes.products.product', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('scopes.products.service', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('scopes', function ($query) use ($search): void {
                            $query->where('notations', 'like', "%{$search}%");
                        });
                });
            });
    }
}
