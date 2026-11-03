<?php

namespace App\Services\ContactDirectory;

use App\Models\ContactDirectory\ContactActivity;
use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactDirectoryInquiry;
use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class ContactEmailService
{
    public function __construct(
        private readonly MicrosoftGraphMailService $mailService,
    ) {}

    /**
     * Send an outgoing email and record the actual content.
     *
     * @param  list<string>  $recipientEmails
     */
    public function sendAndRecord(
        User $actor,
        ContactDirectoryContact $contact,
        ?ContactDirectoryInquiry $inquiry,
        array $recipientEmails,
        string $subject,
        string $html,
        string $provider = 'microsoft_graph',
    ): ContactActivity {
        $recipients = array_values(array_unique(array_filter($recipientEmails)));

        if ($recipients === []) {
            throw new RuntimeException('At least one recipient is required.');
        }

        $sent = false;
        $providerMessageId = null;
        $failureReason = null;

        try {
            $mailbox = trim((string) config('services.microsoft.mail_from'));

            if ($mailbox === '') {
                throw new RuntimeException('Email sending is not configured. Log the email manually instead.');
            }

            $providerMessageId = (string) Str::uuid();
            $this->mailService->sendFromMailbox($mailbox, implode(',', $recipients), $subject, $html);
            $sent = true;
        } catch (\Throwable $exception) {
            $failureReason = $exception->getMessage();
        }

        return DB::transaction(function () use ($actor, $contact, $inquiry, $recipients, $subject, $html, $sent, $providerMessageId, $provider, $failureReason): ContactActivity {
            $activity = ContactActivity::create([
                'contact_id' => $contact->id,
                'inquiry_id' => $inquiry?->id,
                'activity_type' => 'email',
                'direction' => 'outgoing',
                'subject' => $subject,
                'content' => $html,
                'occurred_at' => now(),
                'created_by' => $actor->id,
                'mail_provider_message_id' => $providerMessageId,
                'mail_provider_status' => $sent ? 'provider_accepted' : 'failed',
                'mail_recipients' => $recipients,
                'mail_sender' => $actor->email,
                'mail_delivered' => $sent,
            ]);

            return $activity;
        });
    }

    public function recordManual(
        User $actor,
        ContactDirectoryContact $contact,
        ?ContactDirectoryInquiry $inquiry,
        array $recipientEmails,
        string $subject,
        string $content,
        string $direction = 'outgoing',
    ): ContactActivity {
        return ContactActivity::create([
            'contact_id' => $contact->id,
            'inquiry_id' => $inquiry?->id,
            'activity_type' => 'email',
            'direction' => $direction,
            'subject' => $subject,
            'content' => $content,
            'occurred_at' => now(),
            'created_by' => $actor->id,
            'mail_provider_status' => 'logged_manually',
            'mail_recipients' => array_values(array_unique(array_filter($recipientEmails))),
            'mail_sender' => $actor->email,
            'mail_delivered' => false,
        ]);
    }

    public function canSend(): bool
    {
        return trim((string) config('services.microsoft.mail_from')) !== '';
    }

    public function mailtoLink(array $recipientEmails, string $subject, string $body): string
    {
        $params = [
            'subject' => $subject,
            'body' => $body,
        ];

        $query = http_build_query($params);

        return 'mailto:' . implode(',', array_filter($recipientEmails)) . '?' . $query;
    }
}
