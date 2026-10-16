<?php

use App\Exceptions\MicrosoftGraphException;
use App\Models\MailSavedRecipient;
use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Support\Facades\Queue;
use App\Models\UserLevel;
use Illuminate\Http\UploadedFile;
use App\Services\MicrosoftGraphMailService;
use App\Support\EmailPlainText;
use App\Services\MicrosoftGraphPageCursor;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function savedMailboxMessage($request, string $mailbox): bool
{
    $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

    return $request->method() === 'POST'
        && str_ends_with($path, '/users/'.$mailbox.'/messages');
}

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

        $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

        if ($request->method() === 'POST' && str_ends_with($path, '/messages')) {
            return Http::response(['id' => 'draft-1'], 201);
        }

        if ($request->method() === 'POST' && str_ends_with($path, '/send')) {
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

    Http::fake();

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Hello',
            'body' => 'Message',
            'mailbox' => 'sales@gateway-ds.com',
            'from' => 'larryd@gateway-ds.com',
            'sender' => 'larryd@gateway-ds.com',
        ])
        ->assertSessionHasErrors('body');

    Http::assertNothingSent();

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
        if (! savedMailboxMessage($request, 'ricardo@gateway-ds.com')) {
            return false;
        }

        $message = $request->data();

        return ! array_key_exists('from', $message)
            && ! array_key_exists('sender', $message)
            && $message['body']['content'] === 'The opening is ready.';
    });

    Http::assertSent(fn ($request) => str_contains($request->url(), '/messages/'.rawurlencode('draft-1').'/send'));

    Http::assertNotSent(function ($request) {
        return str_contains($request->url(), rawurlencode('sales@gateway-ds.com'));
    });
});

test('larry sends from larry mailbox and melissa sends from sales mailbox', function () {
    $larry = mailboxUser('larryd@gateway-ds.com');
    $larry->forceFill(['name' => 'Larry Deminski'])->save();
    $melissa = mailboxUser('sales@gateway-ds.com');
    $melissa->forceFill(['name' => 'Melissa'])->save();
    fakeMailboxGraph();

    $this->actingAs($larry)
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'From Larry',
            'body' => 'Larry mailbox.',
            'mailbox' => 'sales@gateway-ds.com',
            'from' => 'sales@gateway-ds.com',
        ])
        ->assertRedirect();

    $this->actingAs($melissa)
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'From Melissa',
            'body' => 'Sales mailbox.',
            'mailbox' => 'larryd@gateway-ds.com',
            'from' => 'larryd@gateway-ds.com',
            'sender' => 'larryd@gateway-ds.com',
        ])
        ->assertRedirect();

    $sent = collect(Http::recorded())
        ->map(fn (array $pair) => rawurldecode($pair[0]->url()))
        ->filter(fn (string $url) => str_ends_with((string) (parse_url($url, PHP_URL_PATH) ?? ''), '/messages'))
        ->values();

    expect($sent)->toHaveCount(2)
        ->and($sent[0])->toContain('/users/larryd@gateway-ds.com/messages')
        ->and($sent[1])->toContain('/users/sales@gateway-ds.com/messages');
});

