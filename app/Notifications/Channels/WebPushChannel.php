<?php

namespace App\Notifications\Channels;

use App\Services\WebPushSender;
use Illuminate\Notifications\Notification;

class WebPushChannel
{
    public function __construct(private readonly WebPushSender $sender) {}

    public function send(object $notifiable, Notification $notification): void
    {
        $message = $notification->toWebPush($notifiable);

        $this->sender->sendToUser($notifiable, $message['title'], $message['body'], $message['url']);
    }
}
