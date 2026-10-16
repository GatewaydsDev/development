<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Storage;

class MailboxComposition
{
    /**
     * @param  list<array{name: string, contentType: string, bytes: string, inline?: bool, contentId?: string}>  $attachments
     * @return array{content: string, type: string, attachments: list<array{name: string, contentType: string, bytes: string, inline?: bool, contentId?: string}>}
     */
    public function apply(User $user, string $content, string $type, array $attachments): array
    {
        $header = $this->header($user);
        $signature = $this->signature($user);

        if ($header === null && $signature === null) {
            return [
                'content' => $content,
                'type' => $type,
                'attachments' => $attachments,
            ];
        }

        $body = strcasecmp($type, 'HTML') === 0
            ? $content
            : nl2br(e($content));

        $html = ($header['html'] ?? '').'<div>'.$body.'</div>'.($signature ?? '');

        if ($header !== null) {
            $attachments[] = $header['file'];
        }

        return [
            'content' => $html,
            'type' => 'HTML',
            'attachments' => $attachments,
        ];
    }

    /**
     * @return array{html: string, file: array{name: string, contentType: string, bytes: string, inline: bool, contentId: string}}|null
     */
    private function header(User $user): ?array
    {
        $path = $user->mail_header_path;

        if (! is_string($path) || $path === '') {
            return null;
        }

        $disk = Storage::disk('public');

        if (! $disk->exists($path)) {
            return null;
        }

        $bytes = $disk->get($path);

        if (! is_string($bytes) || $bytes === '') {
            return null;
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $extension = in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true) ? $extension : 'png';
        $mime = match ($extension) {
            'jpg', 'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            default => 'image/png',
        };

        return [
            'html' => '<p><img src="cid:gateway-mail-header" alt="" style="max-width:100%;height:auto;"></p>',
            'file' => [
                'name' => 'header.'.$extension,
                'contentType' => $mime,
                'bytes' => $bytes,
                'inline' => true,
                'contentId' => 'gateway-mail-header',
            ],
        ];
    }

    private function signature(User $user): ?string
    {
        $signature = trim((string) $user->mail_signature);

        if ($signature === '') {
            return null;
        }

        return '<div style="margin-top:16px">'.nl2br(e($signature)).'</div>';
    }
}
