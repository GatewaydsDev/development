<?php

namespace App\Http\Controllers;

use App\Mail\ContactRequestEmail;
use App\Models\Company;
use App\Models\Contact;
use App\Models\ContactSubmission;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $notifications = $request->user()
            ->notifications()
            ->latest()
            ->limit(100)
            ->get();

        $statuses = $this->submissionStatuses($notifications);

        return Inertia::render('Notifications/Index', [
            'notifications' => $notifications
                ->map(fn (DatabaseNotification $notification): array => [
                    ...$this->serialize($notification),
                    'status' => $statuses[$notification->data['contact_submission_id'] ?? null] ?? null,
                ])
                ->values(),
            'unreadCount' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function show(Request $request, DatabaseNotification $notification): Response
    {
        $this->authorizeNotification($request, $notification);

        if ($notification->unread()) {
            $notification->markAsRead();
        }

        $notification = $notification->refresh();
        $submission = $this->relatedSubmission($notification);

        return Inertia::render('Notifications/Show', [
            'notification' => [
                ...$this->serialize($notification),
                'status' => $submission?->status ?? 'new',
            ],
            'contacts' => Contact::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'company', 'title'])
                ->map(fn (Contact $contact): array => [
                    'id' => $contact->id,
                    'name' => $contact->name,
                    'email' => $contact->email,
                    'company' => $contact->company,
                    'title' => $contact->title,
                ])
                ->values(),
            'companyEmail' => $this->companyEmail(),
            'canSendEmail' => $submission !== null,
            'emailedContactIds' => $submission
                ? $submission->contacts()
                    ->wherePivotNotNull('emailed_at')
                    ->pluck('contacts.id')
                    ->all()
                : [],
        ]);
    }

    public function sendEmail(Request $request, DatabaseNotification $notification): RedirectResponse
    {
        $this->authorizeNotification($request, $notification);

        $submission = $this->relatedSubmission($notification);

        abort_if($submission === null, 404);

        $validated = $request->validate([
            'contact_ids' => ['array'],
            'contact_ids.*' => ['integer', Rule::exists('contacts', 'id')],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:5000'],
            'include_company' => ['boolean'],
        ]);

        $contacts = Contact::query()
            ->whereIn('id', $validated['contact_ids'] ?? [])
            ->get();

        $includeCompany = (bool) ($validated['include_company'] ?? false);
        $companyEmail = $this->companyEmail();

        if ($contacts->isEmpty() && ! ($includeCompany && $companyEmail)) {
            throw ValidationException::withMessages([
                'contact_ids' => 'Select at least one recipient.',
            ]);
        }

        $subject = $validated['subject'];
        $body = (string) ($validated['message'] ?? '');

        try {
            foreach ($contacts as $contact) {
                Mail::to($contact->email)->send(
                    new ContactRequestEmail($submission, $subject, $body, $contact)
                );

                $submission->contacts()->syncWithoutDetaching([
                    $contact->id => ['emailed_at' => now()],
                ]);
            }

            if ($includeCompany && $companyEmail) {
                Mail::to($companyEmail)->send(
                    new ContactRequestEmail($submission, $subject, $body)
                );
            }
        } catch (Throwable $exception) {
            report($exception);

            throw ValidationException::withMessages([
                'subject' => 'There was an error sending the email. Please try again in a moment.',
            ]);
        }

        return redirect()
            ->route('notifications.index')
            ->with('success', 'Email sent to the selected contacts.');
    }

    public function updateStatus(Request $request, DatabaseNotification $notification): RedirectResponse
    {
        $this->authorizeNotification($request, $notification);

        $submission = $this->relatedSubmission($notification);

        abort_if($submission === null, 404);

        $validated = $request->validate([
            'status' => ['required', Rule::in(ContactSubmission::STATUSES)],
        ]);

        $submission->update(['status' => $validated['status']]);

        return back()->with('success', 'Status updated.');
    }

    public function update(Request $request, DatabaseNotification $notification): RedirectResponse
    {
        $this->authorizeNotification($request, $notification);

        $validated = $request->validate([
            'read' => ['required', 'boolean'],
        ]);

        if ($validated['read']) {
            $notification->markAsRead();
        } else {
            $notification->forceFill(['read_at' => null])->save();
        }

        return back();
    }

    public function destroy(Request $request, DatabaseNotification $notification): RedirectResponse
    {
        $this->authorizeNotification($request, $notification);

        $notification->delete();

        return redirect()->route('notifications.index');
    }

    public function markAsRead(Request $request, DatabaseNotification $notification): RedirectResponse
    {
        $this->authorizeNotification($request, $notification);

        $notification->markAsRead();

        return back();
    }

    private function authorizeNotification(
        Request $request,
        DatabaseNotification $notification
    ): void {
        abort_unless(
            $notification->notifiable_type === get_class($request->user())
                && (int) $notification->notifiable_id === $request->user()->getKey(),
            403
        );
    }

    /**
     * @param  \Illuminate\Support\Collection<int, DatabaseNotification>  $notifications
     * @return array<int, string>
     */
    private function submissionStatuses($notifications): array
    {
        $ids = $notifications
            ->map(fn (DatabaseNotification $notification) => $notification->data['contact_submission_id'] ?? null)
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($ids === []) {
            return [];
        }

        return ContactSubmission::query()
            ->whereIn('id', $ids)
            ->pluck('status', 'id')
            ->all();
    }

    private function relatedSubmission(DatabaseNotification $notification): ?ContactSubmission
    {
        $submissionId = $notification->data['contact_submission_id'] ?? null;

        if (! $submissionId) {
            return null;
        }

        return ContactSubmission::find($submissionId);
    }

    private function companyEmail(): ?string
    {
        $companyEmail = Company::query()
            ->where('is_active', true)
            ->latest()
            ->value('email');

        if (is_string($companyEmail) && $companyEmail !== '') {
            return $companyEmail;
        }

        $configured = config('contact.recipient');

        if (is_string($configured) && $configured !== '') {
            return $configured;
        }

        $from = config('mail.from.address');

        return is_string($from) ? $from : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(DatabaseNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'title' => $notification->data['title'] ?? 'Notification',
            'name' => $notification->data['name'] ?? null,
            'email' => $notification->data['email'] ?? null,
            'phoneNumber' => $notification->data['phone_number'] ?? null,
            'organization' => $notification->data['organization'] ?? null,
            'address' => $notification->data['address'] ?? null,
            'state' => $notification->data['state'] ?? null,
            'country' => $notification->data['country'] ?? null,
            'projectType' => $notification->data['project_type'] ?? null,
            'message' => $notification->data['message'] ?? null,
            'contactSubmissionId' => $notification->data['contact_submission_id'] ?? null,
            'createdAt' => $notification->created_at?->toISOString(),
            'readAt' => $notification->read_at?->toISOString(),
            'isRead' => $notification->read(),
        ];
    }
}
