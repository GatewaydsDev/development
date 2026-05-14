<?php

namespace App\Http\Controllers;

use App\Mail\ContactSubmissionReceived;
use App\Models\Company;
use App\Models\ContactSubmission;
use App\Models\User;
use App\Notifications\NewContactSubmissionNotification;
use App\Services\TwilioSmsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Throwable;

class ContactSubmissionController extends Controller
{
    public function store(Request $request, TwilioSmsService $sms): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'organization' => ['nullable', 'string', 'max:255'],
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

        $this->notifyDashboardUsers($submission);
        $this->sendSmsNotification($submission, $sms);

        $recipient = $this->notificationRecipient();

        try {
            Mail::to($recipient)->send(new ContactSubmissionReceived($submission));

            $submission->forceFill([
                'emailed_at' => now(),
            ])->save();
        } catch (Throwable $exception) {
            report($exception);

            throw ValidationException::withMessages([
                'email' => 'There was an error sending your message. Please try again in a moment.',
            ]);
        }

        return back()->with([
            'contact.success' => true,
            'contact.status' => 'Your message has been sent to Gateway Door Systems.',
        ]);
    }

    private function notificationRecipient(): string
    {
        $companyEmail = Company::query()
            ->where('is_active', true)
            ->latest()
            ->value('email');

        if (is_string($companyEmail) && $companyEmail !== '') {
            return $companyEmail;
        }

        $configuredRecipient = config('contact.recipient');

        if (is_string($configuredRecipient) && $configuredRecipient !== '') {
            return $configuredRecipient;
        }

        return config('mail.from.address');
    }

    private function notifyDashboardUsers(ContactSubmission $submission): void
    {
        $users = User::query()
            ->with('level')
            ->get()
            ->filter(fn (User $user): bool => $user->hasPermission('manage-notifications'));

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

        $parts[] = 'Message: '.str($submission->message)->limit(160);

        return implode("\n", $parts);
    }
}
