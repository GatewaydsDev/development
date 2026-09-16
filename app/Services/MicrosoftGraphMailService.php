<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class MicrosoftGraphMailService
{
    private function getAccessToken(): string
    {
        $tenantId = config('services.microsoft.tenant_id');
        $clientId = config('services.microsoft.client_id');
        $clientSecret = config('services.microsoft.client_secret');

        $response = Http::asForm()->post(
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
                'Microsoft authentication failed: '.$response->body()
            );
        }

        return $response->json('access_token');
    }

    public function send(
        string $to,
        string $subject,
        string $html,
        ?string $replyTo = null
    ): void {
        $token = $this->getAccessToken();

        $from = config('services.microsoft.mail_from');

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

        $response = Http::withToken($token)->post(
            "https://graph.microsoft.com/v1.0/users/{$from}/sendMail",
            [
                'message' => $message,
                'saveToSentItems' => true,
            ]
        );

        if ($response->failed()) {
            throw new RuntimeException(
                'Microsoft Graph sendMail failed: '.$response->body()
            );
        }
    }
}