test('an administrator impersonating melissa sends through her mailbox', function () {
    Queue::fake();
    $master = mailboxUser('ricardo@gateway-ds.com');
    $master->forceFill(['is_master' => true, 'role' => 'super_admin'])->save();
    $melissa = mailboxUser('sales@gateway-ds.com');
    $melissa->forceFill(['name' => 'Melissa'])->save();
    fakeMailboxGraph();

    $this->actingAs($master)
        ->post(route('admin.users.impersonate', $melissa))
        ->assertRedirect(route('mailbox.index'));

    $this->assertAuthenticatedAs($melissa);

    $this->post(route('mailbox.send'), [
        'to' => 'buyer@example.com',
        'subject' => 'While signed in as Melissa',
        'body' => 'This must leave the sales mailbox.',
        'mailbox' => 'larryd@gateway-ds.com',
        'from' => 'larryd@gateway-ds.com',
        'sender' => 'larryd@gateway-ds.com',
    ])->assertRedirect(route('mailbox.index', ['folder' => 'sent']));

    Http::assertSent(function ($request) {
        if (! savedMailboxMessage($request, 'sales@gateway-ds.com')) {
            return false;
        }

        $message = $request->data();

        return ! array_key_exists('from', $message)
            && ! array_key_exists('sender', $message)
            && str_contains($message['body']['content'], 'This must leave the sales mailbox.');
    });

    Http::assertNotSent(fn ($request) => str_contains(rawurldecode($request->url()), '/users/larryd@gateway-ds.com/'));

    $activity = UserActivity::query()->where('action', 'send_mailbox_message')->first();

    expect($activity)->not->toBeNull()
        ->and($activity->user_id)->toBe($melissa->id)
        ->and($activity->metadata['effective_user_id'])->toBe($melissa->id)
        ->and($activity->metadata['impersonator_id'])->toBe($master->id)
        ->and($activity->metadata['mailbox'])->toBe('sales@gateway-ds.com')
        ->and($activity->metadata)->not->toHaveKey('body')
        ->and(json_encode($activity->metadata))->not->toContain('client_secret');

    Queue::assertNothingPushed();
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

test('a composed message can include copies, importance, an attachment, and saved recipients', function () {
    $user = mailboxUser();
    fakeMailboxGraph();

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com, sales@gateway-ds.com',
            'cc' => 'melissa@gateway-ds.com',
            'bcc' => 'larryd@gateway-ds.com',
            'subject' => 'Project update',
            'body' => '<p>The <strong>opening</strong> is ready.</p>',
            'importance' => 'high',
            'save_recipients' => true,
            'attachments' => [
                UploadedFile::fake()->create('note.pdf', 20, 'application/pdf'),
            ],
        ])
        ->assertRedirect(route('mailbox.index', ['folder' => 'sent']))
        ->assertSessionHas('success');

    Http::assertSent(function ($request) {
        if (! savedMailboxMessage($request, 'ricardo@gateway-ds.com')) {
            return false;
        }

        $message = $request->data();

        return $message['importance'] === 'high'
            && $message['body']['contentType'] === 'HTML'
            && str_contains($message['body']['content'], 'opening')
            && $message['toRecipients'][1]['emailAddress']['address'] === 'sales@gateway-ds.com'
            && $message['ccRecipients'][0]['emailAddress']['address'] === 'melissa@gateway-ds.com'
            && $message['bccRecipients'][0]['emailAddress']['address'] === 'larryd@gateway-ds.com'
            && $message['attachments'][0]['name'] === 'note.pdf';
    });

    expect(MailSavedRecipient::query()->where('user_id', $user->id)->pluck('email')->all())
        ->toEqualCanonicalizing([
            'buyer@example.com',
            'sales@gateway-ds.com',
            'melissa@gateway-ds.com',
            'larryd@gateway-ds.com',
        ]);

    $this->actingAs($user)
        ->delete(route('mailbox.recipients.destroy', MailSavedRecipient::query()->first()))
        ->assertRedirect();

    expect(MailSavedRecipient::query()->where('user_id', $user->id)->count())->toBe(3);
});

