<?php

use App\Exceptions\MicrosoftGraphException;
use App\Models\User;
use App\Models\UserLevel;
use App\Services\MicrosoftGraphMailService;
use App\Services\MicrosoftGraphPageCursor;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

function mailboxUser(?string $mailbox = 'ricardo@gateway-ds.com'): User
{
    return User::factory()->create([
        'microsoft_mailbox' => $mailbox,
    ]);
}

function fakeMailboxGraph(array $pages = []): void
{
    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
        'services.microsoft.mail_from' => 'sales@gateway-ds.com',
        'services.microsoft.mail_from_name' => 'Gateway Door Systems',
    ]);

    Http::fake(function ($request) use ($pages) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response([
                'access_token' => 'graph-token',
                'expires_in' => 3600,
            ]);
        }

        if (str_contains($request->url(), '/sendMail')) {
            return Http::response('', 202);
        }

        if (preg_match('#/messages/[^?]+#', $request->url()) === 1) {
            return Http::response([
                'id' => 'msg-1',
                'subject' => 'Hello',
                'from' => ['emailAddress' => ['name' => 'Buyer', 'address' => 'buyer@example.com']],
                'toRecipients' => [
                    ['emailAddress' => ['address' => 'ricardo@gateway-ds.com']],
                ],
                'receivedDateTime' => '2026-10-15T15:00:00Z',
                'body' => [
                    'contentType' => 'html',
                    'content' => '<img src="https://evil.test/pixel.gif"><script>alert(1)</script><p>Hello &amp; welcome</p>',
                ],
            ]);
        }

        $next = $pages['nextLink'] ?? null;

        return Http::response([
            'value' => [[
                'id' => 'msg-1',
                'subject' => 'Hello',
                'from' => ['emailAddress' => ['name' => 'Buyer', 'address' => 'buyer@example.com']],
                'toRecipients' => [],
                'bodyPreview' => 'Preview text',
                'receivedDateTime' => '2026-10-15T15:00:00Z',
                'isRead' => false,
            ]],
            '@odata.nextLink' => $next,
        ]);
    });
}

test('guests cannot open the mailbox', function () {
    $this->get(route('mailbox.index'))->assertRedirect(route('login'));
    $this->post(route('mailbox.send'), [
        'to' => 'buyer@example.com',
        'subject' => 'Hello',
        'body' => 'Message',
    ])->assertRedirect(route('login'));
});

test('a user without a mailbox cannot read or send mail', function () {
    $user = mailboxUser(null);

    $this->actingAs($user)
        ->get(route('mailbox.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Email/Index')
            ->where('mailbox', null)
        );

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Hello',
            'body' => 'Message',
            'mailbox' => 'sales@gateway-ds.com',
        ])
        ->assertForbidden();

    $this->actingAs($user)
        ->get(route('mailbox.index', ['message' => 'abc']))
        ->assertForbidden();
});

test('mail requests use the signed-in user mailbox and ignore a submitted sender', function () {
    $user = mailboxUser('ricardo@gateway-ds.com');
    $other = mailboxUser('sales@gateway-ds.com');
    fakeMailboxGraph();

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Project update',
            'body' => 'The opening is ready.',
            'mailbox' => 'sales@gateway-ds.com',
            'user_id' => $other->id,
        ])
        ->assertRedirect(route('mailbox.index', ['folder' => 'sent']))
        ->assertSessionHas('success');

    Http::assertSent(function ($request) {
        return $request->url() === 'https://graph.microsoft.com/v1.0/users/'.rawurlencode('ricardo@gateway-ds.com').'/sendMail'
            && $request->data()['message']['from']['emailAddress']['address'] === 'ricardo@gateway-ds.com'
            && $request->data()['saveToSentItems'] === true;
    });

    Http::assertNotSent(function ($request) {
        return str_contains($request->url(), rawurlencode('sales@gateway-ds.com'));
    });
});

test('a super admin still sends from their own assigned mailbox', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $user = mailboxUser('larryd@gateway-ds.com');
    $user->forceFill(['level_id' => $level->id])->save();
    fakeMailboxGraph();

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'From Larry',
            'body' => 'Checking the mailbox.',
            'mailbox' => 'sales@gateway-ds.com',
        ])
        ->assertRedirect();

    Http::assertSent(fn ($request) => str_contains(
        $request->url(),
        rawurlencode('larryd@gateway-ds.com'),
    ));
});

test('invalid mail is rejected before microsoft is contacted', function () {
    $user = mailboxUser();
    fakeMailboxGraph();

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'not-an-email',
            'subject' => str_repeat('a', 300),
            'body' => '',
        ])
        ->assertSessionHasErrors(['to', 'subject', 'body']);

    Http::assertNothingSent();
});

test('a graph send rejection is not treated as sent', function () {
    $user = mailboxUser();

    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
        'services.microsoft.mail_from' => 'sales@gateway-ds.com',
    ]);

    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response([
            'access_token' => 'graph-token',
            'expires_in' => 3600,
        ]),
        'https://graph.microsoft.com/*' => Http::response([
            'error' => ['message' => 'ErrorSendAsDenied'],
        ], 400),
    ]);

    $this->actingAs($user)
        ->from(route('mailbox.index'))
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Project update',
            'body' => 'The opening is ready.',
        ])
        ->assertRedirect(route('mailbox.index'))
        ->assertSessionHasErrors('body')
        ->assertSessionMissing('success');
});

