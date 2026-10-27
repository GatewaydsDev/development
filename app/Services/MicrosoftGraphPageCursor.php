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

        if (! is_array($parts)) {
            throw new MicrosoftGraphException('The mail page address is not a Microsoft Graph mailbox link.');
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $port = $parts['port'] ?? null;
        $path = (string) ($parts['path'] ?? '');
        $decoded = rawurldecode($path);

        if (
            $scheme !== 'https'
            || $host !== 'graph.microsoft.com'
            || isset($parts['user'])
            || ($port !== null && (int) $port !== 443)
        ) {
            throw new MicrosoftGraphException('The mail page address is not a Microsoft Graph mailbox link.');
        }

        if ($decoded === '' || str_contains($path, '..') || str_contains($decoded, '..') || str_contains($decoded, '\\')) {
            throw new MicrosoftGraphException('The mail page address does not match this mailbox folder.');
        }

        $normalized = strtolower($decoded);
        $normalized = preg_replace("#/users\\('([^']*)'\\)#", '/users/$1', $normalized) ?? $normalized;
        $normalized = preg_replace("#/mailfolders\\('([^']*)'\\)#", '/mailfolders/$1', $normalized) ?? $normalized;

        if (! preg_match('#/users/([^/]+)/mailfolders/(.+)/messages/?$#', $normalized, $matches)) {
            throw new MicrosoftGraphException('The mail page address does not match this mailbox folder.');
        }

        $graphFolder = match ($folder) {
            'sent' => 'sentitems',
            'archive' => 'archive',
            default => 'inbox',
        };
        $folderSegments = array_values(array_filter(explode('/', $matches[2]), fn (string $segment): bool => $segment !== ''));
        $knownFolders = [
            'archive',
            'clutter',
            'conflicts',
            'conversationhistory',
            'deleteditems',
            'drafts',
            'inbox',
            'junkemail',
            'outbox',
            'scheduled',
            'sentitems',
            'syncissues',
        ];

        if ($matches[1] !== strtolower($mailbox) || $folderSegments === []) {
            throw new MicrosoftGraphException('The mail page address does not match this mailbox folder.');
        }

        foreach ($folderSegments as $segment) {
            if (in_array($segment, $knownFolders, true) && $segment !== $graphFolder) {
                throw new MicrosoftGraphException('The mail page address does not match this mailbox folder.');
            }
        }
    }

    private function key(string $token): string
    {
        return 'microsoft-graph-page:'.hash('sha256', $token);
    }
}
