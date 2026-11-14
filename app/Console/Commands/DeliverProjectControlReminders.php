<?php

namespace App\Console\Commands;

use App\Support\ProjectControlReminderDelivery;
use Illuminate\Console\Command;

class DeliverProjectControlReminders extends Command
{
    protected $signature = 'project-control:deliver-reminders';

    protected $description = 'Send due project-control follow-up reminders';

    public function handle(ProjectControlReminderDelivery $delivery): int
    {
        $delivery->deliver();

        return self::SUCCESS;
    }
}
