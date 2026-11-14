<?php

namespace App\Support;

use App\Exceptions\MicrosoftGraphException;
use App\Models\PushSubscription;
use App\Models\User;
use App\Services\MailboxStateService;
use App\Services\MicrosoftGraphMailService;
use App\Services\WebPushSender;
use Illuminate\Support\Facades\Cache;

/**
 * Pushes a phone/desktop notification for new inbox mail, even when the app is closed.
 */
class NewMailPush
{
    private const SEEN_LIMIT = 100;

    public function __construct(
        private readonly MicrosoftGraphMailService $graph,
        private readonly MailboxStateService $states,
        private readonly WebPushSender $push,
    ) {}

    /** @return int notifications sent */
    public function deliver(): int
    {
        if (! $this->push->configured()) {
            return 0;
        }

        $sent = 0;
        $userIds = PushSubscription::query()->distinct()->pluck('user_id');

        foreach (User::query()->whereIn('id', $userIds)->whereNotNull('microsoft_mailbox')->get() as $user) {
            $sent += $this->deliverFor($user);
        }

        return $sent;
    }

    private function deliverFor(User $user): int
    {
        $mailbox = strtolower(trim((string) $user->microsoft_mailbox));

        if ($mailbox === '') {
            return 0;
        }

        try {
            $messages = $this->states->dropCleared($user, $mailbox, $this->graph->actingAs($user)->recentUnread($mailbox));
        } catch (MicrosoftGraphException $exception) {
            report($exception);

            return 0;
        }

        $key = "new-mail-push:{$user->id}:{$mailbox}";
        $seen = Cache::get($key);
        $ids = array_column($messages, 'id');

        // The first run only records what is already there, so old mail does not buzz the phone.
        if (! is_array($seen)) {
            Cache::put($key, $ids, now()->addDays(30));

            return 0;
        }

        $fresh = array_values(array_filter($messages, fn (array $message): bool => ! in_array($message['id'], $seen, true)));
        $sent = 0;

        foreach (array_slice($fresh, 0, 3) as $message) {
            $subject = $message['subject'] !== '' ? $message['subject'] : '(no subject)';
            $body = $message['from'] !== '' ? "{$message['from']} — {$subject}" : $subject;
            $url = route('mailbox.index', ['folder' => 'inbox', 'message' => $message['id']], false);

            $sent += $this->push->sendToUser($user, 'New email', $body, $url) > 0 ? 1 : 0;
        }

        Cache::put($key, array_slice(array_unique([...$ids, ...$seen]), 0, self::SEEN_LIMIT), now()->addDays(30));

        return $sent;
    }
}
