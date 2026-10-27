<?php

namespace App\Support;

use App\Models\User;

class MailStationery
{
    /**
     * @return array{
     *     header: string,
     *     footer: string,
     *     signatures: list<array{id: string, name: string, html: string}>,
     *     newSignatureId: string|null,
     *     replySignatureId: string|null
     * }
     */
    public function payload(?User $user): array
    {
        if (! $user instanceof User) {
            return $this->withLogo($this->emptyPayload());
        }

        $stored = $user->mail_stationery;

        if (is_array($stored) && isset($stored['signatures']) && is_array($stored['signatures'])) {
            return $this->withLogo($this->normalize($stored, $user));
        }

        return $this->withLogo($this->fromLegacy($user));
    }

    public function logoUrl(): string
    {
        return asset('images/Gateway_Door_Systems_Logo.png');
    }

    public function logoMarkup(): string
    {
        return '<img src="'.e($this->logoUrl()).'" alt="Gateway Door Systems" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;background:#050505;">';
    }

    /**
     * @param  list<array{name: string, contentType: string, bytes: string, inline?: bool, contentId?: string}>  $attachments
     * @return array{content: string, type: string, attachments: list<array{name: string, contentType: string, bytes: string, inline?: bool, contentId?: string}>}
     */
    public function compose(User $user, string $content, string $type, array $attachments): array
    {
        if ($this->alreadyPlaced($content)) {
            return [
                'content' => $content,
                'type' => $this->htmlType($content, $type),
                'attachments' => $attachments,
            ];
        }

        $stationery = $this->payload($user);
        $header = $this->section('header', $stationery['header']);
        $signature = $this->section('signature', $this->chosenHtml($stationery, 'new'));
        $footer = $this->section('footer', $stationery['footer']);

        if ($header === '' && $signature === '' && $footer === '') {
            return [
                'content' => $content,
                'type' => $type,
                'attachments' => $attachments,
            ];
        }

        $body = strcasecmp($type, 'HTML') === 0
            ? $content
            : nl2br(e($content));

        return [
            'content' => '<div data-gateway-mail="letter">'.$header.$body.$signature.$footer.'</div>',
            'type' => 'HTML',
            'attachments' => $attachments,
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{
     *     header: string,
     *     footer: string,
     *     signatures: list<array{id: string, name: string, html: string}>,
     *     new_signature_id: string|null,
     *     reply_signature_id: string|null
     * }
     */
    public function store(array $input): array
    {
        $signatures = [];

        foreach ($input['signatures'] as $signature) {
            if (! is_array($signature)) {
                continue;
            }

            $id = $this->identifier((string) ($signature['id'] ?? ''));
            $name = trim(strip_tags((string) ($signature['name'] ?? '')));

            if ($id === '' || $name === '') {
                continue;
            }

            $signatures[] = [
                'id' => $id,
                'name' => mb_substr($name, 0, 80),
                'html' => $this->clean((string) ($signature['html'] ?? '')),
            ];
        }

        $ids = array_column($signatures, 'id');
        $newId = $this->identifier((string) ($input['new_signature_id'] ?? ''));
        $replyId = $this->identifier((string) ($input['reply_signature_id'] ?? ''));

        return [
            'header' => $this->clean((string) ($input['header'] ?? '')),
            'footer' => $this->clean((string) ($input['footer'] ?? '')),
            'signatures' => $signatures,
            'new_signature_id' => in_array($newId, $ids, true) ? $newId : ($ids[0] ?? null),
            'reply_signature_id' => in_array($replyId, $ids, true) ? $replyId : ($ids[0] ?? null),
        ];
    }

    public function clean(string $html): string
    {
        $html = trim($html);
        $html = preg_replace('#<script\b[^>]*>.*?</script>#is', '', $html) ?? $html;
        $html = preg_replace_callback('#<img\b[^>]*>#i', function (array $match): string {
            if (preg_match('/\bsrc\s*=\s*(["\'])(.*?)\1/i', $match[0], $src) !== 1) {
                return '';
            }

            return $this->isCompanyLogo($src[2]) ? $this->logoMarkup() : '';
        }, $html) ?? $html;
        $html = preg_replace('#\s+on[a-z]+\s*=\s*([\'"]).*?\1#i', '', $html) ?? $html;
        $html = preg_replace('#javascript:#i', '', $html) ?? $html;

        return trim($html);
    }

    private function isCompanyLogo(string $src): bool
    {
        $src = trim(html_entity_decode($src, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $lower = strtolower($src);

        if ($src === '' || str_contains($src, '..') || str_starts_with($lower, 'javascript:') || str_starts_with($lower, 'data:') || str_starts_with($lower, 'cid:')) {
            return false;
        }

        $path = rawurldecode((string) (parse_url($src, PHP_URL_PATH) ?? ''));

        if ($path === '' && str_starts_with($src, '/images/Gateway_Door_Systems_Logo.png')) {
            $path = '/images/Gateway_Door_Systems_Logo.png';
        }

        if ($path !== '/images/Gateway_Door_Systems_Logo.png') {
            return false;
        }

        $host = strtolower((string) (parse_url($src, PHP_URL_HOST) ?? ''));

        if ($host === '') {
            return str_starts_with($src, '/');
        }

        $appHost = strtolower((string) (parse_url((string) config('app.url'), PHP_URL_HOST) ?? ''));

        return $appHost !== '' && $host === $appHost;
    }

    /**
     * @param  array<string, mixed>  $stationery
     * @return array<string, mixed>
     */
    private function withLogo(array $stationery): array
    {
        $stationery['logoUrl'] = $this->logoUrl();

        return $stationery;
    }

    /**
     * @param  array<string, mixed>  $stored
     * @return array{
     *     header: string,
     *     footer: string,
     *     signatures: list<array{id: string, name: string, html: string}>,
     *     newSignatureId: string|null,
     *     replySignatureId: string|null
     * }
     */
    private function normalize(array $stored, User $user): array
    {
        $saved = $this->store([
            'header' => $stored['header'] ?? '',
            'footer' => $stored['footer'] ?? '',
            'signatures' => $stored['signatures'] ?? [],
            'new_signature_id' => $stored['new_signature_id'] ?? null,
            'reply_signature_id' => $stored['reply_signature_id'] ?? null,
        ]);

        if ($saved['signatures'] === []) {
            return $this->fromLegacy($user);
        }

        return [
            'header' => $saved['header'],
            'footer' => $saved['footer'],
            'signatures' => $saved['signatures'],
            'newSignatureId' => $saved['new_signature_id'],
            'replySignatureId' => $saved['reply_signature_id'],
        ];
    }

    /**
     * @return array{
     *     header: string,
     *     footer: string,
     *     signatures: list<array{id: string, name: string, html: string}>,
     *     newSignatureId: string|null,
     *     replySignatureId: string|null
     * }
     */
    private function fromLegacy(User $user): array
    {
        $written = trim((string) $user->mail_signature);
        $lines = $written !== ''
            ? implode('<br>', array_map(fn (string $line): string => e($line), preg_split("/\r\n|\n|\r/", $written) ?: []))
            : e($user->name).'<br>Gateway Door Systems<br>'.e((string) $user->microsoft_mailbox);

        $colors = $user->mailFooterColors();
        $bar = '';

        foreach ($colors as $color) {
            $bar .= '<td width="36" height="8" bgcolor="'.$color.'" style="width:36px;height:8px;background:'.$color.';line-height:8px;">&nbsp;</td>';
        }

        $identity = '<p style="margin:12px 0 0;font-family:Calibri,Arial,sans-serif;font-size:12px;line-height:1.4;color:#5c6f66;">Gateway Door Systems LLC</p>';
        $footer = $bar !== ''
            ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;"><tr>'.$bar.'</tr></table>'.$identity
            : '<p style="margin:18px 0 0;border-top:1px solid #d5e4db;padding-top:8px;font-family:Calibri,Arial,sans-serif;font-size:12px;line-height:1.4;color:#5c6f66;">Gateway Door Systems LLC</p>';

        return [
            'header' => '<p style="margin:0 0 12px;">'.$this->logoMarkup().'</p><p style="margin:0;font-family:Calibri,Arial,sans-serif;font-size:20px;font-weight:700;color:#06281c;">Gateway Door Systems</p><p style="margin:2px 0 16px;padding-bottom:8px;border-bottom:3px solid #047857;font-family:Calibri,Arial,sans-serif;font-size:12px;color:#5c6f66;">Security door installations</p>',
            'footer' => $footer,
            'signatures' => [[
                'id' => 'default',
                'name' => 'Signature',
                'html' => '<p style="margin:16px 0 0;font-family:Calibri,Arial,sans-serif;font-size:15px;line-height:1.45;color:#111827;">'.$lines.'</p>',
            ]],
            'newSignatureId' => 'default',
            'replySignatureId' => 'default',
        ];
    }

    /**
     * @return array{
     *     header: string,
     *     footer: string,
     *     signatures: list<array{id: string, name: string, html: string}>,
     *     newSignatureId: null,
     *     replySignatureId: null
     * }
     */
    private function emptyPayload(): array
    {
        return [
            'header' => '',
            'footer' => '',
            'signatures' => [],
            'newSignatureId' => null,
            'replySignatureId' => null,
        ];
    }

    /**
     * @param  array{header: string, footer: string, signatures: list<array{id: string, name: string, html: string}>, newSignatureId: string|null, replySignatureId: string|null}  $stationery
     */
    private function chosenHtml(array $stationery, string $kind): string
    {
        $id = $kind === 'reply' ? $stationery['replySignatureId'] : $stationery['newSignatureId'];

        foreach ($stationery['signatures'] as $signature) {
            if ($signature['id'] === $id) {
                return $signature['html'];
            }
        }

        return $stationery['signatures'][0]['html'] ?? '';
    }

    private function section(string $name, string $html): string
    {
        $html = trim($html);

        if ($html === '') {
            return '';
        }

        return '<div data-mail-section="'.$name.'">'.$html.'</div>';
    }

    private function alreadyPlaced(string $content): bool
    {
        return str_contains($content, 'data-gateway-mail') || str_contains($content, 'data-mail-section');
    }

    private function htmlType(string $content, string $type): string
    {
        if (strcasecmp($type, 'HTML') === 0 || $content !== strip_tags($content)) {
            return 'HTML';
        }

        return $type;
    }

    private function identifier(string $value): string
    {
        $value = trim($value);

        return preg_match('/^[A-Za-z0-9_-]{1,40}$/', $value) === 1 ? $value : '';
    }
}
