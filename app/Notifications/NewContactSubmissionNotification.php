<?php

namespace App\Notifications;

use App\Models\ContactSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewContactSubmissionNotification extends Notification
{
    use Queueable;

    public function __construct(
        public ContactSubmission $submission
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'contact_submission_id' => $this->submission->id,
            'title' => 'New contact request',
            'name' => $this->submission->name,
            'email' => $this->submission->email,
            'phone_number' => $this->submission->phone_number,
            'organization' => $this->submission->organization,
            'address' => $this->submission->address,
            'state' => $this->submission->state,
            'country' => $this->submission->country,
            'project_type' => $this->submission->project_type,
            'message' => $this->submission->message,
            'submitted_at' => $this->submission->created_at?->toISOString(),
        ];
    }
}
