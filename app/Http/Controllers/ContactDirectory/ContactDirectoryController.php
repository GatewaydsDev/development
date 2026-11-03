<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactDirectory\LogCommunicationRequest;
use App\Http\Requests\ContactDirectory\StoreContactDirectoryContactRequest;
use App\Http\Requests\ContactDirectory\UpdateContactDirectoryContactRequest;
use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\User;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ContactDirectoryController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'contact_type', 'owner_id', 'is_active', 'overdue_follow_ups', 'assigned_to_me']);

        $query = ContactDirectoryContact::query()
            ->withPrimaryDetails()
            ->with(['owner', 'inquiries'])
            ->withCount([
                'followUps as pending_follow_ups_count' => fn (Builder $query): Builder => $query->where('status', 'pending'),
            ])
            ->withMax('activities as last_activity_at', 'occurred_at')
            ->withMax('followUps as next_follow_up_at', 'due_at')
            ->when((bool) ($filters['overdue_follow_ups'] ?? false), function ($query): void {
                $query->whereHas('followUps', function ($query): void {
                    $query->where('status', 'pending')
                        ->where('due_at', '<', now());
                });
            })
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('ContactDirectory/Contacts/Index', [
            'filters' => $filters,
            'contacts' => $query,
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function show(Request $request, ContactDirectoryContact $contact): Response
    {
        $contact->load([
            'company',
            'owner',
            'phoneNumbers',
            'emailAddresses',
        ]);

        $tab = $request->string('tab', 'overview');

        $inquiries = $contact->inquiries()
            ->with(['assignedUser', 'priceRequest:id,uuid,title,status'])
            ->withCount(['followUps as pending_follow_ups_count' => fn (Builder $query): Builder => $query->where('status', 'pending')])
            ->withCount('supplierQuotes')
            ->latest()
            ->paginate(10, ['*'], 'inquiries_page')
            ->withQueryString();

        $activities = $contact->activities()
            ->with(['creator:id,name', 'inquiry:id,uuid,title'])
            ->latest('occurred_at')
            ->paginate(15, ['*'], 'activities_page')
            ->withQueryString();

        $followUps = $contact->followUps()
            ->with(['assignedUser:id,name', 'inquiry:id,uuid,title', 'completedByUser:id,name'])
            ->orderByRaw("case status when 'pending' then 0 when 'completed' then 1 else 2 end asc, due_at desc")
            ->paginate(15, ['*'], 'follow_ups_page')
            ->withQueryString();

        $nextFollowUp = $contact->followUps()
            ->where('status', 'pending')
            ->with(['assignedUser:id,name', 'inquiry:id,uuid,title'])
            ->orderBy('due_at')
            ->first();

        return Inertia::render('ContactDirectory/Contacts/Show', [
            'contact' => $contact,
            'tab' => $tab->toString(),
            'inquiries' => $inquiries,
            'activities' => $activities,
            'followUps' => $followUps,
            'nextFollowUp' => $nextFollowUp,
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function logCommunication(LogCommunicationRequest $request, ContactDirectoryContact $contact): mixed
    {
        $validated = $request->validated();

        $contact->activities()->create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Communication logged.');
    }

    public function store(StoreContactDirectoryContactRequest $request): mixed
    {
        $validated = $request->validated();

        $contact = DB::transaction(function () use ($validated): ContactDirectoryContact {
            $contact = ContactDirectoryContact::create([
                'company_id' => $validated['company_id'] ?? null,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'] ?? null,
                'job_title' => $validated['job_title'] ?? null,
                'contact_type' => $validated['contact_type'],
                'owner_id' => $validated['owner_id'],
                'notes' => $validated['notes'] ?? null,
                'is_active' => $validated['is_active'] ?? true,
            ]);

            foreach ($validated['phone_numbers'] ?? [] as $index => $phone) {
                $contact->phoneNumbers()->create([
                    'phone_number' => $phone['phone_number'],
                    'label' => $phone['label'] ?? 'office',
                    'extension' => $phone['extension'] ?? null,
                    'is_primary' => $index === 0 || (bool) ($phone['is_primary'] ?? false),
                ]);
            }

            foreach ($validated['email_addresses'] ?? [] as $index => $email) {
                $contact->emailAddresses()->create([
                    'email_address' => $email['email_address'],
                    'label' => $email['label'] ?? 'main',
                    'is_primary' => $index === 0 || (bool) ($email['is_primary'] ?? false),
                ]);
            }

            return $contact;
        });

        return redirect()->route('contact-directory.contacts.show', $contact)->with('success', 'Contact created successfully.');
    }

    public function update(UpdateContactDirectoryContactRequest $request, ContactDirectoryContact $contact): mixed
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated, $contact): void {
            $contact->update([
                'company_id' => $validated['company_id'] ?? null,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'] ?? null,
                'job_title' => $validated['job_title'] ?? null,
                'contact_type' => $validated['contact_type'],
                'owner_id' => $validated['owner_id'],
                'notes' => $validated['notes'] ?? null,
                'is_active' => $validated['is_active'] ?? true,
            ]);

            $this->syncPhoneNumbers($contact, $validated['phone_numbers'] ?? []);
            $this->syncEmailAddresses($contact, $validated['email_addresses'] ?? []);
        });

        return back()->with('success', 'Contact updated successfully.');
    }

    private function syncPhoneNumbers(ContactDirectoryContact $contact, array $phones): void
    {
        $keepIds = [];

        foreach ($phones as $phone) {
            if (! empty($phone['id'])) {
                $existing = $contact->phoneNumbers()->whereKey($phone['id'])->first();
            } else {
                $existing = $contact->phoneNumbers()->where('phone_number', $phone['phone_number'])->first();
            }

            if ($existing) {
                $existing->update([
                    'phone_number' => $phone['phone_number'],
                    'label' => $phone['label'] ?? 'office',
                    'extension' => $phone['extension'] ?? null,
                    'is_primary' => (bool) ($phone['is_primary'] ?? false),
                ]);
                $keepIds[] = $existing->id;
            } else {
                $created = $contact->phoneNumbers()->create([
                    'phone_number' => $phone['phone_number'],
                    'label' => $phone['label'] ?? 'office',
                    'extension' => $phone['extension'] ?? null,
                    'is_primary' => (bool) ($phone['is_primary'] ?? false),
                ]);
                $keepIds[] = $created->id;
            }
        }

        $contact->phoneNumbers()->whereNotIn('id', $keepIds)->delete();
    }

    private function syncEmailAddresses(ContactDirectoryContact $contact, array $emails): void
    {
        $keepIds = [];

        foreach ($emails as $email) {
            if (! empty($email['id'])) {
                $existing = $contact->emailAddresses()->whereKey($email['id'])->first();
            } else {
                $existing = $contact->emailAddresses()->where('email_address', $email['email_address'])->first();
            }

            if ($existing) {
                $existing->update([
                    'email_address' => $email['email_address'],
                    'label' => $email['label'] ?? 'main',
                    'is_primary' => (bool) ($email['is_primary'] ?? false),
                ]);
                $keepIds[] = $existing->id;
            } else {
                $created = $contact->emailAddresses()->create([
                    'email_address' => $email['email_address'],
                    'label' => $email['label'] ?? 'main',
                    'is_primary' => (bool) ($email['is_primary'] ?? false),
                ]);
                $keepIds[] = $created->id;
            }
        }

        $contact->emailAddresses()->whereNotIn('id', $keepIds)->delete();
    }
}
