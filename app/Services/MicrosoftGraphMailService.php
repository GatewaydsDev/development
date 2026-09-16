<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class MicrosoftGraphMailService
{
    private function getAccessToken(): string
    {
        $tenantId = trim((string) config('services.microsoft.tenant_id'));
        $clientId = trim((string) config('services.microsoft.client_id'));
        $clientSecret = trim((string) config('services.microsoft.client_secret'));

        if ($tenantId === '' || $clientId === '' || $clientSecret === '') {
            throw new RuntimeException(
                'Microsoft Graph is missing MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, or MICROSOFT_CLIENT_SECRET in the Forge Environment.'
            );
        }

        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $clientSecret) === 1) {
            throw new RuntimeException(
                'MICROSOFT_CLIENT_SECRET is the Secret ID. Use the Secret Value from Azure (it usually contains ~).'
            );
        }

        $response = Http::asForm()
            ->acceptJson()
            ->timeout(20)
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
            throw new RuntimeException(
                'Microsoft authentication failed: '.$this->errorDetail($response)
            );
        }

        $token = trim((string) $response->json('access_token'));

        if ($token === '') {
            throw new RuntimeException('Microsoft authentication failed: no access token was returned.');
        }

        return $token;
    }

    public function send(
        string $to,
        string $subject,
        string $html,
        ?string $replyTo = null
    ): void {
        $token = $this->getAccessToken();
        $from = trim((string) config('services.microsoft.mail_from'));

        if ($from === '') {
            throw new RuntimeException('Microsoft Graph is missing MICROSOFT_MAIL_FROM.');
        }

        $message = [
            'subject' => $subject,
            'body' => [
                'contentType' => 'HTML',
                'content' => $html,
            ],
            'toRecipients' => [
                [
                    'emailAddress' => [
                        'address' => $to,
                    ],
                ],
            ],
        ];

        if ($replyTo) {
            $message['replyTo'] = [
                [
                    'emailAddress' => [
                        'address' => $replyTo,
                    ],
                ],
            ];
        }

        $response = Http::withToken($token)
            ->acceptJson()
            ->timeout(20)
            ->post(
                "https://graph.microsoft.com/v1.0/users/{$from}/sendMail",
                [
                    'message' => $message,
                    'saveToSentItems' => true,
                ]
            );

        if ($response->failed()) {
            throw new RuntimeException(
                'Microsoft Graph sendMail failed: '.$this->errorDetail($response)
            );
        }
    }

    private function errorDetail(Response $response): string
    {
        $detail = $response->json('error_description')
            ?? $response->json('error.message')
            ?? $response->body();

        if (! is_string($detail) || trim($detail) === '') {
            $detail = 'empty response';
        }

        return 'HTTP '.$response->status().' '.$detail;
    }
}
