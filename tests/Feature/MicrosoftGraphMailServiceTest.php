<?php

use App\Services\MicrosoftGraphMailService;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
        'services.microsoft.mail_from' => 'sales@gateway-ds.com',
    ]);
});

test('microsoft graph mail service sends html mail through azure', function () {
    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response([
            'access_token' => 'graph-token',
            'expires_in' => 3600,
        ], 200),
        'https://graph.microsoft.com/*' => Http::response('', 202),
    ]);

    app(MicrosoftGraphMailService::class)->send(
        'sales@gateway-ds.com',
        'Quote ready',
        '<p>The quote is attached.</p>',
        'buyer@example.com',
    );

    Http::assertSent(function ($request) {
        return $request->url() === 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token'
            && $request['client_id'] === 'client-id'
            && $request['client_secret'] === 'client-secret'
            && $request['grant_type'] === 'client_credentials';
    });

    Http::assertSent(function ($request) {
        $payload = $request->data();

        return $request->url() === 'https://graph.microsoft.com/v1.0/users/sales@gateway-ds.com/sendMail'
            && $request->hasHeader('Authorization', 'Bearer graph-token')
            && $payload['saveToSentItems'] === true
            && $payload['message']['subject'] === 'Quote ready'
            && $payload['message']['toRecipients'][0]['emailAddress']['address'] === 'sales@gateway-ds.com'
            && $payload['message']['replyTo'][0]['emailAddress']['address'] === 'buyer@example.com';
    });
});

test('microsoft graph mail service requires azure app credentials', function () {
    config([
        'services.microsoft.tenant_id' => '',
        'services.microsoft.client_id' => '',
        'services.microsoft.client_secret' => '',
    ]);

    app(MicrosoftGraphMailService::class)->send(
        'sales@gateway-ds.com',
        'Quote ready',
        '<p>Hello</p>',
    );
})->throws(RuntimeException::class, 'MICROSOFT_TENANT_ID');

test('microsoft graph mail service surfaces azure errors', function () {
    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response([
            'error' => 'unauthorized_client',
            'error_description' => 'AADSTS700016: Application was not found in the directory.',
        ], 400),
    ]);

    app(MicrosoftGraphMailService::class)->send(
        'sales@gateway-ds.com',
        'Quote ready',
        '<p>Hello</p>',
    );
})->throws(RuntimeException::class, 'AADSTS700016');
