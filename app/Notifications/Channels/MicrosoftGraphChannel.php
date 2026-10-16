<?php

namespace App\Notifications\Channels;

use App\Services\MicrosoftGraphMailService;
use Illuminate\Notifications\Notification;

class MicrosoftGraphChannel
{
    public function __construct(private MicrosoftGraphMailService $graph) {}

    public function send(mixed $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toMicrosoftGraph')) {
            return;
        }

        $message = $notification->toMicrosoftGraph($notifiable);

        $this->graph->sendFromMailbox(
            (string) ($message['mailbox'] ?? ''),
            (string) ($message['to'] ?? ''),
            (string) ($message['subject'] ?? ''),
            (string) ($message['html'] ?? ''),
            (string) ($message['fromName'] ?? 'Gateway Door Systems'),
        );
    }
}
