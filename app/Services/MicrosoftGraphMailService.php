<?php

namespace App\Services;

use App\Exceptions\MicrosoftGraphException;
use App\Models\User;
use App\Support\EmailPlainText;
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

    /**
     * @return array<string, mixed>
     */
    public function readMessage(string $mailbox, string $messageId): array
    {
        $url = $this->userUrl($mailbox).'/messages/'.rawurlencode($messageId)
            .'?$select=id,subject,from,toRecipients,receivedDateTime,sentDateTime,body,bodyPreview';

        $response = $this->graph('GET', $url, null, false);

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

        return [
            'id' => EmailPlainText::encodeMessageId((string) ($item['id'] ?? $messageId)),
            'subject' => (string) ($item['subject'] ?? ''),
            'from' => $this->address($item['from'] ?? null),
            'to' => $this->addresses($item['toRecipients'] ?? []),
            'received_at' => $item['receivedDateTime'] ?? null,
            'sent_at' => $item['sentDateTime'] ?? null,
            'body' => EmailPlainText::fromGraph(
                is_string($body['contentType'] ?? null) ? $body['contentType'] : null,
                is_string($body['content'] ?? null) ? $body['content'] : (string) ($item['bodyPreview'] ?? ''),
            ),
        ];
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
    ): void {
        $files = $this->attachmentPayload($attachments);
        $message = [
            'subject' => $subject,
            'body' => [
                'contentType' => $contentType,
                'content' => $content,
            ],
            'toRecipients' => $this->emailRecipients(is_array($to) ? $to : [$to]),
            'from' => [
                'emailAddress' => array_filter([
                    'address' => $mailbox,
                    'name' => trim((string) config('services.microsoft.mail_from_name')) ?: null,
                ]),
            ],
        ];

        if ($cc !== []) {
            $message['ccRecipients'] = $this->emailRecipients($cc);
        }

        if ($bcc !== []) {
            $message['bccRecipients'] = $this->emailRecipients($bcc);
        }

        if (in_array($importance, ['low', 'high'], true)) {
            $message['importance'] = $importance;
        }

        if ($replyTo) {
            $message['replyTo'] = [
                [
                    'emailAddress' => [
                        'address' => $replyTo,
                    ],
                ],
            ];
        }

        if ($files !== []) {
            $message['attachments'] = $files;
        }

        try {
            $response = $this->graph(
                'POST',
                $this->userUrl($mailbox).'/sendMail',
                [
                    'message' => $message,
                    'saveToSentItems' => true,
                ],
                true,
            );
        } catch (ConnectionException) {
            throw new MicrosoftGraphException(
                'Microsoft 365 did not confirm the message. It was not sent again.'
            );
        }

        if ($response->failed()) {
            throw new MicrosoftGraphException($this->failureMessage($response, true));
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

            $files[] = [
                '@odata.type' => '#microsoft.graph.fileAttachment',
                'name' => $name,
                'contentType' => $attachment['contentType'],
                'contentBytes' => base64_encode($contents),
            ];
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
                ->connectTimeout(10)
                ->withHeaders([
                    'Prefer' => 'outlook.body-content-type="text"',
                ]);

            try {
                $response = $method === 'GET'
                    ? $pending->get($url)
                    : $pending->post($url, $body ?? []);
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
        $actor = $this->actor;

        if ($actor?->isSuperAdmin()) {
            $ownSecret = trim((string) $actor->microsoft_client_secret);

            if ($ownSecret !== '') {
                $tenantId = trim((string) ($actor->microsoft_tenant_id ?: $tenantId));
                $clientId = trim((string) ($actor->microsoft_client_id ?: $clientId));
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
            403 => 'Microsoft 365 denied access to this mailbox.',
            404 => 'Microsoft 365 could not find that mailbox or message.',
            429 => 'Microsoft 365 is limiting requests. Try again in a moment.',
            default => 'Microsoft Graph request failed: HTTP '.$status.' '.$this->safeDetail($response),
        };
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
        $graphFolder = $folder === 'sent' ? 'sentitems' : 'inbox';
        $order = $folder === 'sent' ? 'sentDateTime desc' : 'receivedDateTime desc';
        $query = http_build_query([
            '$select' => 'id,subject,from,toRecipients,receivedDateTime,sentDateTime,bodyPreview,isRead',
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
