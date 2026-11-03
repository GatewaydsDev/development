<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Http\Requests\ContactDirectory\SendContactEmailRequest;
use App\Http\Requests\ContactDirectory\LogContactEmailRequest;
use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactDirectoryInquiry;
use App\Services\ContactDirectory\ContactEmailService;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class ContactEmailController extends Controller
{
    public function compose(Request $request, ContactDirectoryContact $contact, ContactEmailService $emailService): Response
    {
        $inquiry = null;

        if ($request->filled('inquiry')) {
            $inquiry = $contact->inquiries()->where('uuid', (string) $request->string('inquiry'))->firstOrFail();
        }

        $contact->load(['emailAddresses', 'phoneNumbers']);

        return Inertia::render('ContactDirectory/Email/Compose', [
            'contact' => $contact,
            'inquiry' => $inquiry,
            'canSend' => $emailService->canSend(),
            'mailbox' => trim((string) config('services.microsoft.mail_from')),
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
