<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\ContactEmailAddress;
use App\Models\ContactDirectory\ContactDirectoryContact;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LogContactEmailRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('log-communications');
    }

    public function rules(): array
    {
        return [
            'inquiry_id' => ['nullable', 'integer', Rule::exists('contact_directory_inquiries', 'id')],
            'recipients' => ['required', 'array', 'min:1', 'max:10'],
            'recipients.*' => ['required', 'string', 'email:filter'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $contact = $this->route('contact');

            $contactEmails = $contact
                ? ContactEmailAddress::query()
                    ->where('contact_id', $contact->id)
                    ->pluck('email_address')
                    ->map(fn (string $email): string => strtolower(trim($email)))
                    ->all()
                : [];

            foreach ((array) $this->input('recipients', []) as $index => $email) {
                if ($email && ! in_array(strtolower(trim($email)), $contactEmails, true)) {
                    $validator->errors()->add(
                        "recipients.{$index}",
                        'Recipients must be one of this contact\'s saved email addresses.'
                    );
                }
            }

            if ($this->isDuplicateSend()) {
                $validator->errors()->add(
                    'body',
                    'This email appears to have already been sent. Review it before sending again.'
                );
            }
        });
    }

    private function isDuplicateSend(): bool
    {
        $contact = $this->route('contact');

        if (! $contact) {
            return false;
        }

        $subject = trim((string) $this->input('subject', ''));

        if ($subject === '') {
            return false;
        }

        $recipients = collect($this->input('recipients', []))
            ->map(fn (string $email): string => strtolower(trim($email)))
            ->sort()
            ->values()
            ->all();

        $recent = $contact->activities()
            ->where('activity_type', 'email')
            ->where('direction', 'outgoing')
            ->where('mail_delivered', true)
            ->where('subject', $subject)
            ->where('occurred_at', '>=', now()->subMinutes(5))
            ->latest('occurred_at')
            ->get();

        foreach ($recent as $activity) {
            $previous = collect($activity->mail_recipients ?? [])
                ->map(fn (string $email): string => strtolower(trim($email)))
                ->sort()
                ->values()
                ->all();

            if ($previous === $recipients) {
                return true;
            }
        }

        return false;
    }
}
