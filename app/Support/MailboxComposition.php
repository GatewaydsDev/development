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
        $footer = $this->footer($user);

        if ($header === null && $signature === null && $footer === null) {
            return [
                'content' => $content,
                'type' => $type,
                'attachments' => $attachments,
            ];
        }

        $body = strcasecmp($type, 'HTML') === 0
            ? $content
            : nl2br(e($content));

        $html = ($header['html'] ?? '').'<div>'.$body.'</div>'.($signature ?? '').($footer ?? '');

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

        $pixels = (int) round(600 * $user->mailHeaderWidth() / 100);

        return [
            'html' => '<p style="margin:0 0 16px;"><img src="cid:gateway-mail-header" alt="Gateway Door Systems" width="'.$pixels.'" style="display:block;width:'.$pixels.'px;max-width:100%;height:auto;border:0;"></p>',
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

    private function footer(User $user): ?string
    {
        $colors = $user->mailFooterColors();

        if ($colors === []) {
            return null;
        }

        $cells = '';

        foreach ($colors as $color) {
            $cells .= '<td width="36" height="8" bgcolor="'.$color.'" style="width:36px;height:8px;background:'.$color.';line-height:8px;padding-right:6px;">&nbsp;</td>';
        }

        return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;"><tr>'.$cells.'</tr></table>';
    }
}
