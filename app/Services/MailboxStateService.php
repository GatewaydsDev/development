<?php

namespace App\Services;

use App\Exceptions\MicrosoftGraphException;
use App\Models\MailMessageState;
use App\Models\User;
use App\Support\EmailPlainText;
use Illuminate\Support\Carbon;

class MailboxStateService
{
    public function markRead(
        User $user,
        string $mailbox,
        string $messageId,
        bool $isRead,
        MicrosoftGraphMailService $graph,
        ?array $summary = null,
    ): void {
        $synced = $this->tryGraph(fn () => $graph->setRead($mailbox, $messageId, $isRead));
        $current = $this->find($user, $mailbox, $messageId);
        $counts = $current?->counts_in_graph_unread;

        if (is_array($summary) && array_key_exists('is_read', $summary)) {
            $counts = ! (bool) $summary['is_read'];
        }

        if ($synced) {
            $counts = ! $isRead;
        }

        $this->save($user, $mailbox, $messageId, $summary, [
            'is_read' => $isRead,
            'counts_in_graph_unread' => $counts,
        ]);
    }

    public function archive(
        User $user,
        string $mailbox,
        string $messageId,
        MicrosoftGraphMailService $graph,
        ?array $summary = null,
        bool $archived = true,
    ): void {
        $destination = $archived ? 'archive' : 'inbox';
        $synced = $this->tryGraph(fn () => $graph->moveMessage($mailbox, $messageId, $destination));
        $current = $this->find($user, $mailbox, $messageId);
        $counts = $current?->counts_in_graph_unread;

        if (is_array($summary) && array_key_exists('is_read', $summary)) {
            $counts = ! (bool) $summary['is_read'];
        }

        if ($synced) {
            $counts = false;
        }

        $this->save($user, $mailbox, $messageId, $summary, [
            'is_archived' => $archived,
            'is_read' => $current?->is_read ?? ($summary['is_read'] ?? true),
            'counts_in_graph_unread' => $counts,
        ]);
    }

