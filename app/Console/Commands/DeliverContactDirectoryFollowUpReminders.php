<?php

namespace App\Console\Commands;

use App\Services\ContactDirectory\FollowUpReminderService;
use Illuminate\Console\Command;

class DeliverContactDirectoryFollowUpReminders extends Command
{
    protected $signature = 'contact-directory:deliver-follow-up-reminders';

    protected $description = 'Send due in-app and email reminders for contact follow-up tasks.';

    public function handle(FollowUpReminderService $reminders): int
    {
        $delivered = $reminders->notifyDueReminders();

        $this->info("Delivered {$delivered} follow-up reminders.");

        return self::SUCCESS;
    }
}
