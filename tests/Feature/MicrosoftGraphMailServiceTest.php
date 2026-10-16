<?php

use App\Models\User;
use App\Models\UserLevel;
use App\Services\MicrosoftGraphMailService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
        'services.microsoft.mail_from' => 'sales@gateway-ds.com',
        'services.microsoft.mail_from_name' => 'Gateway Door Systems',
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

        return $request->url() === 'https://graph.microsoft.com/v1.0/users/'.rawurlencode('sales@gateway-ds.com').'/sendMail'
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

test('microsoft graph tokens are cached and refreshed after they are rejected', function () {
    Http::fake([
        'https://login.microsoftonline.com/*' => Http::sequence()
            ->push(['access_token' => 'first-token', 'expires_in' => 3600])
            ->push(['access_token' => 'second-token', 'expires_in' => 3600]),
        'https://graph.microsoft.com/*' => Http::sequence()
            ->push(['value' => []], 200)
            ->push(['value' => []], 200)
            ->push(['error' => ['code' => 'InvalidAuthenticationToken']], 401)
            ->push(['value' => []], 200),
    ]);

    $mail = app(MicrosoftGraphMailService::class);
    $mail->listFolder('sales@gateway-ds.com', 'inbox');
    $mail->listFolder('sales@gateway-ds.com', 'sent');

    $tokenRequests = collect(Http::recorded())
        ->filter(fn (array $pair) => str_contains($pair[0]->url(), 'oauth2/v2.0/token'))
        ->count();

    expect($tokenRequests)->toBe(1);

    $mail->listFolder('sales@gateway-ds.com', 'inbox');

    $tokenRequests = collect(Http::recorded())
        ->filter(fn (array $pair) => str_contains($pair[0]->url(), 'oauth2/v2.0/token'))
        ->count();

    expect($tokenRequests)->toBe(2);

    Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer second-token'));
});

test('a super admin sends mail with that persons microsoft credentials', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create([
        'level_id' => $level->id,
        'role' => 'super_admin',
        'microsoft_tenant_id' => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'microsoft_client_id' => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'microsoft_client_secret' => 'super-admin-secret-value',
        'microsoft_mailbox' => 'ricardo@gateway-ds.com',
    ]);

    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response([
            'access_token' => 'graph-token',
            'expires_in' => 3600,
        ], 200),
        'https://graph.microsoft.com/*' => Http::response('', 202),
    ]);

    app(MicrosoftGraphMailService::class)
        ->actingAs($admin)
        ->sendText('ricardo@gateway-ds.com', 'melissa@gateway-ds.com', 'Review', 'Please review.');

    Http::assertSent(function ($request) {
        return $request->url() === 'https://login.microsoftonline.com/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/oauth2/v2.0/token'
            && $request['client_id'] === 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
            && $request['client_secret'] === 'super-admin-secret-value';
    });
});

test('impersonating a super admin without app credentials uses the master app on that mailbox', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $master = User::factory()->create([
        'level_id' => $level->id,
        'role' => 'super_admin',
        'microsoft_tenant_id' => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'microsoft_client_id' => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'microsoft_client_secret' => 'master-secret-value',
    ]);
    $master->forceFill(['is_master' => true])->save();

    $larry = User::factory()->create([
        'level_id' => $level->id,
        'role' => 'super_admin',
        'microsoft_mailbox' => 'larryd@gateway-ds.com',
    ]);

    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response([
            'access_token' => 'graph-token',
            'expires_in' => 3600,
        ], 200),
        'https://graph.microsoft.com/*' => Http::response(['value' => []], 200),
    ]);

    session(['impersonator_id' => $master->id]);

    app(MicrosoftGraphMailService::class)
        ->actingAs($larry)
        ->listFolder('larryd@gateway-ds.com', 'inbox');

    Http::assertSent(function ($request) {
        return $request->url() === 'https://login.microsoftonline.com/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/oauth2/v2.0/token'
            && $request['client_id'] === 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
            && $request['client_secret'] === 'master-secret-value';
    });

    Http::assertSent(function ($request) {
        return str_contains($request->url(), '/users/'.rawurlencode('larryd@gateway-ds.com').'/mailFolders/inbox/messages');
    });
});