    public function unreadCount(User $user, string $mailbox, int $graphUnread): int
    {
        $suppress = MailMessageState::query()
            ->where('user_id', $user->id)
            ->where('mailbox', $mailbox)
            ->where(function ($query): void {
                $query->where('is_read', true)->orWhere('is_archived', true);
            })
            ->where(function ($query): void {
                $query->where('counts_in_graph_unread', true)
                    ->orWhereNull('counts_in_graph_unread');
            })
            ->count();

        $force = MailMessageState::query()
            ->where('user_id', $user->id)
            ->where('mailbox', $mailbox)
            ->where('is_read', false)
            ->where('is_archived', false)
            ->where('counts_in_graph_unread', false)
            ->count();

        return max(0, $graphUnread - $suppress) + $force;
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @return list<array<string, mixed>>
     */
    public function applyToList(User $user, string $mailbox, string $folder, array $messages): array
    {
        $states = $this->statesFor($user, $mailbox, $messages);
        $visible = [];

        foreach ($messages as $message) {
            if (! is_array($message)) {
                continue;
            }

            $token = (string) ($message['id'] ?? '');
            $messageId = EmailPlainText::decodeMessageId($token);
            $state = $messageId === null ? null : ($states[$this->key($messageId)] ?? null);

            if ($state instanceof MailMessageState && $folder === 'inbox') {
                $graphUnread = ! (bool) ($message['is_read'] ?? false);

                if (! $graphUnread && $this->countsInGraphUnread($state) !== false) {
                    $state->counts_in_graph_unread = false;
                    $state->save();
                }

                if ($state->is_archived) {
                    continue;
                }
            }

            if ($state instanceof MailMessageState && $folder === 'archive') {
                $state->counts_in_graph_unread = false;
                $state->save();
            }

            if ($state instanceof MailMessageState) {
                $message['is_read'] = $state->is_read;
            }

            $visible[] = $message;
        }

        if ($folder !== 'archive') {
            return $visible;
        }

        $present = [];

        foreach ($visible as $message) {
            $messageId = EmailPlainText::decodeMessageId((string) ($message['id'] ?? ''));

            if ($messageId !== null) {
                $present[$this->key($messageId)] = true;
            }
        }

        $locals = MailMessageState::query()
            ->where('user_id', $user->id)
            ->where('mailbox', $mailbox)
            ->where('is_archived', true)
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->get();

        foreach ($locals as $state) {
            if (isset($present[$state->message_key])) {
                continue;
            }

            $visible[] = [
                'id' => EmailPlainText::encodeMessageId($state->message_id),
                'subject' => (string) ($state->subject ?? ''),
                'from' => (string) ($state->sender ?? ''),
                'to' => [],
                'preview' => (string) ($state->preview ?? ''),
                'received_at' => $state->received_at?->toIso8601String(),
                'sent_at' => null,
                'is_read' => $state->is_read,
                'folder' => 'archive',
            ];
        }

        return $visible;
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     */
    public function summaryFor(array $messages, string $token): ?array
    {
        foreach ($messages as $message) {
            if (is_array($message) && ($message['id'] ?? null) === $token) {
                return $message;
            }
        }

        return null;
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @return array<string, MailMessageState>
     */
    private function statesFor(User $user, string $mailbox, array $messages): array
    {
        $keys = [];

        foreach ($messages as $message) {
            if (! is_array($message)) {
                continue;
            }

            $messageId = EmailPlainText::decodeMessageId((string) ($message['id'] ?? ''));

            if ($messageId !== null) {
                $keys[] = $this->key($messageId);
            }
        }

        if ($keys === []) {
            return [];
        }

        return MailMessageState::query()
            ->where('user_id', $user->id)
            ->where('mailbox', $mailbox)
            ->whereIn('message_key', $keys)
            ->get()
            ->keyBy('message_key')
            ->all();
    }

    private function find(User $user, string $mailbox, string $messageId): ?MailMessageState
    {
        return MailMessageState::query()
            ->where('user_id', $user->id)
            ->where('mailbox', $mailbox)
            ->where('message_key', $this->key($messageId))
            ->first();
    }

    /**
     * @param  array<string, mixed>|null  $summary
     * @param  array<string, mixed>  $changes
     */
    private function save(User $user, string $mailbox, string $messageId, ?array $summary, array $changes): void
    {
        $values = [
            'message_id' => $messageId,
            'is_read' => (bool) ($changes['is_read'] ?? false),
            'counts_in_graph_unread' => $changes['counts_in_graph_unread'] ?? null,
        ];

        if (array_key_exists('is_archived', $changes)) {
            $values['is_archived'] = (bool) $changes['is_archived'];
        }

        if (is_array($summary)) {
            $values['subject'] = $this->short($summary['subject'] ?? null, 255);
            $values['sender'] = $this->short($summary['from'] ?? null, 255);
            $values['preview'] = $this->short($summary['preview'] ?? null, 2000);
            $values['received_at'] = $this->moment($summary['received_at'] ?? null);
        }

        MailMessageState::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'mailbox' => $mailbox,
                'message_key' => $this->key($messageId),
            ],
            $values,
        );
    }

    private function countsInGraphUnread(MailMessageState $state): ?bool
    {
        $value = $state->getAttributes()['counts_in_graph_unread'] ?? null;

        if ($value === null) {
            return null;
        }

        return (bool) $value;
    }

    private function tryGraph(callable $call): bool
    {
        try {
            $call();

            return true;
        } catch (MicrosoftGraphException) {
            return false;
        }
    }

    private function key(string $messageId): string
    {
        return hash('sha256', $messageId);
    }

    private function short(mixed $value, int $limit): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        if ($value === '') {
            return null;
        }

        return mb_substr($value, 0, $limit);
    }

    private function moment(mixed $value): ?Carbon
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
