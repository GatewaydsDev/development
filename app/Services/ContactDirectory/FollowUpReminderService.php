<?php

namespace App\Services\ContactDirectory;

use App\Models\ContactDirectory\ContactFollowUp;
use App\Models\User;

class FollowUpReminderService
{
    public function reminderDue(ContactFollowUp $followUp): bool
    {
        if ($followUp->status !== 'pending') {
            return false;
        }

        if ($followUp->reminder_at === null) {
            return false;
        }

        if ($followUp->snoozed_until !== null && $followUp->snoozed_until->isFuture()) {
            return false;
        }

        if ($followUp->reminder_last_notified_at !== null
            && $followUp->reminder_at->equalTo($followUp->reminder_last_notified_at)) {
            return false;
        }

        return $followUp->reminder_at->isPast() || $followUp->reminder_at->equalTo(now());
    }

    public function deliverReminder(ContactFollowUp $followUp): void
    {
        $assignedUser = $followUp->assignedUser;

        if (! $assignedUser) {
            return;
        }

        $assignedUser->notify(new \App\Notifications\ContactDirectory\FollowUpReminderNotification($followUp));

        $followUp->forceFill([
            'reminder_last_notified_at' => $followUp->reminder_at,
        ])->saveQuietly();
    }

    public function notifyDueReminders(): int
    {
        $delivered = 0;

        ContactFollowUp::query()
            ->where('status', 'pending')
            ->whereNotNull('reminder_at')
            ->with(['assignedUser'])
            ->chunkById(200, function ($followUps) use (&$delivered): void {
                foreach ($followUps as $followUp) {
                    if (! $this->reminderDue($followUp)) {
                        continue;
                    }

                    $this->deliverReminder($followUp);
                    $delivered++;
                }
            });

        return $delivered;
    }
}