test('incoming mail is shown as plain text and pagination stays on the graph mailbox link', function () {
    $user = mailboxUser();
    $next = 'https://graph.microsoft.com/v1.0/users/'.rawurlencode('ricardo@gateway-ds.com').'/mailFolders/inbox/messages?$skiptoken=page-2';
    fakeMailboxGraph(['nextLink' => $next]);

    $cursor = null;
    $messageId = null;

    $this->actingAs($user)
        ->get(route('mailbox.index'))
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$cursor, &$messageId) {
            $page->where('mailbox', 'ricardo@gateway-ds.com')
                ->where('messages.0.subject', 'Hello')
                ->where('messages.0.preview', 'Preview text');

            $props = $page->toArray()['props'];
            $cursor = $props['nextCursor'];
            $messageId = $props['messages'][0]['id'];
        });

    expect($cursor)->toBeString()->not->toBe($next);

    $this->actingAs($user)
        ->get(route('mailbox.index', ['message' => $messageId]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('message.body', 'Hello & welcome')
            ->where('message.body', fn ($body) => ! str_contains((string) $body, '<script')
                && ! str_contains((string) $body, '<img')
                && ! str_contains((string) $body, 'evil.test'))
        );

    $this->actingAs($user)
        ->get(route('mailbox.index', ['cursor' => $cursor]))
        ->assertOk();

    Http::assertSent(fn ($request) => $request->url() === $next);

    $this->actingAs($user)
        ->get(route('mailbox.index', ['cursor' => 'https://evil.example/inbox']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('graphError', fn ($error) => is_string($error) && $error !== ''));

    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'evil.example'));
});

test('a cursor cannot be exchanged for another mailbox or an arbitrary graph url', function () {
    $cursors = app(MicrosoftGraphPageCursor::class);

    expect(fn () => $cursors->assertLink('https://evil.example/steal', 'ricardo@gateway-ds.com', 'inbox'))
        ->toThrow(MicrosoftGraphException::class);

    expect(fn () => $cursors->assertLink(
        'https://graph.microsoft.com/v1.0/users/'.rawurlencode('sales@gateway-ds.com').'/mailFolders/inbox/messages',
        'ricardo@gateway-ds.com',
        'inbox',
    ))->toThrow(MicrosoftGraphException::class);

    $token = $cursors->store(
        4,
        'ricardo@gateway-ds.com',
        'inbox',
        'https://graph.microsoft.com/v1.0/users/'.rawurlencode('ricardo@gateway-ds.com').'/mailFolders/inbox/messages?$skiptoken=ok',
    );

    expect(fn () => $cursors->resolve(99, 'ricardo@gateway-ds.com', 'inbox', (string) $token))
        ->toThrow(MicrosoftGraphException::class);
});

test('mailbox assignment is explicit, unique, and not mass assignable', function () {
    $user = mailboxUser(null);
    $other = mailboxUser(null);

    $user->fill([
        'name' => 'Changed Name',
        'microsoft_mailbox' => 'sales@gateway-ds.com',
    ])->save();

    expect($user->fresh()->microsoft_mailbox)->toBeNull()
        ->and($user->fresh()->name)->toBe('Changed Name');

    $this->artisan('users:assign-mailbox', [
        'user' => 'name',
        'mailbox' => 'ricardo@gateway-ds.com',
    ])->assertFailed();

    $this->artisan('users:assign-mailbox', [
        'user' => (string) $user->id,
        'mailbox' => 'not-an-email',
    ])->assertFailed();

    $this->artisan('users:assign-mailbox', [
        'user' => (string) $user->id,
        'mailbox' => 'ricardo@gateway-ds.com',
    ])->assertSuccessful();

    $this->artisan('users:assign-mailbox', [
        'user' => (string) $user->id,
        'mailbox' => 'ricardo@gateway-ds.com',
    ])->assertSuccessful();

    expect($user->fresh()->microsoft_mailbox)->toBe('ricardo@gateway-ds.com')
        ->and($user->fresh()->email)->not->toBe('ricardo@gateway-ds.com');

    $this->artisan('users:assign-mailbox', [
        'user' => (string) $other->id,
        'mailbox' => 'ricardo@gateway-ds.com',
    ])->assertFailed();

    expect($other->fresh()->microsoft_mailbox)->toBeNull();
});

test('an uncertain graph send is not retried', function () {
    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
        'services.microsoft.mail_from' => 'sales@gateway-ds.com',
    ]);

    $sends = 0;

    Http::fake(function ($request) use (&$sends) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response([
                'access_token' => 'graph-token',
                'expires_in' => 3600,
            ]);
        }

        $sends++;

        throw new ConnectionException('timed out');
    });

    expect(fn () => app(MicrosoftGraphMailService::class)->send(
        'buyer@example.com',
        'Quote',
        '<p>Hello</p>',
    ))->toThrow(MicrosoftGraphException::class, 'not sent again');

    expect($sends)->toBe(1);
});
