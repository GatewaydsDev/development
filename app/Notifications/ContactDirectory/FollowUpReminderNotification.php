<?php

namespace App\Notifications\ContactDirectory;

use App\Models\ContactDirectory\ContactFollowUp;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class FollowUpReminderNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly ContactFollowUp $followUp,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];

        if (config('contact_directory.email_reminders', false)) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => $this->followUp->title,
            'due_at' => optional($this->followUp->due_at)->toIso8601String(),
            'priority' => $this->followUp->priority,
            'contact_name' => optional($this->followUp->contact)->fullName(),
            'inquiry_id' => optional($this->followUp->inquiry)->uuid,
            'inquiry_title' => optional($this->followUp->inquiry)->title,
            'follow_up_id' => $this->followUp->uuid,
            'reminder_kind' => 'follow_up',
        ];
    }

    public function toArray(object $notifiable): array
    {
        return $this->toDatabase($notifiable);
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject("Reminder: {$this->followUp->title}")
            ->line("Due: {$this->followUp->due_at->format('M j, Y g:i A')}")
            ->line($this->followUp->description ?? '')
            ->action('Open follow-up', route('contact-directory.follow-ups.show', $this->followUp));
    }
}
