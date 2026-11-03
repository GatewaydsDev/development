<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactDirectory\StoreContactDirectoryInquiryRequest;
use App\Http\Requests\ContactDirectory\UpdateContactDirectoryInquiryRequest;
use App\Http\Requests\ContactDirectory\UpdateContactDirectoryWaitingOnRequest;
use App\Http\Requests\ContactDirectory\LogCommunicationRequest;
use App\Http\Requests\ContactDirectory\StoreSupplierQuoteRequest;
use App\Http\Requests\ContactDirectory\StoreFollowUpRequest;
use App\Models\ContactDirectory\ContactDirectoryInquiry;
use App\Models\Project;
use App\Models\User;
use App\Services\ContactDirectory\NeedsAttentionService;
use App\Services\ContactDirectory\SupplierQuoteCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ContactDirectoryInquiryController extends Controller
{
    public function index(Request $request, NeedsAttentionService $needsAttention): Response
    {
        $filters = $request->only([
            'search',
            'status',
            'priority',
            'waiting_on',
            'assigned_user_id',
            'project_id',
            'contact_id',
            'assigned_to_me',
            'needs_attention',
            'waiting_for_response',
        ]);

        $query = ContactDirectoryInquiry::query()
            ->with([
                'contact:id,uuid,first_name,last_name',
                'contact.company:id,name',
                'contact.primaryEmail',
                'assignedUser:id,name',
                'priceRequest:id,uuid,title,status',
                'project:id,uuid,name,project_number',
                'currentQuote:id,uuid,revision_number,grand_total,currency,is_current_revision',
            ])
            ->withCount([
                'followUps as pending_follow_ups_count' => fn ($query): mixed => $query->where('status', 'pending'),
            ])
            ->withMax('activities as last_activity_at', 'occurred_at')
            ->withCount('supplierQuotes as quote_count')
            ->whereNull('deleted_at')
            ->when((string) ($filters['search'] ?? '') !== '', function ($query) use ($filters): void {
                $search = (string) $filters['search'];
                $query->where(function ($query) use ($search): void {
                    $query->where('title', 'like', "%{$search}%")
                        ->orWhere('supplier_reference_number', 'like', "%{$search}%")
                        ->orWhereHas('contact', function ($query) use ($search): void {
                            $query->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%")
                                ->orWhereHas('company', fn ($query): mixed => $query->where('name', 'like', "%{$search}%"));
                        });
                });
            })
            ->when(! empty($filters['status']), fn ($query): mixed => $query->where('status', (string) $filters['status']))
            ->when(! empty($filters['priority']), fn ($query): mixed => $query->where('priority', (string) $filters['priority']))
            ->when(! empty($filters['waiting_on']), fn ($query): mixed => $query->where('waiting_on', (string) $filters['waiting_on']))
            ->when(! empty($filters['assigned_user_id']), fn ($query): mixed => $query->where('assigned_user_id', (int) $filters['assigned_user_id']))
            ->when(! empty($filters['project_id']), fn ($query): mixed => $query->where('project_id', (int) $filters['project_id']))
            ->when(! empty($filters['contact_id']), fn ($query): mixed => $query->where('contact_id', (int) $filters['contact_id']))
            ->when((bool) ($filters['assigned_to_me'] ?? false), fn ($query): mixed => $query->where('assigned_user_id', $request->user()->id))
            ->when((bool) ($filters['waiting_for_response'] ?? false), function ($query): void {
                $query->where('status', 'waiting_for_response');
            })
            ->when((bool) ($filters['needs_attention'] ?? false), function ($query) use ($needsAttention, $request): void {
                $needsAttention->applyInquiryFilter($query, $request->user());
            })
            ->orderByDesc('updated_at')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('ContactDirectory/Inquiries/Index', [
            'filters' => $filters,
            'inquiries' => $query,
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'projects' => Project::query()->orderBy('name')->get(['id', 'uuid', 'name', 'project_number']),
            'needsAttention' => $needsAttention->suggestionsForUser($request->user()),
        ]);
    }

    public function show(Request $request, ContactDirectoryInquiry $inquiry, NeedsAttentionService $needsAttention): Response
    {
        $inquiry->load([
            'contact.company:id,uuid,name',
            'contact.phoneNumbers',
            'contact.emailAddresses',
            'contact.owner:id,name',
            'assignedUser:id,name',
            'waitingOnUser:id,name',
            'priceRequest:id,uuid,title,status,currency',
            'project:id,uuid,name,project_number',
            'currentQuote',
        ]);

        $activities = $inquiry->activities()
            ->with(['creator:id,name'])
            ->latest('occurred_at')
            ->paginate(15, ['*'], 'activities_page')
            ->withQueryString();

        $followUps = $inquiry->followUps()
            ->with(['assignedUser:id,name', 'completedByUser:id,name'])
            ->orderByRaw("case status when 'pending' then 0 when 'completed' then 1 else 2 end asc, due_at desc")
            ->paginate(15, ['*'], 'follow_ups_page')
            ->withQueryString();

        $quotes = $inquiry->supplierQuotes()
            ->with(['items' => fn ($query): mixed => $query->orderBy('position')])
            ->get();

        return Inertia::render('ContactDirectory/Inquiries/Show', [
            'inquiry' => $inquiry,
            'activities' => $activities,
            'followUps' => $followUps,
            'quotes' => $quotes,
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'suggestions' => $needsAttention->suggestionsForInquiry($inquiry),
        ]);
    }

    public function store(StoreContactDirectoryInquiryRequest $request): mixed
    {
        $validated = $request->validated();

        $inquiry = ContactDirectoryInquiry::create([
            ...$validated,
            'created_by' => $request->user()->id,
            'waiting_on' => 'none',
        ]);

        return redirect()->route('contact-directory.inquiries.show', $inquiry)->with('success', 'Inquiry created successfully.');
    }

    public function update(UpdateContactDirectoryInquiryRequest $request, ContactDirectoryInquiry $inquiry): mixed
    {
        $validated = $request->validated();

        $status = $validated['status'] ?? $inquiry->status;

        $inquiry->update([
            ...$validated,
            'closed_at' => $status === 'closed' && $inquiry->closed_at === null
                ? now()
                : ($status === 'closed' ? $inquiry->closed_at : null),
        ]);

        return back()->with('success', 'Inquiry updated successfully.');
    }

    public function updateWaitingOn(UpdateContactDirectoryWaitingOnRequest $request, ContactDirectoryInquiry $inquiry): mixed
    {
        $validated = $request->validated();

        $inquiry->update([
            'waiting_on' => $validated['waiting_on'],
            'waiting_on_user_id' => $validated['waiting_on_user_id'] ?? null,
            'waiting_since' => $validated['waiting_on'] !== 'none' ? now() : null,
            'expected_response_date' => $validated['expected_response_date'] ?? null,
            'waiting_explanation' => $validated['waiting_explanation'] ?? null,
        ]);

        return back()->with('success', 'Waiting responsibility updated.');
    }

    public function logCommunication(LogCommunicationRequest $request, ContactDirectoryInquiry $inquiry): mixed
    {
        $validated = $request->validated();

        $inquiry->activities()->create([
            ...$validated,
            'contact_id' => $inquiry->contact_id,
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Communication logged.');
    }

    public function storeQuote(StoreSupplierQuoteRequest $request, ContactDirectoryInquiry $inquiry, SupplierQuoteCalculator $calculator): mixed
    {
        $validated = $request->validated();

        $quote = DB::transaction(function () use ($validated, $inquiry, $calculator, $request) {
            $nextRevision = ((int) $inquiry->supplierQuotes()->max('revision_number')) + 1;

            $quote = $inquiry->supplierQuotes()->create([
                ...collect($validated)->except(['items'])->all(),
                'revision_number' => $nextRevision,
                'is_current_revision' => true,
                'created_by' => $request->user()->id,
                'review_status' => 'unreviewed',
            ]);

            foreach ($validated['items'] ?? [] as $index => $item) {
                $lineTotal = $calculator->calculateItemLineTotal(
                    $item['quantity'] ?? 1,
                    $item['unit_price'] ?? null,
                );

                $quote->items()->create([
                    'price_request_item_id' => $item['price_request_item_id'] ?? null,
                    'position' => $index,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'] ?? 1,
                    'unit_of_measure' => $item['unit_of_measure'] ?? 'each',
                    'unit_price' => $item['unit_price'] ?? null,
                    'line_total' => $lineTotal,
                    'availability_notes' => $item['availability_notes'] ?? null,
                    'specification_notes' => $item['specification_notes'] ?? null,
                ]);
            }

            $quote->refresh();
            $quote->update(['grand_total' => $calculator->calculateGrandTotal($quote)]);

            return $quote;
        });

        return back()->with('success', "Supplier quote revision {$quote->revision_number} recorded.");
    }

    public function storeFollowUp(StoreFollowUpRequest $request, ContactDirectoryInquiry $inquiry): mixed
    {
        $validated = $request->validated();

        $inquiry->followUps()->create([
            ...$validated,
            'contact_id' => $inquiry->contact_id,
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Follow-up scheduled.');
    }
}
