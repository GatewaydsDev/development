<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\BidPricing;
use App\Models\BidPricingItem;
use App\Models\BidPricingStatus;
use App\Models\BidScope;
use App\Models\BidScopeProduct;
use App\Models\BidScopeTitle;
use App\Models\BidStage;
use App\Models\BidStageType;
use App\Models\Product;
use App\Models\Project;
use App\Models\User;
use App\Support\BidAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

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
            'bids' => Bid::query()
                ->with([
                    'project:id,name,project_number',
                    'stages.type',
                    'scopes.title',
                    'scopes.products.product',
                    'pricings.items',
                ])
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('notes', 'like', "%{$search}%")
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
                            ->orWhereHas('scopes', function ($query) use ($search): void {
                                $query->where('notations', 'like', "%{$search}%");
                            });
                    });
                })
                ->when($highlight > 0, function ($query) use ($highlight): void {
                    $query->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$highlight]);
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Bid $bid): array => $this->bidPayload($bid, summary: true)),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless(BidAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Bids/Create', [
            'options' => $this->options($request->user()),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(BidAccess::canCreate($request->user()), 403);

        $validated = $this->validatedBid($request);

        $bid = DB::transaction(function () use ($request, $validated): Bid {
            $bid = Bid::create([
                'project_id' => $validated['project_id'],
                'notes' => $validated['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            $this->syncBidRelations($bid, $validated);

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
            'project:id,name,project_number',
            'creator:id,name',
            'stages.type',
            'scopes.title',
            'scopes.products.product',
            'pricings.items.status',
        ]);

        return Inertia::render('Admin/Bids/Show', [
            'bid' => $this->bidPayload($bid),
            'options' => $this->options($request->user()),
        ]);
    }

    public function edit(Request $request, Bid $bid): Response
    {
        abort_unless(BidAccess::canUpdate($request->user()), 403);

        $bid->load([
            'project:id,name,project_number',
            'stages.type',
            'scopes.title',
            'scopes.products.product',
            'pricings.items.status',
        ]);

        return Inertia::render('Admin/Bids/Edit', [
            'bid' => $this->bidPayload($bid),
            'options' => $this->options($request->user()),
        ]);
    }

    public function update(Request $request, Bid $bid): RedirectResponse
    {
        abort_unless(BidAccess::canUpdate($request->user()), 403);

        $validated = $this->validatedBid($request);

        DB::transaction(function () use ($bid, $validated): void {
            $bid->fill([
                'project_id' => $validated['project_id'],
                'notes' => $validated['notes'] ?? null,
            ])->save();

            $this->syncBidRelations($bid, $validated);
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
    private function validatedBid(Request $request): array
    {
        return $request->validate([
            'project_id' => ['required', 'integer', Rule::exists(Project::class, 'id')],
            'notes' => ['nullable', 'string', 'max:5000'],
            'stages' => ['array'],
            'stages.*.stage_type_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists(BidStageType::class, 'id'),
            ],
            'stages.*.stage_date' => ['nullable', 'date'],
            'stages.*.notes' => ['nullable', 'string', 'max:2000'],
            'scopes' => ['array'],
            'scopes.*.title_id' => [
                'required',
                'integer',
                Rule::exists(BidScopeTitle::class, 'id'),
            ],
            'scopes.*.notations' => ['nullable', 'string', 'max:5000'],
            'scopes.*.products' => ['array'],
            'scopes.*.products.*.product_id' => [
                'required',
                'integer',
                Rule::exists(Product::class, 'id'),
            ],
            'pricings' => ['array'],
            'pricings.*.name' => ['required', 'string', 'max:255'],
            'pricings.*.revision_date' => ['nullable', 'date'],
            'pricings.*.notes' => ['nullable', 'string', 'max:2000'],
            'pricings.*.items' => ['array'],
            'pricings.*.items.*.description' => ['required', 'string', 'max:255'],
            'pricings.*.items.*.pricing_basis' => ['nullable', 'string', 'max:2000'],
            'pricings.*.items.*.status_id' => [
                'nullable',
                'integer',
                Rule::exists(BidPricingStatus::class, 'id'),
            ],
            'pricings.*.items.*.amount' => ['nullable', 'numeric', 'min:0'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function syncBidRelations(Bid $bid, array $validated): void
    {
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
            $record = BidScope::query()->create([
                'bid_id' => $bid->id,
                'bid_scope_title_id' => $scope['title_id'],
                'notations' => $scope['notations'] ?? null,
                'sort_order' => $index,
            ]);

            foreach (array_values($scope['products'] ?? []) as $productIndex => $item) {
                $catalogProduct = Product::query()->find($item['product_id']);

                BidScopeProduct::query()->create([
                    'bid_scope_id' => $record->id,
                    'product_id' => $item['product_id'],
                    'description' => $catalogProduct?->name,
                    'sort_order' => $productIndex,
                ]);
            }

            $scopeIds[] = $record->id;
        }

        BidScope::query()
            ->where('bid_id', $bid->id)
            ->whereNotIn('id', $scopeIds)
            ->delete();

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
                BidPricingItem::query()->create([
                    'bid_pricing_id' => $record->id,
                    'description' => $item['description'],
                    'pricing_basis' => $item['pricing_basis'] ?? null,
                    'bid_pricing_status_id' => $item['status_id'] ?: null,
                    'amount' => $item['amount'] !== null && $item['amount'] !== ''
                        ? $item['amount']
                        : null,
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
     * @return array<string, mixed>
     */
    private function bidPayload(Bid $bid, bool $summary = false): array
    {
        $latestPricing = $bid->pricings->last();
        $latestTotal = $latestPricing
            ? $latestPricing->items->sum(fn (BidPricingItem $item): float => (float) ($item->amount ?? 0))
            : 0;
        $currentStage = $bid->stages->last();

        return [
            'id' => $bid->id,
            'uuid' => $bid->uuid,
            'notes' => $summary ? null : $bid->notes,
            'created_at' => $bid->created_at?->toDateString(),
            'updated_at' => $bid->updated_at?->toDateString(),
            'project' => [
                'id' => $bid->project?->id,
                'name' => $bid->project?->name,
                'project_number' => $bid->project?->project_number,
            ],
            'creator' => $summary ? null : [
                'id' => $bid->creator?->id,
                'name' => $bid->creator?->name,
            ],
            'current_stage' => $currentStage?->type?->name,
            'latest_total' => number_format((float) $latestTotal, 2, '.', ''),
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
                    'title_id' => $scope->bid_scope_title_id,
                    'name' => $scope->title?->name,
                    'notations' => $summary ? null : $scope->notations,
                    'products' => $scope->products
                        ->map(fn (BidScopeProduct $product): array => [
                            'id' => $product->id,
                            'product_id' => $product->product_id,
                            'name' => $product->product?->name ?? $product->description,
                            'abbreviation' => $product->product?->abbreviation,
                            'kind' => $product->product?->kind,
                            'description' => $product->description,
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
     * @return array<string, mixed>
     */
    private function options(?User $user): array
    {
        return [
            'projects' => Project::query()
                ->orderBy('name')
                ->get(['id', 'name', 'project_number'])
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'project_number' => $project->project_number,
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
            'scopeTitles' => BidScopeTitle::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (BidScopeTitle $title): array => [
                    'id' => $title->id,
                    'name' => $title->name,
                ])
                ->all(),
            'products' => Product::query()
                ->orderBy('kind')
                ->orderBy('name')
                ->get(['id', 'name', 'abbreviation', 'kind', 'description'])
                ->map(fn (Product $product): array => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'abbreviation' => $product->abbreviation,
                    'kind' => $product->kind,
                    'description' => $product->description,
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
            'can' => [
                'create' => $user ? BidAccess::canCreate($user) : false,
                'update' => $user ? BidAccess::canUpdate($user) : false,
                'delete' => $user ? BidAccess::canDelete($user) : false,
            ],
        ];
    }
}
