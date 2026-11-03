<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactDirectory\CompleteFollowUpRequest;
use App\Http\Requests\ContactDirectory\RescheduleFollowUpRequest;
use App\Http\Requests\ContactDirectory\SnoozeFollowUpRequest;
use App\Http\Requests\ContactDirectory\StoreFollowUpRequest;
use App\Http\Requests\ContactDirectory\UpdateFollowUpRequest;
use App\Models\ContactDirectory\FollowUpTaskOption;
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
            'contacts' => ContactDirectoryContact::query()->with(['phoneNumbers:id,contact_id,phone_number,extension,label,is_primary', 'emailAddresses:id,contact_id,email_address,label,is_primary'])->orderBy('last_name')->get(['id', 'uuid', 'first_name', 'last_name']),
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'contactId' => isset($validated['contact_id']) ? (int) $validated['contact_id'] : null,
            'timezone' => config('app.timezone'),
            'taskOptions' => FollowUpTaskOption::query()->orderBy('name')->get(['id', 'name']),
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
                'tasks:id,follow_up_id,title,position',
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

    public function edit(ContactFollowUp $followUp): Response
    {
        abort_unless($followUp->status === 'pending', 404);

        return Inertia::render('ContactDirectory/FollowUps/Create', [
            'contacts' => ContactDirectoryContact::query()->with(['phoneNumbers:id,contact_id,phone_number,extension,label,is_primary', 'emailAddresses:id,contact_id,email_address,label,is_primary'])->orderBy('last_name')->get(['id', 'uuid', 'first_name', 'last_name']),
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'contactId' => $followUp->contact_id,
            'timezone' => config('app.timezone'),
            'taskOptions' => FollowUpTaskOption::query()->orderBy('name')->get(['id', 'name']),
            'followUp' => [...$followUp->only(['id', 'uuid', 'contact_id', 'title', 'description', 'assigned_user_id', 'due_at', 'reminder_at', 'priority']), 'tasks' => $followUp->tasks()->get(['id', 'title'])],
        ]);
    }

    public function update(UpdateFollowUpRequest $request, ContactFollowUp $followUp): mixed
    {
        if ($followUp->status !== 'pending') {
            return back()->withErrors(['status' => 'Only pending follow-ups can be edited.']);
        }

        $validated = $request->validated();
        $tasks = $validated['tasks'] ?? [];
        unset($validated['tasks']);
        $timesChanged = Carbon::parse($validated['due_at'])->ne($followUp->due_at)
            || ($validated['reminder_at'] ?? null) !== $followUp->reminder_at?->format('Y-m-d H:i:s');

        $followUp->update([
            ...$validated,
            'reminder_at' => $validated['reminder_at'] ?? null,
            ...($timesChanged ? ['snoozed_until' => null, 'snoozed_reason' => null, 'reminder_last_notified_at' => null, 'reminder_dismissed_at' => null] : []),
        ]);

        $this->syncTasks($followUp, $tasks);

        return redirect()->route('contact-directory.follow-ups.index')->with('success', 'Follow-up updated.');
    }

    public function dueReminders(Request $request): \Illuminate\Http\JsonResponse
    {
        $reminders = ContactFollowUp::query()
            ->with('contact:id,first_name,last_name')
            ->where('status', 'pending')
            ->where('assigned_user_id', $request->user()->id)
            ->whereNotNull('reminder_at')
            ->where('reminder_at', '<=', now())
            ->where(fn ($query) => $query->whereNull('snoozed_until')->orWhere('snoozed_until', '<=', now()))
            ->where(fn ($query) => $query->whereNull('reminder_dismissed_at')->orWhereColumn('reminder_dismissed_at', '<', 'reminder_at'))
            ->orderBy('reminder_at')
            ->limit(5)
            ->get()
            ->map(fn (ContactFollowUp $followUp): array => [
                'uuid' => $followUp->uuid,
                'title' => $followUp->title,
                'contact' => trim(($followUp->contact?->first_name ?? '').' '.($followUp->contact?->last_name ?? '')),
                'priority' => $followUp->priority,
                'due_at' => $followUp->due_at?->toISOString(),
                'remind_at' => $followUp->reminder_at?->toISOString(),
            ])
            ->all();

        return response()->json(['reminders' => $reminders]);
    }

    public function dismissReminder(ContactFollowUp $followUp): \Illuminate\Http\JsonResponse
    {
        $followUp->forceFill(['reminder_dismissed_at' => now()])->saveQuietly();

        return response()->json(['dismissed' => true]);
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
            'tasks:id,follow_up_id,title',
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

        $tasks = $validated['tasks'] ?? [];
        unset($validated['tasks']);

        $followUp = ContactFollowUp::create([
            ...$validated,
            'contact_id' => $contactId,
            'created_by' => $request->user()->id,
        ]);

        $this->syncTasks($followUp, $tasks);

        return redirect()->route('contact-directory.follow-ups.index')->with('success', 'Follow-up scheduled.');
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

    /** @param array<int, array{title: string}> $tasks */
    private function syncTasks(ContactFollowUp $followUp, array $tasks): void
    {
        $followUp->tasks()->delete();

        foreach (array_values($tasks) as $position => $task) {
            $followUp->tasks()->create(['title' => trim($task['title']), 'position' => $position]);
        }
    }
}
