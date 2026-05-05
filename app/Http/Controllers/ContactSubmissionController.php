<?php

namespace App\Http\Controllers;

use App\Mail\ContactSubmissionReceived;
use App\Models\Company;
use App\Models\ContactSubmission;
use App\Models\User;
use App\Notifications\NewContactSubmissionNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Throwable;

class ContactSubmissionController extends Controller
{
    public function store(Request $request): RedirectResponse
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

        $recipient = $this->notificationRecipient();

        try {
            Mail::to($recipient)->send(new ContactSubmissionReceived($submission));

            $submission->forceFill([
                'emailed_at' => now(),
            ])->save();
        } catch (Throwable $exception) {
            report($exception);
        }

        return back()->with('contact.success', true);
    }

    private function notificationRecipient(): string
    {
        $configuredRecipient = config('contact.recipient');

        if (is_string($configuredRecipient) && $configuredRecipient !== '') {
            return $configuredRecipient;
        }

        $companyEmail = Company::query()
            ->where('is_active', true)
            ->latest()
            ->value('email');

        if (is_string($companyEmail) && $companyEmail !== '') {
            return $companyEmail;
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
}
