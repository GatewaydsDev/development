<?php

namespace App\Http\Controllers;

use App\Mail\ContactSubmissionReceived;
use App\Models\Company;
use App\Models\ContactSubmission;
use App\Models\User;
use App\Notifications\NewContactSubmissionNotification;
use App\Services\MicrosoftGraphMailService;
use App\Services\TwilioSmsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Throwable;

class ContactSubmissionController extends Controller
{
    public function store(
        Request $request,
        TwilioSmsService $sms,
        MicrosoftGraphMailService $mail,
    ): RedirectResponse {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'organization' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'in:NJ,NY,PA'],
            'country' => ['nullable', 'string', 'in:US'],
            'project_type' => ['nullable', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:5000'],
            'source_url' => ['nullable', 'url', 'max:2048'],
            'website' => ['nullable', 'prohibited'],
        ]);

        unset($validated['website']);

        $submission = ContactSubmission::create([
            ...$validated,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $recipient = $this->notificationRecipient();

        try {
            $this->deliverToSales($mail, $submission, $recipient);

            $submission->forceFill([
                'emailed_at' => now(),
            ])->save();
        } catch (Throwable $exception) {
            report($exception);

            throw ValidationException::withMessages([
                'email' => 'There was an error sending your message. Please try again in a moment.',
            ]);
        }

        try {
            $this->notifyDashboardUsers($submission);
            $this->sendSmsNotification($submission, $sms);
        } catch (Throwable $exception) {
            report($exception);
        }

        return back()->with([
            'contact.success' => true,
            'contact.status' => 'Your message has been sent to Gateway Door Systems.',
        ]);
    }

    private function deliverToSales(
        MicrosoftGraphMailService $mail,
        ContactSubmission $submission,
        string $recipient,
    ): void {
        try {
            Mail::to($recipient)->send(new ContactSubmissionReceived($submission));

            return;
        } catch (Throwable $exception) {
            report($exception);
        }

        $message = new ContactSubmissionReceived($submission);

        $mail->send(
            $recipient,
            (string) $message->envelope()->subject,
            $message->render(),
            $submission->email,
        );
    }

    private function notificationRecipient(): string
    {
        foreach ([
            config('contact.recipient'),
            config('services.microsoft.mail_from'),
        ] as $address) {
            $sales = $this->mailbox($address);

            if ($sales !== null) {
                return $sales;
            }
        }

        $companyEmail = $this->mailbox(
            Company::query()
                ->where('is_active', true)
                ->latest()
                ->value('email')
        );

        if ($companyEmail !== null) {
            return $companyEmail;
        }

        return (string) config('mail.from.address');
    }

    private function mailbox(mixed $address): ?string
    {
        if (! is_string($address)) {
            return null;
        }

        $address = strtolower(trim($address));

        if (filter_var($address, FILTER_VALIDATE_EMAIL) === false) {
            return null;
        }

        return $address;
    }

    private function notifyDashboardUsers(ContactSubmission $submission): void
    {
        $recipient = strtolower(trim($this->notificationRecipient()));

        if ($recipient === '') {
            return;
        }

        $users = User::query()
            ->with('level')
            ->get()
            ->filter(function (User $user) use ($recipient): bool {
                return strtolower(trim((string) $user->microsoft_mailbox)) === $recipient
                    && $user->hasPermission('manage-notifications');
            });

        if ($users->isEmpty()) {
            return;
        }

        Notification::send($users, new NewContactSubmissionNotification($submission));
    }

    private function sendSmsNotification(ContactSubmission $submission, TwilioSmsService $sms): void
    {
        $recipient = config('services.twilio.to');

        if (! is_string($recipient) || $recipient === '') {
            return;
        }

        try {
            $sms->send($recipient, $this->smsMessage($submission));
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function smsMessage(ContactSubmission $submission): string
    {
        $parts = [
            'New Gateway contact form submission.',
            "Name: {$submission->name}",
            "Email: {$submission->email}",
        ];

        if (is_string($submission->phone_number) && $submission->phone_number !== '') {
            $parts[] = "Phone: {$submission->phone_number}";
        }

        if (is_string($submission->organization) && $submission->organization !== '') {
            $parts[] = "Organization: {$submission->organization}";
        }

        $location = collect([$submission->address, $submission->state, $submission->country])
            ->filter(fn ($value): bool => is_string($value) && $value !== '')
            ->implode(', ');

        if ($location !== '') {
            $parts[] = "Location: {$location}";
        }

        $parts[] = 'Message: '.str($submission->message)->limit(160);

        return implode("\n", $parts);
    }
}
