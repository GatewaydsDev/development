<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Http\Requests\ContactDirectory\SendContactEmailRequest;
use App\Http\Requests\ContactDirectory\LogContactEmailRequest;
use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactDirectoryInquiry;
use App\Models\ContactDirectory\ContactFollowUp;
use App\Models\ContactDirectory\EmailTemplate;
use Illuminate\Support\Str;
use App\Services\ContactDirectory\ContactEmailService;
use App\Services\ContactDirectory\EmailTemplateRenderer;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class ContactEmailController extends Controller
{
    public function compose(Request $request, ContactDirectoryContact $contact, ContactEmailService $emailService, EmailTemplateRenderer $renderer): Response
    {
        $inquiry = null;

        if ($request->filled('inquiry')) {
            $inquiry = $contact->inquiries()->where('uuid', (string) $request->string('inquiry'))->firstOrFail();
        }

        $contact->load(['emailAddresses', 'phoneNumbers']);

        $tasks = ContactFollowUp::query()
            ->where('contact_id', $contact->id)
            ->where('status', 'pending')
            ->orderBy('due_at')
            ->limit(10)
            ->get();

        if ($request->filled('follow_up')) {
            $tasks = $tasks->sortByDesc(fn (ContactFollowUp $task): bool => $task->uuid === (string) $request->string('follow_up'))->values();
        }

        $recipient = (string) $request->string('recipient');

        return Inertia::render('ContactDirectory/Email/Compose', [
            'contact' => $contact,
            'recipient' => $contact->emailAddresses->contains(fn ($email): bool => strcasecmp($email->email_address, $recipient) === 0) ? $recipient : null,
            'tasks' => $tasks->map(fn (ContactFollowUp $task): array => [
                'uuid' => $task->uuid,
                'title' => $task->title,
                'description' => $task->description,
                'due_label' => $task->due_at?->format('M j, Y g:i A'),
            ])->all(),
            'inquiry' => $inquiry,
            'canSend' => $emailService->canSend($request->user()),
            'mailbox' => trim((string) $request->user()->microsoft_mailbox),
            'templates' => $renderer->availableFor($request->user(), [
                'contact_first_name' => $contact->first_name,
                'company_name' => $contact->company?->name,
                'inquiry_title' => $inquiry?->title,
                'project_name' => $inquiry?->project?->name,
            ]),
        ]);
    }

    public function send(SendContactEmailRequest $request, ContactDirectoryContact $contact, ContactEmailService $emailService): mixed
    {
        $validated = $request->validated();

        $inquiry = null;

        if (! empty($validated['inquiry_id'])) {
            $inquiry = ContactDirectoryInquiry::query()
                ->whereKey((int) $validated['inquiry_id'])
                ->firstOrFail();
        }

        try {
            $activity = $emailService->sendAndRecord(
                $request->user(),
                $contact,
                $inquiry,
                $validated['recipients'],
                $validated['subject'],
                $validated['body'],
            );
        } catch (RuntimeException $exception) {
            return back()->withErrors(['recipients' => $exception->getMessage()]);
        }

        if (! $activity->mail_delivered) {
            return back()->withErrors([
                'body' => 'The email provider did not accept the message. Nothing was recorded as sent.',
            ])->withInput();
        }

        // A reusable template is only created when the sender explicitly asked for it.
        if (! empty($validated['save_as_template'])) {
            EmailTemplate::create([
                'uuid' => (string) Str::uuid(),
                'name' => $validated['template_name'],
                'category' => 'general',
                'subject' => $validated['subject'],
                'body' => $validated['body'],
                'is_active' => true,
                'owner_id' => $request->user()->id,
                'visibility' => 'private',
                'is_system' => false,
            ]);
        }

        return redirect()
            ->route('contact-directory.contacts.show', [$contact, 'tab' => 'activity'])
            ->with('success', 'Email sent and recorded.');
    }

    public function logManual(LogContactEmailRequest $request, ContactDirectoryContact $contact, ContactEmailService $emailService): mixed
    {
        $validated = $request->validated();

        $inquiry = null;

        if (! empty($validated['inquiry_id'])) {
            $inquiry = ContactDirectoryInquiry::query()
                ->whereKey((int) $validated['inquiry_id'])
                ->firstOrFail();
        }

        $emailService->recordManual(
            $request->user(),
            $contact,
            $inquiry,
            $validated['recipients'],
            $validated['subject'],
            $validated['body'],
            $validated['direction'] ?? 'outgoing',
        );

        return redirect()
            ->route('contact-directory.contacts.show', [$contact, 'tab' => 'activity'])
            ->with('success', 'Email logged.');
    }
}
