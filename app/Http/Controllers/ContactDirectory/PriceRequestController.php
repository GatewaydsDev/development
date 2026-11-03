<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactDirectory\StorePriceRequestRequest;
use App\Http\Requests\ContactDirectory\UpdatePriceRequestRequest;
use App\Http\Requests\ContactDirectory\StorePreferredQuoteRequest;
use App\Http\Requests\ContactDirectory\StoreContactDirectoryInquiryRequest;
use App\Http\Requests\ContactDirectory\StoreFollowUpRequest;
use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\PriceRequest;
use App\Models\ContactDirectory\PriceRequestPreferredQuote;
use App\Models\ContactDirectory\SupplierQuote;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PriceRequestController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'status', 'project_id', 'owner_id']);

        $priceRequests = PriceRequest::query()
            ->with([
                'project:id,uuid,name,project_number',
                'owner:id,name',
            ])
            ->withCount([
                'inquiries',
                'inquiries as open_inquiries_count' => fn ($query): mixed => $query->whereNotIn('status', ['closed', 'cancelled']),
            ])
            ->when((string) ($filters['search'] ?? '') !== '', function ($query) use ($filters): void {
                $search = (string) $filters['search'];
                $query->where('title', 'like', "%{$search}%");
            })
            ->when(! empty($filters['status']), fn ($query): mixed => $query->where('status', (string) $filters['status']))
            ->when(! empty($filters['project_id']), fn ($query): mixed => $query->where('project_id', (int) $filters['project_id']))
            ->when(! empty($filters['owner_id']), fn ($query): mixed => $query->where('owner_id', (int) $filters['owner_id']))
            ->orderByDesc('updated_at')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('ContactDirectory/PriceRequests/Index', [
            'filters' => $filters,
            'priceRequests' => $priceRequests,
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'projects' => Project::query()->orderBy('name')->get(['id', 'uuid', 'name', 'project_number']),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('ContactDirectory/PriceRequests/Form', [
            'priceRequest' => null,
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'projects' => Project::query()->orderBy('name')->get(['id', 'uuid', 'name', 'project_number']),
            'statuses' => PriceRequest::STATUSES,
        ]);
    }

    public function edit(PriceRequest $priceRequest): Response
    {
        $priceRequest->load('items');

        return Inertia::render('ContactDirectory/PriceRequests/Form', [
            'priceRequest' => $priceRequest,
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'projects' => Project::query()->orderBy('name')->get(['id', 'uuid', 'name', 'project_number']),
            'statuses' => PriceRequest::STATUSES,
        ]);
    }

    public function show(Request $request, PriceRequest $priceRequest): Response
    {
        $priceRequest->load([
            'project:id,uuid,name,project_number',
            'owner:id,name',
            'items' => fn ($query): mixed => $query->orderBy('position'),
            'preferredQuoteSelection.supplierQuote:id,uuid,revision_number,currency,grand_total,supplier_reference_number',
            'preferredQuoteSelection.supplierQuote.inquiry.contact:id,uuid,first_name,last_name',
            'preferredQuoteSelection.selectedByUser:id,name',
        ]);

        $inquiries = $priceRequest->inquiries()
            ->with([
                'contact:id,uuid,first_name,last_name',
                'contact.company:id,name',
                'contact.primaryEmail',
                'assignedUser:id,name',
                'currentQuote:id,uuid,revision_number,currency,grand_total,supplier_reference_number',
            ])
            ->withCount(['followUps as pending_follow_ups_count' => fn ($query): mixed => $query->where('status', 'pending')])
            ->latest()
            ->paginate(20, ['*'], 'inquiries_page')
            ->withQueryString();

        return Inertia::render('ContactDirectory/PriceRequests/Show', [
            'priceRequest' => $priceRequest,
            'inquiries' => $inquiries,
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'projects' => Project::query()->orderBy('name')->get(['id', 'uuid', 'name', 'project_number']),
            'contacts' => ContactDirectoryContact::query()->orderBy('last_name')->get(['id', 'uuid', 'first_name', 'last_name']),
        ]);
    }

    public function store(StorePriceRequestRequest $request): mixed
    {
        $validated = $request->validated();

        $priceRequest = PriceRequest::create($validated);

        foreach ($validated['items'] ?? [] as $index => $item) {
            $priceRequest->items()->create([
                'position' => $index,
                'description' => $item['description'],
                'quantity' => $item['quantity'] ?? 1,
                'unit_of_measure' => $item['unit_of_measure'] ?? 'each',
                'specifications' => $item['specifications'] ?? null,
                'notes' => $item['notes'] ?? null,
            ]);
        }

        return redirect()->route('contact-directory.price-requests.show', $priceRequest)->with('success', 'Price request created.');
    }

    public function update(UpdatePriceRequestRequest $request, PriceRequest $priceRequest): mixed
    {
        $validated = $request->validated();

        $priceRequest->update(collect($validated)->except(['items'])->all());

        $this->syncItems($priceRequest, $validated['items'] ?? []);

        return redirect()->route('contact-directory.price-requests.show', $priceRequest)->with('success', 'Price request updated.');
    }

    public function storeInquiry(StoreContactDirectoryInquiryRequest $request, PriceRequest $priceRequest): mixed
    {
        $validated = $request->validated();

        $inquiry = $priceRequest->inquiries()->create([
            ...collect($validated)->except(['price_request_id', 'project_id'])->all(),
            'project_id' => $priceRequest->project_id,
            'created_by' => $request->user()->id,
            'waiting_on' => 'none',
        ]);

        return redirect()->route('contact-directory.inquiries.show', $inquiry)->with('success', 'Supplier inquiry created.');
    }

    public function selectPreferredQuote(StorePreferredQuoteRequest $request, PriceRequest $priceRequest): mixed
    {
        $validated = $request->validated();

        $quote = SupplierQuote::query()->whereKey((int) $validated['supplier_quote_id'])->firstOrFail();

        DB::transaction(function () use ($priceRequest, $quote, $validated, $request): void {
            PriceRequestPreferredQuote::updateOrCreate(
                ['price_request_id' => $priceRequest->id],
                [
                    'supplier_quote_id' => $quote->id,
                    'selection_reason' => $validated['selection_reason'],
                    'selected_by' => $request->user()->id,
                    'selected_at' => now(),
                ],
            );
        });

        return back()->with('success', 'Preferred quote selected.');
    }

    private function syncItems(PriceRequest $priceRequest, array $items): void
    {
        $keepIds = [];

        foreach ($items as $index => $item) {
            if (! empty($item['id'])) {
                $existing = $priceRequest->items()->whereKey($item['id'])->first();
            } else {
                $existing = null;
            }

            $payload = [
                'position' => $index,
                'description' => $item['description'],
                'quantity' => $item['quantity'] ?? 1,
                'unit_of_measure' => $item['unit_of_measure'] ?? 'each',
                'specifications' => $item['specifications'] ?? null,
                'notes' => $item['notes'] ?? null,
            ];

            if ($existing) {
                $existing->update($payload);
                $keepIds[] = $existing->id;
            } else {
                $created = $priceRequest->items()->create($payload);
                $keepIds[] = $created->id;
            }
        }

        $priceRequest->items()->whereNotIn('id', $keepIds)->delete();
    }
}
