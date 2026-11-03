<?php

namespace App\Services;

use App\Models\PushSubscription;
use App\Models\User;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Illuminate\Support\Facades\Log;
use Throwable;

class WebPushSender
{
    public function configured(): bool
    {
        return filled(config('webpush.public_key')) && filled(config('webpush.private_key'));
    }

    /** @return int number of devices the message was accepted for */
    public function sendToUser(User $user, string $title, string $body, string $url): int
    {
        if (! $this->configured()) {
            return 0;
        }

        $subscriptions = PushSubscription::query()->where('user_id', $user->id)->get();

        if ($subscriptions->isEmpty()) {
            return 0;
        }

        $push = $this->client();
        $payload = json_encode(['title' => $title, 'body' => $body, 'url' => $url, 'tag' => md5($title.$url)]);

        foreach ($subscriptions as $subscription) {
            $push->queueNotification(Subscription::create([
                'endpoint' => $subscription->endpoint,
                'publicKey' => $subscription->public_key,
                'authToken' => $subscription->auth_token,
                'contentEncoding' => $subscription->content_encoding,
            ]), $payload);
        }

        $delivered = 0;

        try {
            foreach ($push->flush() as $report) {
                if ($report->isSuccess()) {
                    $delivered++;

                    continue;
                }

                Log::warning('Web push was not delivered.', ['status' => $report->getResponse()?->getStatusCode(), 'reason' => $report->getReason()]);

                // Gone/not-found subscriptions will never work again.
                if ($report->isSubscriptionExpired()) {
                    PushSubscription::query()->where('endpoint_hash', hash('sha256', $report->getEndpoint()))->delete();
                }
            }
        } catch (Throwable $exception) {
            report($exception);
        }

        return $delivered;
    }

    protected function client(): WebPush
    {
        return new WebPush(['VAPID' => [
            'subject' => config('webpush.subject'),
            'publicKey' => config('webpush.public_key'),
            'privateKey' => config('webpush.private_key'),
        ]]);
    }
}
