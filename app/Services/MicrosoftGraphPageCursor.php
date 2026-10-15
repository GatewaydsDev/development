<?php

namespace App\Services;

use App\Exceptions\MicrosoftGraphException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class MicrosoftGraphPageCursor
{
    public function store(int $userId, string $mailbox, string $folder, ?string $nextLink): ?string
    {
        if ($nextLink === null || $nextLink === '') {
            return null;
        }

        $this->assertLink($nextLink, $mailbox, $folder);

        $token = Str::random(40);
        Cache::put($this->key($token), [
            'user_id' => $userId,
            'mailbox' => strtolower($mailbox),
            'folder' => $folder,
            'url' => $nextLink,
        ], now()->addMinutes(20));

        return $token;
    }

    public function resolve(int $userId, string $mailbox, string $folder, string $token): string
    {
        $payload = Cache::get($this->key($token));

        if (
            ! is_array($payload)
            || ($payload['user_id'] ?? null) !== $userId
            || ($payload['mailbox'] ?? null) !== strtolower($mailbox)
            || ($payload['folder'] ?? null) !== $folder
            || ! is_string($payload['url'] ?? null)
        ) {
            throw new MicrosoftGraphException('That mail page is no longer available. Refresh the folder and try again.');
        }

        $this->assertLink($payload['url'], $mailbox, $folder);

        return $payload['url'];
    }

    public function assertLink(string $url, string $mailbox, string $folder): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $path = rawurldecode((string) ($parts['path'] ?? ''));
        $graphFolder = $folder === 'sent' ? 'sentitems' : 'inbox';
        $expected = '/users/'.strtolower($mailbox).'/mailfolders/'.$graphFolder.'/messages';

        if ($scheme !== 'https' || $host !== 'graph.microsoft.com') {
            throw new MicrosoftGraphException('The mail page address is not a Microsoft Graph mailbox link.');
        }

        if (! str_contains(strtolower($path), $expected) || str_contains($path, '..')) {
            throw new MicrosoftGraphException('The mail page address does not match this mailbox folder.');
        }
    }

    private function key(string $token): string
    {
        return 'microsoft-graph-page:'.hash('sha256', $token);
    }
}
