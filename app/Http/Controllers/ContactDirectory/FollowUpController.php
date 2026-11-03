<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactDirectory\CompleteFollowUpRequest;
use App\Http\Requests\ContactDirectory\RescheduleFollowUpRequest;
use App\Http\Requests\ContactDirectory\SnoozeFollowUpRequest;
use App\Http\Requests\ContactDirectory\StoreFollowUpRequest;
use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactFollowUp;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FollowUpController extends Controller
{
    public function create(Request $request): Response
    {
        $validated = $request->validate([
            'contact_id' => ['nullable', 'integer', Rule::exists('contact_directory_contacts', 'id')->whereNull('deleted_at')],
        ]);

        return Inertia::render('ContactDirectory/FollowUps/Create', [
            'contacts' => ContactDirectoryContact::query()->orderBy('last_name')->get(['id', 'first_name', 'last_name']),
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'contactId' => isset($validated['contact_id']) ? (int) $validated['contact_id'] : null,
            'timezone' => config('app.timezone'),
        ]);
    }

    public function index(Request $request): Response
    {
        $filters = $request->only([
            'search',
            'view',
            'assigned_user_id',
            'priority',
            'contact_id',
            'inquiry_id',
            'due_from',
            'due_to',
            'assigned_to_me',
        ]);

        $view = $filters['view'] ?? 'all';

        $followUps = ContactFollowUp::query()
            ->with([
                'contact:id,uuid,first_name,last_name',
                'contact.company:id,name',
                'inquiry:id,uuid,title,status',
                'assignedUser:id,name',
                'completedByUser:id,name',
            ])
            ->when((string) ($filters['search'] ?? '') !== '', function ($query) use ($filters): void {
                $search = (string) $filters['search'];
                $query->where(function ($query) use ($search): void {
                    $query->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhereHas('contact', function ($query) use ($search): void {
                            $query->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%");
                        });
                });
            })
            ->when($view === 'overdue', function ($query): void {
                $query->where('status', 'pending')
                    ->where('due_at', '<', now());
            })
            ->when($view === 'today', function ($query): void {
                $query->where('status', 'pending')
                    ->whereDate('due_at', now()->toDateString());
            })
            ->when($view === 'upcoming', function ($query): void {
                $query->where('status', 'pending')
                    ->where('due_at', '>', now());
            })
            ->when($view === 'completed', fn ($query): mixed => $query->where('status', 'completed'))
            ->when($view === 'cancelled', fn ($query): mixed => $query->where('status', 'cancelled'))
            ->when(! empty($filters['assigned_user_id']), fn ($query): mixed => $query->where('assigned_user_id', (int) $filters['assigned_user_id']))
            ->when(! empty($filters['priority']), fn ($query): mixed => $query->where('priority', (string) $filters['priority']))
            ->when(! empty($filters['contact_id']), fn ($query): mixed => $query->where('contact_id', (int) $filters['contact_id']))
            ->when(! empty($filters['inquiry_id']), fn ($query): mixed => $query->where('inquiry_id', (int) $filters['inquiry_id']))
            ->when(! empty($filters['due_from']), fn ($query): mixed => $query->whereDate('due_at', '>=', $filters['due_from']))
            ->when(! empty($filters['due_to']), fn ($query): mixed => $query->whereDate('due_at', '<=', $filters['due_to']))
            ->when((bool) ($filters['assigned_to_me'] ?? false), fn ($query): mixed => $query->where('assigned_user_id', $request->user()->id))
            ->orderByRaw("case status when 'pending' then 0 when 'completed' then 1 else 2 end asc")
            ->orderBy('due_at')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('ContactDirectory/FollowUps/Index', [
            'filters' => $filters,
            'view' => $view,
            'followUps' => $followUps,
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'contacts' => ContactDirectoryContact::query()->orderBy('last_name')->get(['id', 'uuid', 'first_name', 'last_name']),
        ]);
    }

    public function show(Request $request, ContactFollowUp $followUp): Response
    {
        $followUp->load([
            'contact:id,uuid,first_name,last_name',
            'contact.company:id,uuid,name',
            'inquiry:id,uuid,title,status',
            'assignedUser:id,name',
            'completedByUser:id,name',
            'creator:id,name',
        ]);

        return Inertia::render('ContactDirectory/FollowUps/Show', [
            'followUp' => $followUp,
        ]);
    }

    public function store(StoreFollowUpRequest $request): mixed
    {
        $validated = $request->validated();

        $contactId = $validated['contact_id'] ?? null;

        if (! $contactId) {
            return back()->withErrors(['contact_id' => 'A contact is required.']);
        }

        $followUp = ContactFollowUp::create([
            ...$validated,
            'contact_id' => $contactId,
            'created_by' => $request->user()->id,
        ]);

        return redirect()->route('contact-directory.follow-ups.show', $followUp)->with('success', 'Follow-up scheduled.');
    }

    public function complete(CompleteFollowUpRequest $request, ContactFollowUp $followUp): mixed
    {
        if ($followUp->status !== 'pending') {
            return back()->withErrors(['status' => 'Only pending follow-ups can be completed.']);
        }

        $followUp->update([
            'status' => 'completed',
            'completed_at' => now(),
            'completed_by' => $request->user()->id,
            'snoozed_reason' => null,
            'snoozed_until' => null,
        ]);

        return back()->with('success', 'Follow-up completed.');
    }

    public function reschedule(RescheduleFollowUpRequest $request, ContactFollowUp $followUp): mixed
    {
        $validated = $request->validated();

        $followUp->update([
            'due_at' => Carbon::parse($validated['due_at']),
            'reminder_at' => isset($validated['reminder_at']) ? Carbon::parse($validated['reminder_at']) : null,
            'snoozed_reason' => null,
            'snoozed_until' => null,
            'reminder_last_notified_at' => null,
        ]);

        return back()->with('success', 'Follow-up rescheduled.');
    }

    public function snooze(SnoozeFollowUpRequest $request, ContactFollowUp $followUp): mixed
    {
        $validated = $request->validated();

        $followUp->update([
            'snoozed_until' => Carbon::parse($validated['snoozed_until']),
            'snoozed_reason' => $validated['reason'] ?? null,
            'reminder_last_notified_at' => null,
        ]);

        return back()->with('success', 'Follow-up snoozed until '.$followUp->snoozed_until->format('M j, Y g:i A').'.');
    }

    public function cancel(Request $request, ContactFollowUp $followUp): mixed
    {
        if ($followUp->status !== 'pending') {
            return back()->withErrors(['status' => 'Only pending follow-ups can be cancelled.']);
        }

        $followUp->update([
            'status' => 'cancelled',
        ]);

        return back()->with('success', 'Follow-up cancelled.');
    }
}
