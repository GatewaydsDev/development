<?php

namespace App\Console\Commands;

use App\Support\NewMailPush;
use Illuminate\Console\Command;

class DeliverNewMailNotifications extends Command
{
    protected $signature = 'mail:deliver-notifications';

    protected $description = 'Send push notifications for new unread inbox mail.';

    public function handle(NewMailPush $mail): int
    {
        $this->info('Sent '.$mail->deliver().' new mail notifications.');

        return self::SUCCESS;
    }
}
