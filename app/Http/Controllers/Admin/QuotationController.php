<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Contractor;
use App\Models\Project;
use App\Models\Quotation;
use App\Models\QuotationLineItem;
use App\Models\User;
use App\Support\BidAccess;
use App\Support\QuotationAccess;
use App\Support\QuotationDocument;
use App\Support\QuotationToBid;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class QuotationController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);

        $search = (string) $request->query('search', '');
        $highlight = (int) $request->query('highlight', 0);

        return Inertia::render('Admin/Quotations/Index', [
            'filters' => [
                'search' => $search,
                'highlight' => $highlight > 0 ? $highlight : null,
            ],
            'options' => $this->options($request->user()),
            'quotations' => $this->listingQuery($search)
                ->when($highlight > 0, function ($query) use ($highlight): void {
                    $query->orderByRaw('CASE WHEN quotations.id = ? THEN 0 ELSE 1 END', [$highlight]);
                })
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Quotation $quotation): array => $this->quotationPayload($quotation, summary: true)),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless(QuotationAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Quotations/Create', [
            'options' => $this->options($request->user()),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(QuotationAccess::canCreate($request->user()), 403);

        $validated = $this->validatedQuotation($request);

        $quotation = DB::transaction(function () use ($validated, $request): Quotation {
            $quotation = Quotation::create([
                'contractor_id' => $validated['contractor_id'],
                'project_id' => $validated['project_id'] ?: null,
                'title' => $validated['title'],
                'status' => $validated['status'],
                'quoted_at' => $validated['quoted_at'] ?: null,
                'valid_until' => $validated['valid_until'] ?: null,
                'notes' => $validated['notes'] ?: null,
                'created_by' => $request->user()?->id,
            ]);

            $this->syncLineItems($quotation, $validated['line_items']);

            return $quotation;
        });

        return redirect()
            ->route('admin.quotations.index', ['highlight' => $quotation->id])
            ->with('success', 'Quotation saved successfully.');
    }

    public function show(Request $request, Quotation $quotation): Response
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);

        $quotation->load(['contractor.contacts', 'project', 'lineItems', 'convertedBid']);

        return Inertia::render('Admin/Quotations/Show', [
            'quotation' => $this->quotationPayload($quotation),
            'options' => $this->options($request->user()),
        ]);
    }

    public function convertToBid(Request $request, Quotation $quotation): RedirectResponse
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);
        abort_unless(BidAccess::canCreate($request->user()), 403);

        $quotation->load(['lineItems', 'convertedBid']);

        if ($quotation->convertedBid) {
            return redirect()
                ->route('admin.bids.edit', $quotation->convertedBid)
                ->with('success', 'This quotation is already linked to a bid.');
        }

        $bid = QuotationToBid::convert($quotation, $request->user());

        return redirect()
            ->route('admin.bids.edit', $bid)
            ->with('success', 'Bid created from the quotation. Review product lines, then save.');
    }

    public function print(Request $request, Quotation $quotation): View
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);

        return view(
            'admin.quotations.document',
            QuotationDocument::for($quotation, $request->user())->viewData(mode: 'print'),
        );
    }

    public function exportPdf(Request $request, Quotation $quotation): HttpResponse
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);

        return QuotationDocument::for($quotation, $request->user())->pdfResponse();
    }

    public function exportWord(Request $request, Quotation $quotation): BinaryFileResponse
    {
        abort_unless(QuotationAccess::canView($request->user()), 403);

        return QuotationDocument::for($quotation, $request->user())->wordResponse();
    }

    public function edit(Request $request, Quotation $quotation): Response
    {
        abort_unless(QuotationAccess::canUpdate($request->user()), 403);

        $quotation->load(['contractor.contacts', 'project', 'lineItems', 'convertedBid']);

        return Inertia::render('Admin/Quotations/Edit', [
            'quotation' => $this->quotationPayload($quotation),
            'options' => $this->options($request->user()),
        ]);
    }

    public function update(Request $request, Quotation $quotation): RedirectResponse
    {
        abort_unless(QuotationAccess::canUpdate($request->user()), 403);

        $validated = $this->validatedQuotation($request);

        DB::transaction(function () use ($quotation, $validated): void {
            $quotation->update([
                'contractor_id' => $validated['contractor_id'],
                'project_id' => $validated['project_id'] ?: null,
                'title' => $validated['title'],
                'status' => $validated['status'],
                'quoted_at' => $validated['quoted_at'] ?: null,
                'valid_until' => $validated['valid_until'] ?: null,
                'notes' => $validated['notes'] ?: null,
            ]);

            $this->syncLineItems($quotation, $validated['line_items']);
        });

        return redirect()
            ->route('admin.quotations.index', ['highlight' => $quotation->id])
            ->with('success', 'Quotation updated successfully.');
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
    private function validatedQuotation(Request $request): array
    {
        $validated = $request->validate([
            'contractor_id' => ['required', 'integer', 'exists:contractors,id'],
            'project_id' => [
                'nullable',
                'integer',
                Rule::exists('projects', 'id'),
            ],
            'title' => ['required', 'string', 'max:255'],
            'status' => ['required', 'string', Rule::in(Quotation::STATUSES)],
            'quoted_at' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date', 'after_or_equal:quoted_at'],
            'notes' => ['nullable', 'string', 'max:10000'],
            'line_items' => ['required', 'array', 'min:1'],
            'line_items.*.description' => ['required', 'string', 'max:255'],
            'line_items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'line_items.*.unit_price' => ['nullable', 'numeric'],
        ]);

        $validated['line_items'] = collect($validated['line_items'])
            ->values()
            ->map(function (array $item, int $index): array {
                $quantity = $item['quantity'] ?? null;
                $unitPrice = $item['unit_price'] ?? null;
                $extended = $quantity !== null && $unitPrice !== null
                    ? round((float) $quantity * (float) $unitPrice, 2)
                    : null;

                return [
                    'description' => $item['description'],
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'extended' => $extended,
                    'sort_order' => $index,
                ];
            })
            ->all();

        return $validated;
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function syncLineItems(Quotation $quotation, array $items): void
    {
        $quotation->lineItems()->delete();

        foreach ($items as $item) {
            $quotation->lineItems()->create($item);
        }
    }

    private function listingQuery(string $search)
    {
        return Quotation::query()
            ->with(['contractor', 'project', 'lineItems', 'convertedBid'])
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
    private function quotationPayload(Quotation $quotation, bool $summary = false): array
    {
        $quotation->loadMissing(['contractor.contacts', 'project', 'lineItems', 'convertedBid']);

        $contractor = $quotation->contractor;
        $contact = $contractor?->primaryContact();
        $project = $quotation->project;

        $payload = [
            'id' => $quotation->id,
            'uuid' => $quotation->uuid,
            'quotation_number' => $quotation->quotation_number,
            'title' => $quotation->title,
            'status' => $quotation->status,
            'status_label' => Quotation::statusLabel($quotation->status),
            'quoted_at' => $quotation->quoted_at?->toDateString(),
            'valid_until' => $quotation->valid_until?->toDateString(),
            'notes' => $quotation->notes,
            'total' => $quotation->total(),
            'contractor' => $contractor ? [
                'id' => $contractor->id,
                'name' => $contractor->name,
                'contact_name' => $contact?->name,
                'email' => $contact?->email,
                'phone_number' => $contact?->phone_number,
            ] : null,
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
            'converted_bid' => $quotation->convertedBid ? [
                'id' => $quotation->convertedBid->id,
            ] : null,
        ];

        if ($summary) {
            $payload['line_item_count'] = $quotation->lineItems->count();

            return $payload;
        }

        $payload['contractor_id'] = $quotation->contractor_id;
        $payload['project_id'] = $quotation->project_id;
        $payload['line_items'] = $quotation->lineItems->map(fn (QuotationLineItem $item): array => [
            'id' => $item->id,
            'description' => $item->description,
            'quantity' => $item->quantity,
            'unit_price' => $item->unit_price,
            'extended' => $item->extended,
        ])->values()->all();

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    private function options(?User $user): array
    {
        return [
            'can' => [
                'create' => $user ? QuotationAccess::canCreate($user) : false,
                'update' => $user ? QuotationAccess::canUpdate($user) : false,
                'delete' => $user ? QuotationAccess::canDelete($user) : false,
                'convert_to_bid' => $user ? BidAccess::canCreate($user) : false,
            ],
            'statuses' => collect(Quotation::STATUSES)
                ->map(fn (string $status): array => [
                    'id' => $status,
                    'name' => Quotation::statusLabel($status),
                ])
                ->values()
                ->all(),
            'contractors' => Contractor::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Contractor $contractor): array => [
                    'id' => $contractor->id,
                    'name' => $contractor->name,
                ])
                ->values()
                ->all(),
            'projects' => Project::query()
                ->with('contractors:id')
                ->orderByDesc('id')
                ->get(['id', 'name', 'project_number'])
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'project_number' => $project->project_number,
                    'contractor_ids' => $project->contractors->pluck('id')->all(),
                    'label' => trim(($project->project_number ? $project->project_number.' · ' : '').$project->name),
                ])
                ->values()
                ->all(),
        ];
    }
}