test('opening an inbox message marks that email as read', function () {
    $user = mailboxUser();
    fakeMailboxGraph();

    $this->actingAs($user)
        ->get(route('mailbox.index', [
            'folder' => 'inbox',
            'message' => EmailPlainText::encodeMessageId('msg-1'),
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('messages.0.is_read', true)
        );

    Http::assertSent(function ($request) {
        return $request->method() === 'PATCH'
            && str_contains($request->url(), '/messages/'.rawurlencode('msg-1'))
            && $request['isRead'] === true;
    });
});

test('read state stays cleared when microsoft 365 rejects the read update', function () {
    $user = mailboxUser();
    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
    ]);

    Http::fake(function ($request) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response(['access_token' => 'graph-token', 'expires_in' => 3600]);
        }

        if ($request->method() === 'PATCH') {
            return Http::response(['error' => ['message' => 'Access is denied']], 403);
        }

        if (str_contains($request->url(), 'unreadItemCount')) {
            return Http::response(['unreadItemCount' => 1]);
        }

        if (preg_match('#/messages/[^?]+#', $request->url()) === 1) {
            return Http::response([
                'id' => 'msg-1',
                'subject' => 'Hello',
                'from' => ['emailAddress' => ['address' => 'buyer@example.com']],
                'toRecipients' => [],
                'body' => ['contentType' => 'text', 'content' => 'Hello'],
            ]);
        }

        return Http::response([
            'value' => [[
                'id' => 'msg-1',
                'subject' => 'Hello',
                'from' => ['emailAddress' => ['address' => 'buyer@example.com']],
                'toRecipients' => [],
                'bodyPreview' => 'Hello',
                'isRead' => false,
            ]],
        ]);
    });

    $token = EmailPlainText::encodeMessageId('msg-1');

    $this->actingAs($user)
        ->get(route('mailbox.index', ['folder' => 'inbox', 'message' => $token]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('messages.0.is_read', true)
            ->where('unreadCount', 0)
        );

    $this->actingAs($user)
        ->getJson(route('mailbox.unread'))
        ->assertOk()
        ->assertJson(['unread' => 0]);
});

test('a message can be marked unread and archived', function () {
    $user = mailboxUser();
    fakeMailboxGraph();
    $token = EmailPlainText::encodeMessageId('msg-1');

    $this->actingAs($user)
        ->patch(route('mailbox.state'), [
            'message' => $token,
            'is_read' => 0,
        ])
        ->assertRedirect();

    Http::assertSent(fn ($request) => $request->method() === 'PATCH' && $request['isRead'] === false);

    $this->actingAs($user)
        ->post(route('mailbox.archive'), [
            'message' => $token,
            'archived' => 1,
        ])
        ->assertRedirect(route('mailbox.index', ['folder' => 'inbox']));

    Http::assertSent(fn ($request) => $request->method() === 'POST'
        && str_contains($request->url(), '/move')
        && ($request['destinationId'] ?? null) === 'archive');
});

test('outgoing mail includes the saved signature and header image', function () {
    Storage::fake('public');
    $user = mailboxUser();
    $user->mail_signature = "Ricardo Scarpim\nGateway Door Systems";
    $user->mail_header_path = 'mail-headers/header.png';
    $user->save();
    Storage::disk('public')->put($user->mail_header_path, 'header-bytes');
    fakeMailboxGraph();

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Project update',
            'body' => '<p>The opening is ready.</p>',
        ])
        ->assertRedirect();

    Http::assertSent(function ($request) {
        if (! savedMailboxMessage($request, 'ricardo@gateway-ds.com')) {
            return false;
        }

        $message = $request->data();
        $content = $message['body']['content'];
        $header = $message['attachments'][0];

        return $message['body']['contentType'] === 'HTML'
            && str_contains($content, 'cid:gateway-mail-header')
            && str_contains($content, 'The opening is ready.')
            && str_contains($content, 'Ricardo Scarpim')
            && str_contains($content, 'Gateway Door Systems')
            && $header['isInline'] === true
            && $header['contentId'] === 'gateway-mail-header'
            && ! isset($message['from'])
            && ! isset($message['sender']);
    });
});

test('the signed in mailbox reports how many emails are unread', function () {
    $user = mailboxUser('larryd@gateway-ds.com');

    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
    ]);

    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response([
            'access_token' => 'graph-token',
            'expires_in' => 3600,
        ]),
        'https://graph.microsoft.com/*' => Http::response([
            'unreadItemCount' => 3,
        ], 200),
    ]);

    $this->actingAs($user)
        ->getJson(route('mailbox.unread'))
        ->assertOk()
        ->assertJson(['unread' => 3]);

    $this->actingAs($user)
        ->getJson(route('mailbox.unread'))
        ->assertOk()
        ->assertJson(['unread' => 3]);

    Http::assertSentCount(2);
});

test('unread email count stays at zero when the user has no mailbox', function () {
    $user = mailboxUser(null);

    Http::fake();

    $this->actingAs($user)
        ->getJson(route('mailbox.unread'))
        ->assertOk()
        ->assertJson(['unread' => 0]);

    Http::assertNothingSent();
});
