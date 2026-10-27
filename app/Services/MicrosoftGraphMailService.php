<?php

namespace App\Services;

use App\Exceptions\MicrosoftGraphException;
use App\Models\User;
use App\Support\EmailPlainText;
use App\Support\OutboundMailHtml;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class MicrosoftGraphMailService
{
    private ?User $actor = null;

    public function actingAs(?User $user): self
    {
        $copy = clone $this;
        $copy->actor = $user;

        return $copy;
    }

    public function send(
        string $to,
        string $subject,
        string $html,
        ?string $replyTo = null
    ): void {
        $from = trim((string) config('services.microsoft.mail_from'));

        if ($from === '') {
            throw new MicrosoftGraphException('Microsoft Graph is missing MICROSOFT_MAIL_FROM.');
        }

        $this->sendMessage($from, $to, $subject, $html, 'HTML', $replyTo);
    }

    public function sendFromMailbox(
        string $mailbox,
        string $to,
        string $subject,
        string $html,
        string $fromName = 'Gateway Door Systems',
    ): void {
        $this->actor = null;
        $this->sendMessage($mailbox, $to, $subject, $html, 'HTML', null, [], [], [], 'normal', $fromName);
    }

    /**
     * @param  list<array{name: string, contentType: string, bytes: string}>  $attachments
     */
    public function sendText(
        string $mailbox,
        string $to,
        string $subject,
        string $text,
        ?string $replyTo = null,
        array $attachments = []
    ): void {
        $this->sendMessage($mailbox, $to, $subject, $text, 'Text', $replyTo, $attachments);
    }

    /**
     * @param  list<string>  $to
     * @param  list<string>  $cc
     * @param  list<string>  $bcc
     * @param  list<array{name: string, contentType: string, bytes: string}>  $attachments
     */
    public function sendComposed(
        string $mailbox,
        array $to,
        string $subject,
        string $content,
        string $contentType = 'Text',
        array $cc = [],
        array $bcc = [],
        string $importance = 'normal',
        array $attachments = [],
    ): void {
        $this->sendMessage(
            $mailbox,
            $to,
            $subject,
            $content,
            $contentType,
            null,
            $attachments,
            $cc,
            $bcc,
            $importance,
        );
    }

    /**
     * @return array{messages: list<array<string, mixed>>, nextLink: ?string}
     */
    public function listFolder(string $mailbox, string $folder, ?string $nextUrl = null): array
    {
        $url = $nextUrl ?? $this->folderUrl($mailbox, $folder);

        if ($nextUrl !== null) {
            app(MicrosoftGraphPageCursor::class)->assertLink($nextUrl, $mailbox, $folder);
        }

        $response = $this->graph('GET', $url, null, false);

        if ($response->failed()) {
            throw new MicrosoftGraphException($this->failureMessage($response, false));
        }

        $payload = $response->json();
        $next = is_array($payload) ? ($payload['@odata.nextLink'] ?? null) : null;
        $messages = [];

        foreach ($response->json('value') ?? [] as $item) {
            if (! is_array($item)) {
                continue;
            }

            $messages[] = $this->summary($item, $folder);
        }

        return [
            'messages' => $messages,
            'nextLink' => is_string($next) && $next !== '' ? $next : null,
        ];
    }

    public function unreadInboxCount(string $mailbox): int
    {
        $url = $this->userUrl($mailbox).'/mailFolders/inbox?'.http_build_query([
            '$select' => 'unreadItemCount',
        ]);

        $response = $this->graph('GET', $url, null, false);

        if ($response->failed()) {
            throw new MicrosoftGraphException($this->failureMessage($response, false));
        }

        return max(0, (int) $response->json('unreadItemCount'));
    }

    /**
     * @return list<array{id: string, subject: string, from: string, preview: string}>
     */
    public function recentUnread(string $mailbox): array
    {
        $url = $this->userUrl($mailbox).'/mailFolders/inbox/messages?'.http_build_query([
            '$select' => 'id,subject,from,receivedDateTime,bodyPreview,isRead',
            '$top' => 8,
            '$orderby' => 'receivedDateTime desc',
        ]);

        $response = $this->graph('GET', $url, null, false);

        if ($response->failed()) {
            throw new MicrosoftGraphException($this->failureMessage($response, false));
        }

        $messages = [];

        foreach ($response->json('value') ?? [] as $item) {
            if (! is_array($item) || ($item['isRead'] ?? false) === true) {
                continue;
            }

            $summary = $this->summary($item, 'inbox');
            $messages[] = [
                'id' => (string) $summary['id'],
                'subject' => (string) $summary['subject'],
                'from' => (string) $summary['from'],
                'preview' => (string) $summary['preview'],
            ];
        }

        return $messages;
    }

    /**
     * @return array<string, mixed>
     */
    public function readMessage(string $mailbox, string $messageId): array
    {
        $query = http_build_query([
            '$select' => 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,body,bodyPreview,hasAttachments',
        ]);
        $url = $this->userUrl($mailbox).'/messages/'.rawurlencode($messageId).'?'.$query;

        $response = $this->graph('GET', $url, null, false);

        if ($response->failed() && $response->status() !== 404) {
            $fallback = http_build_query([
                '$select' => 'id,subject,from,toRecipients,receivedDateTime,sentDateTime,body,bodyPreview,hasAttachments',
            ]);
            $response = $this->graph('GET', $this->userUrl($mailbox).'/messages/'.rawurlencode($messageId).'?'.$fallback, null, false);
        }

        if ($response->status() === 404) {
            throw new MicrosoftGraphException('Microsoft 365 could not find that message.');
        }

        if ($response->failed()) {
            throw new MicrosoftGraphException($this->failureMessage($response, false));
        }

        $item = $response->json();

        if (! is_array($item)) {
            throw new MicrosoftGraphException('Microsoft 365 returned an unreadable message.');
        }

        $body = is_array($item['body'] ?? null) ? $item['body'] : [];
        $graphId = (string) ($item['id'] ?? $messageId);
        $presented = $this->presentAttachments($mailbox, $graphId);

        return [
            'id' => EmailPlainText::encodeMessageId($graphId),
            'subject' => (string) ($item['subject'] ?? ''),
            'from' => $this->address($item['from'] ?? null),
            'to' => $this->addresses($item['toRecipients'] ?? []),
            'cc' => $this->addresses($item['ccRecipients'] ?? []),
            'received_at' => $item['receivedDateTime'] ?? null,
            'sent_at' => $item['sentDateTime'] ?? null,
            'body' => EmailPlainText::fromGraph(
                is_string($body['contentType'] ?? null) ? $body['contentType'] : null,
                is_string($body['content'] ?? null) ? $body['content'] : (string) ($item['bodyPreview'] ?? ''),
            ),
            'images' => $presented['images'],
            'attachments' => $presented['attachments'],
            'has_attachments' => ($item['hasAttachments'] ?? false) === true || $presented['attachments'] !== [] || $presented['images'] !== [],
        ];
    }

    /**
     * @return array{bytes: string, name: string, contentType: string, inline: bool}
     */
    public function readAttachment(string $mailbox, string $messageId, string $attachmentId): array
    {
        $this->assertGraphId($messageId);
        $this->assertGraphId($attachmentId);

        $url = $this->userUrl($mailbox).'/messages/'.rawurlencode($messageId)
            .'/attachments/'.rawurlencode($attachmentId);
        $response = $this->graph('GET', $url, null, false);

        if ($response->status() === 404) {
            throw new MicrosoftGraphException('Microsoft 365 could not find that attachment.');
        }

        if ($response->failed()) {
            throw new MicrosoftGraphException($this->failureMessage($response, false));
        }

        $item = $response->json();

        if (! is_array($item) || ! $this->isFileAttachment($item)) {
            throw new MicrosoftGraphException('Microsoft 365 could not find that attachment.');
        }

        $encoded = preg_replace('/\s+/', '', (string) ($item['contentBytes'] ?? '')) ?? '';
        $bytes = base64_decode($encoded, true);

        if (! is_string($bytes) || $bytes === '' || strlen($bytes) > 8 * 1024 * 1024) {
            throw new MicrosoftGraphException('That attachment is too large to open here.');
        }

        $imageType = $this->imageType($bytes);
        $pdf = $imageType === null && str_starts_with($bytes, '%PDF-');

        return [
            'bytes' => $bytes,
            'name' => $this->attachmentName($item),
            'contentType' => $imageType ?? ($pdf ? 'application/pdf' : 'application/octet-stream'),
            'inline' => $imageType !== null || $pdf,
        ];
    }

    /**
     * @return array{images: list<array{name: string, src: string}>, attachments: list<array{id: string, name: string, content_type: string, size: int, image: bool}>}
     */
    private function presentAttachments(string $mailbox, string $messageId): array
    {
        $images = [];
        $attachments = [];

        foreach ($this->attachmentItems($mailbox, $messageId) as $item) {
            $image = count($images) < 8 ? $this->inlineImage($item) : null;

            if ($image !== null) {
                $images[] = $image;
            }

            $summary = $this->attachmentSummary($item);

            if ($summary !== null && count($attachments) < 20) {
                $attachments[] = $summary;
            }
        }

        return [
            'images' => $images,
            'attachments' => $attachments,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function attachmentItems(string $mailbox, string $messageId): array
    {
        $url = $this->userUrl($mailbox).'/messages/'.rawurlencode($messageId).'/attachments';

        try {
            $response = $this->graph('GET', $url, null, false);
        } catch (MicrosoftGraphException) {
            return [];
        }

        if ($response->failed()) {
            return [];
        }

        $items = $response->json('value');

        if (! is_array($items)) {
            return [];
        }

        return array_values(array_filter(
            array_slice($items, 0, 30),
            fn (mixed $item): bool => is_array($item),
        ));
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{name: string, src: string}|null
     */
    private function inlineImage(array $item): ?array
    {
        $contentId = trim((string) ($item['contentId'] ?? ''));
        $inline = ($item['isInline'] ?? false) === true;

        if ($contentId === '' && ! $inline) {
            return null;
        }

        $type = strtolower(trim((string) ($item['contentType'] ?? '')));
        $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        if (! in_array($type, $allowed, true)) {
            return null;
        }

        $size = (int) ($item['size'] ?? 0);

        if ($size > 500000) {
            return null;
        }

        $bytes = preg_replace('/\s+/', '', (string) ($item['contentBytes'] ?? '')) ?? '';

        if ($bytes === '' || strlen($bytes) > 700000 || preg_match('#^[A-Za-z0-9+/=]+$#', $bytes) !== 1) {
            return null;
        }

        $name = trim(strip_tags((string) ($item['name'] ?? 'Image')));

        if ($name === '') {
            $name = 'Image';
        }

        return [
            'name' => mb_substr($name, 0, 120),
            'src' => 'data:'.$type.';base64,'.preg_replace('/\s+/', '', $bytes),
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{id: string, name: string, content_type: string, size: int, image: bool}|null
     */
    private function attachmentSummary(array $item): ?array
    {
        if (! $this->isFileAttachment($item)) {
            return null;
        }

        $id = trim((string) ($item['id'] ?? ''));
        $token = $id === '' ? '' : EmailPlainText::encodeMessageId($id);

        if ($token === '' || EmailPlainText::decodeMessageId($token) !== $id) {
            return null;
        }

        $type = strtolower(trim((string) ($item['contentType'] ?? 'application/octet-stream')));

        if (preg_match('#^[a-z0-9.+-]+/[a-z0-9.+-]+$#', $type) !== 1) {
            $type = 'application/octet-stream';
        }

        return [
            'id' => $token,
            'name' => $this->attachmentName($item),
            'content_type' => $type,
            'size' => max(0, (int) ($item['size'] ?? 0)),
            'image' => str_starts_with($type, 'image/') && ! str_contains($type, 'svg'),
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function isFileAttachment(array $item): bool
    {
        $type = strtolower((string) ($item['@odata.type'] ?? ''));

        return $type === '' || str_ends_with($type, 'fileattachment');
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function attachmentName(array $item): string
    {
        $name = basename(str_replace('\\', '/', trim(strip_tags((string) ($item['name'] ?? 'Attachment')))));
        $name = preg_replace('/[^\p{L}\p{N}._ -]/u', '', $name) ?? '';
        $name = trim($name, ". \t");

        return mb_substr($name !== '' ? $name : 'Attachment', 0, 120);
    }

    private function imageType(string $bytes): ?string
    {
        if (str_starts_with($bytes, "\xFF\xD8\xFF")) {
            return 'image/jpeg';
        }

        if (str_starts_with($bytes, "\x89PNG\r\n\x1a\n")) {
            return 'image/png';
        }

        if (str_starts_with($bytes, 'GIF87a') || str_starts_with($bytes, 'GIF89a')) {
            return 'image/gif';
        }

        if (strlen($bytes) >= 12 && str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WEBP') {
            return 'image/webp';
        }

        return null;
    }

    private function assertGraphId(string $id): void
    {
        if ($id === '' || strlen($id) > 3000 || preg_match('/[\x00-\x1F]/', $id) === 1
            || str_contains($id, '\\') || str_contains($id, '..')) {
            throw new MicrosoftGraphException('Microsoft 365 could not find that attachment.');
        }
    }

    public function markRead(string $mailbox, string $messageId): void
    {
        $this->setRead($mailbox, $messageId, true);
    }

    public function setRead(string $mailbox, string $messageId, bool $isRead): void
    {
        $url = $this->userUrl($mailbox).'/messages/'.rawurlencode($messageId);
        $response = $this->graph('PATCH', $url, ['isRead' => $isRead], false);

        if ($response->failed()) {
            throw new MicrosoftGraphException($this->failureMessage($response, false));
        }
    }

    public function moveMessage(string $mailbox, string $messageId, string $destination): void
    {
        $url = $this->userUrl($mailbox).'/messages/'.rawurlencode($messageId).'/move';
        $response = $this->graph('POST', $url, [
            'destinationId' => $destination,
        ], false);

        if ($response->failed()) {
            throw new MicrosoftGraphException($this->failureMessage($response, false));
        }
    }

    /**
     * @param  string|list<string>  $to
     * @param  list<array{name: string, contentType: string, bytes: string}>  $attachments
     * @param  list<string>  $cc
     * @param  list<string>  $bcc
     */
    private function sendMessage(
        string $mailbox,
        string|array $to,
        string $subject,
        string $content,
        string $contentType,
        ?string $replyTo,
        array $attachments = [],
        array $cc = [],
        array $bcc = [],
        string $importance = 'normal',
        ?string $fromName = null,
    ): void {
        $mailbox = $this->resolveMailbox($mailbox);
        $files = $this->attachmentPayload($attachments);
        $subject = trim(preg_replace('/\s+/u', ' ', $subject) ?? $subject);

        if (strcasecmp($contentType, 'HTML') === 0) {
            $content = OutboundMailHtml::document($content, $subject);
        }

        $replyAddress = is_string($replyTo) && trim($replyTo) !== '' ? trim($replyTo) : $mailbox;

        $message = [
            'subject' => $subject,
            'body' => [
                'contentType' => $contentType,
                'content' => $content,
            ],
            'toRecipients' => $this->emailRecipients(is_array($to) ? $to : [$to]),
            'replyTo' => [
                [
                    'emailAddress' => [
                        'address' => strtolower($replyAddress),
                    ],
                ],
            ],
        ];

        if (is_string($fromName) && trim($fromName) !== '') {
            $message['from'] = [
                'emailAddress' => [
                    'address' => $mailbox,
                    'name' => trim($fromName),
                ],
            ];
        }

        if ($cc !== []) {
            $message['ccRecipients'] = $this->emailRecipients($cc);
        }

        if ($bcc !== []) {
            $message['bccRecipients'] = $this->emailRecipients($bcc);
        }

        if (in_array($importance, ['low', 'high'], true)) {
            $message['importance'] = $importance;
        }

        if ($files !== []) {
            $message['attachments'] = $files;
        }

        try {
            $response = $this->graph('POST', $this->userUrl($mailbox).'/sendMail', [
                'message' => $message,
                'saveToSentItems' => true,
            ], true);
        } catch (ConnectionException) {
            throw new MicrosoftGraphException(
                'Microsoft 365 did not confirm the message. It was not sent again.'
            );
        }

        if ($response->failed()) {
            throw new MicrosoftGraphException($this->failureMessage($response, true));
        }

        try {
            $this->auditSend($mailbox);
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    /**
     * @param  list<string>  $addresses
     * @return list<array{emailAddress: array{address: string}}>
     */
    private function emailRecipients(array $addresses): array
    {
        $recipients = [];

        foreach ($addresses as $address) {
            $address = strtolower(trim($address));

            if ($address === '') {
                continue;
            }

            $recipients[] = [
                'emailAddress' => [
                    'address' => $address,
                ],
            ];
        }

        return $recipients;
    }

    /**
     * @param  list<array{name: string, contentType: string, bytes: string}>  $attachments
     * @return list<array<string, string>>
     */
    private function attachmentPayload(array $attachments): array
    {
        $files = [];
        $bytes = 0;

        foreach ($attachments as $attachment) {
            $contents = $attachment['bytes'];
            $bytes += strlen($contents);

            if ($bytes > 3_500_000) {
                throw new MicrosoftGraphException('The quotation PDF is too large to email.');
            }

            $name = basename(str_replace('\\', '/', $attachment['name']));
            $name = preg_replace('/[^A-Za-z0-9._-]+/', '-', $name) ?: 'quotation.pdf';

            $file = [
                '@odata.type' => '#microsoft.graph.fileAttachment',
                'name' => $name,
                'contentType' => $attachment['contentType'],
                'contentBytes' => base64_encode($contents),
            ];

            if (($attachment['inline'] ?? false) === true && is_string($attachment['contentId'] ?? null)) {
                $file['isInline'] = true;
                $file['contentId'] = $attachment['contentId'];
            }

            $files[] = $file;
        }

        return $files;
    }

    private function graph(string $method, string $url, ?array $body, bool $sending): Response
    {
        $attempt = 0;

        while (true) {
            $pending = Http::withToken($this->accessToken())
                ->acceptJson()
                ->timeout(20)
                ->connectTimeout(10);

            if ($method === 'GET') {
                $pending = $pending->withHeaders([
                    'Prefer' => 'outlook.body-content-type="text"',
                ]);
            }

            try {
                $response = match ($method) {
                    'GET' => $pending->get($url),
                    'PATCH' => $pending->patch($url, $body ?? []),
                    default => $body === null ? $pending->post($url) : $pending->post($url, $body),
                };
            } catch (ConnectionException $exception) {
                if ($sending) {
                    throw $exception;
                }

                throw new MicrosoftGraphException('Microsoft 365 did not respond. Refresh and try again.');
            }

            if ($response->status() === 401 && $attempt === 0) {
                $this->forgetAccessToken();
                $attempt++;

                continue;
            }

            if (! $sending && $response->status() === 429 && $attempt === 0) {
                $this->honorRetryAfter($response);
                $attempt++;

                continue;
            }

            return $response;
        }
    }

    private function accessToken(): string
    {
        $cached = Cache::get($this->tokenCacheKey());

        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        [$tenantId, $clientId, $clientSecret] = $this->credentials();

        $response = Http::asForm()
            ->acceptJson()
            ->timeout(20)
            ->connectTimeout(10)
            ->post(
                "https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token",
                [
                    'client_id' => $clientId,
                    'client_secret' => $clientSecret,
                    'scope' => 'https://graph.microsoft.com/.default',
                    'grant_type' => 'client_credentials',
                ]
            );

        if ($response->failed()) {
            throw new MicrosoftGraphException(
                'Microsoft authentication failed: HTTP '.$response->status().' '.$this->safeDetail($response)
            );
        }

        $token = trim((string) $response->json('access_token'));

        if ($token === '') {
            throw new MicrosoftGraphException('Microsoft authentication failed: no access token was returned.');
        }

        $expiresIn = (int) $response->json('expires_in', 3600);
        $ttl = $expiresIn - 120;

        if ($ttl < 30) {
            $ttl = max(1, $expiresIn - 15);
        }

        Cache::put($this->tokenCacheKey(), $token, $ttl);

        return $token;
    }

    public function forgetAccessToken(): void
    {
        Cache::forget($this->tokenCacheKey());
    }

    /**
     * @return array{0: string, 1: string, 2: string}
     */
    private function credentials(): array
    {
        $tenantId = trim((string) config('services.microsoft.tenant_id'));
        $clientId = trim((string) config('services.microsoft.client_id'));
        $clientSecret = trim((string) config('services.microsoft.client_secret'));
        $credentialUser = $this->credentialUser();

        if ($credentialUser?->isSuperAdmin()) {
            $ownSecret = trim((string) $credentialUser->microsoft_client_secret);

            if ($ownSecret !== '') {
                $tenantId = trim((string) ($credentialUser->microsoft_tenant_id ?: $tenantId));
                $clientId = trim((string) ($credentialUser->microsoft_client_id ?: $clientId));
                $clientSecret = $ownSecret;
            }
        }

        if ($tenantId === '' || $clientId === '' || $clientSecret === '') {
            throw new MicrosoftGraphException(
                'Microsoft Graph is missing MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, or MICROSOFT_CLIENT_SECRET in the Forge Environment.'
            );
        }

        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $clientSecret) === 1) {
            throw new MicrosoftGraphException(
                'MICROSOFT_CLIENT_SECRET is the Secret ID. Use the Secret Value from Azure (it usually contains ~).'
            );
        }

        return [$tenantId, $clientId, $clientSecret];
    }

    /**
     * User mail is sent only from the signed-in account's saved mailbox.
     * A mailbox argument is ignored once an account is attached, so a browser
     * payload cannot choose Larry's address or the contact-form sender.
     */
    private function resolveMailbox(string $requested): string
    {
        if (! $this->actor instanceof User) {
            $mailbox = strtolower(trim($requested));

            if ($mailbox === '') {
                throw new MicrosoftGraphException('Microsoft Graph is missing MICROSOFT_MAIL_FROM.');
            }

            return $mailbox;
        }

        $fresh = User::query()->find($this->actor->getAuthIdentifier());
        $mailbox = strtolower(trim((string) ($fresh->microsoft_mailbox ?? '')));

        if ($mailbox === '' || filter_var($mailbox, FILTER_VALIDATE_EMAIL) === false) {
            throw new MicrosoftGraphException('This account has no Microsoft 365 mailbox assigned.');
        }

        $this->actor = $fresh;

        return $mailbox;
    }

    private function auditSend(string $mailbox): void
    {
        $effective = $this->actor;

        if (! $effective instanceof User) {
            return;
        }

        $impersonatorId = session('impersonator_id');
        $impersonator = is_numeric($impersonatorId)
            ? User::query()->find((int) $impersonatorId)
            : null;

        app(UserActivityLogger::class)->log(
            $effective,
            'record_created',
            'send_mailbox_message',
            'Sent a message from the signed-in mailbox.',
            request(),
            $effective,
            array_filter([
                'mailbox' => $mailbox,
                'effective_user_id' => $effective->id,
                'impersonator_id' => $impersonator?->id,
                'impersonator_email' => $impersonator?->email,
            ], fn (mixed $value): bool => $value !== null),
        );
    }

    /**
     * A super admin with a saved secret uses that app. While the master account
     * is signed in as someone who has not saved an app secret, the master's app
     * is used so that person's mailbox can still be opened.
     */
    private function credentialUser(): ?User
    {
        $actor = $this->actor;

        if ($this->hasSavedSecret($actor)) {
            return $actor;
        }

        $impersonatorId = session('impersonator_id');

        if (! is_numeric($impersonatorId)) {
            return $actor;
        }

        $master = User::query()->find((int) $impersonatorId);

        if ($master?->isMaster() && $this->hasSavedSecret($master)) {
            return $master;
        }

        return $actor;
    }

    private function hasSavedSecret(?User $user): bool
    {
        return trim((string) $user?->microsoft_client_secret) !== '';
    }

    private function tokenCacheKey(): string
    {
        [$tenantId, $clientId, $clientSecret] = $this->credentials();

        return 'microsoft-graph:token:'.hash('sha256', $tenantId.'|'.$clientId.'|'.$clientSecret);
    }

    private function honorRetryAfter(Response $response): void
    {
        $wait = (int) $response->header('Retry-After');

        if ($wait > 0 && $wait <= 5) {
            sleep($wait);
        }
    }

    private function failureMessage(Response $response, bool $sending): string
    {
        $status = $response->status();

        if ($sending && in_array($status, [408, 429, 500, 502, 503, 504], true)) {
            return 'Microsoft 365 did not confirm the message. It was not sent again.';
        }

        return match ($status) {
            401 => 'Microsoft 365 rejected the application credentials.',
            403 => $this->accessDeniedMessage($response),
            404 => 'Microsoft 365 could not find that mailbox or message.',
            429 => 'Microsoft 365 is limiting requests. Try again in a moment.',
            default => 'Microsoft Graph request failed: HTTP '.$status.' '.$this->safeDetail($response),
        };
    }

    private function accessDeniedMessage(Response $response): string
    {
        $code = $response->json('error.code');
        $code = is_string($code) ? preg_replace('/[^A-Za-z0-9_]/', '', $code) ?? '' : '';

        if ($code === '') {
            return 'Microsoft 365 denied access to this mailbox.';
        }

        return 'Microsoft 365 denied access to this mailbox ('.$code.').';
    }

    private function safeDetail(Response $response): string
    {
        $detail = $response->json('error_description')
            ?? $response->json('error.message')
            ?? $response->json('error.code')
            ?? '';

        if (! is_string($detail)) {
            $detail = '';
        }

        $detail = preg_replace('/access_token[^,\s"]*/i', '[redacted]', $detail) ?? '';

        return trim($detail);
    }

    private function folderUrl(string $mailbox, string $folder): string
    {
        $graphFolder = match ($folder) {
            'sent' => 'sentitems',
            'archive' => 'archive',
            default => 'inbox',
        };
        $order = $folder === 'sent' ? 'sentDateTime desc' : 'receivedDateTime desc';
        $query = http_build_query([
            '$select' => 'id,subject,from,toRecipients,receivedDateTime,sentDateTime,bodyPreview,isRead,hasAttachments',
            '$top' => 25,
            '$orderby' => $order,
        ]);

        return $this->userUrl($mailbox)."/mailFolders/{$graphFolder}/messages?{$query}";
    }

    private function userUrl(string $mailbox): string
    {
        return 'https://graph.microsoft.com/v1.0/users/'.rawurlencode($mailbox);
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private function summary(array $item, string $folder): array
    {
        return [
            'id' => EmailPlainText::encodeMessageId((string) ($item['id'] ?? '')),
            'subject' => (string) ($item['subject'] ?? ''),
            'from' => $this->address($item['from'] ?? null),
            'to' => $this->addresses($item['toRecipients'] ?? []),
            'preview' => EmailPlainText::fromGraph('text', (string) ($item['bodyPreview'] ?? '')),
            'received_at' => $item['receivedDateTime'] ?? null,
            'sent_at' => $item['sentDateTime'] ?? null,
            'is_read' => (bool) ($item['isRead'] ?? false),
            'has_attachments' => ($item['hasAttachments'] ?? false) === true,
            'folder' => $folder,
        ];
    }

    /**
     * @return list<string>
     */
    private function addresses(mixed $recipients): array
    {
        if (! is_array($recipients)) {
            return [];
        }

        $addresses = [];

        foreach ($recipients as $recipient) {
            $address = $this->address($recipient);

            if ($address !== '') {
                $addresses[] = $address;
            }
        }

        return $addresses;
    }

    private function address(mixed $recipient): string
    {
        if (! is_array($recipient)) {
            return '';
        }

        $email = $recipient['emailAddress']['address'] ?? null;
        $name = $recipient['emailAddress']['name'] ?? null;

        if (! is_string($email) || $email === '') {
            return '';
        }

        if (is_string($name) && $name !== '' && strcasecmp($name, $email) !== 0) {
            return $name.' <'.$email.'>';
        }

        return $email;
    }
}
