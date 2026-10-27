<?php

use App\Exceptions\MicrosoftGraphException;
use App\Models\Employee;
use App\Models\MailSavedRecipient;
use App\Models\User;
use App\Models\UserActivity;
use App\Models\UserLevel;
use App\Services\MicrosoftGraphMailService;
use App\Services\MicrosoftGraphPageCursor;
use App\Support\EmailPlainText;
use App\Support\MailStationery;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function savedMailboxMessage($request, string $mailbox): bool
{
    $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

    return $request->method() === 'POST'
        && str_ends_with($path, '/users/'.$mailbox.'/sendMail');
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

        if ($request->method() === 'POST' && str_ends_with($path, '/sendMail')) {
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
                'ccRecipients' => [
                    ['emailAddress' => ['name' => 'Alex', 'address' => 'alex@example.com']],
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

test('an opened message shows the embedded picture and hides the content id', function () {
    $user = mailboxUser();
    $png = base64_encode('png-bytes');

    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
    ]);

    Http::fake(function ($request) use ($png) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response([
                'access_token' => 'graph-token',
                'expires_in' => 3600,
            ]);
        }

        $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

        if (str_ends_with($path, '/attachments')) {
            return Http::response([
                'value' => [[
                    'name' => 'signature.png',
                    'contentType' => 'image/png',
                    'isInline' => true,
                    'contentId' => 'ii_1a155d80b94df2917f02',
                    'size' => 9,
                    'contentBytes' => $png,
                ]],
            ]);
        }

        if (preg_match('#/messages/[^/]+$#', $path) === 1) {
            return Http::response([
                'id' => 'msg-1',
                'subject' => 'Hello',
                'from' => ['emailAddress' => ['address' => 'buyer@example.com']],
                'toRecipients' => [
                    ['emailAddress' => ['address' => 'ricardo@gateway-ds.com']],
                ],
                'body' => [
                    'contentType' => 'text',
                    'content' => "Thanks\n[cid:ii_1a155d80b94df2917f02]",
                ],
            ]);
        }

        return Http::response([
            'value' => [[
                'id' => 'msg-1',
                'subject' => 'Hello',
                'from' => ['emailAddress' => ['address' => 'buyer@example.com']],
                'bodyPreview' => '[cid:ii_1a155d80b94df2917f02]',
                'receivedDateTime' => '2026-10-15T15:00:00Z',
                'isRead' => true,
            ]],
        ]);
    });

    $this->actingAs($user)
        ->get(route('mailbox.index', [
            'message' => EmailPlainText::encodeMessageId('msg-1'),
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('message.body', 'Thanks')
            ->where('message.images.0.name', 'signature.png')
            ->where('message.images.0.src', 'data:image/png;base64,'.$png)
            ->where('messages.0.preview', '')
        );
});

test('an attached image can be opened from the signed-in mailbox', function () {
    $user = mailboxUser();
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', true);

    expect($png)->toBeString()->not->toBe('');

    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
    ]);

    Http::fake(function ($request) use ($png) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response([
                'access_token' => 'graph-token',
                'expires_in' => 3600,
            ]);
        }

        $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

        if (str_ends_with($path, '/attachments/file-1')) {
            return Http::response([
                '@odata.type' => '#microsoft.graph.fileAttachment',
                'id' => 'file-1',
                'name' => 'photo.png',
                'contentType' => 'image/png',
                'isInline' => false,
                'size' => strlen($png),
                'contentBytes' => base64_encode($png),
            ]);
        }

        if (str_ends_with($path, '/attachments')) {
            return Http::response([
                'value' => [[
                    '@odata.type' => '#microsoft.graph.fileAttachment',
                    'id' => 'file-1',
                    'name' => 'photo.png',
                    'contentType' => 'image/png',
                    'isInline' => false,
                    'size' => strlen($png),
                ]],
            ]);
        }

        if (preg_match('#/messages/[^/]+$#', $path) === 1) {
            return Http::response([
                'id' => 'msg-1',
                'subject' => 'Site photo',
                'from' => ['emailAddress' => ['address' => 'buyer@example.com']],
                'toRecipients' => [
                    ['emailAddress' => ['address' => 'ricardo@gateway-ds.com']],
                ],
                'body' => [
                    'contentType' => 'text',
                    'content' => 'See the attached photo.',
                ],
            ]);
        }

        return Http::response([
            'value' => [[
                'id' => 'msg-1',
                'subject' => 'Site photo',
                'from' => ['emailAddress' => ['address' => 'buyer@example.com']],
                'bodyPreview' => 'See the attached photo.',
                'receivedDateTime' => '2026-10-15T15:00:00Z',
                'isRead' => true,
            ]],
        ]);
    });

    $message = EmailPlainText::encodeMessageId('msg-1');

    $this->actingAs($user)
        ->get(route('mailbox.index', ['message' => $message]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('message.attachments.0.name', 'photo.png')
            ->where('message.attachments.0.image', true)
            ->where('message.images', [])
        );

    $this->actingAs($user)
        ->get(route('mailbox.attachment', [
            'message' => $message,
            'attachment' => EmailPlainText::encodeMessageId('file-1'),
        ]))
        ->assertOk()
        ->assertHeader('content-type', 'image/png')
        ->assertHeader('content-disposition', 'inline; filename="photo.png"')
        ->assertHeader('x-content-type-options', 'nosniff');

    $this->actingAs($user)
        ->get(route('mailbox.attachment', [
            'message' => $message,
            'attachment' => EmailPlainText::encodeMessageId('file-1'),
            'download' => 1,
        ]))
        ->assertOk()
        ->assertHeader('content-disposition', 'attachment; filename="photo.png"');

    Http::assertSent(function ($request) {
        $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

        return str_contains($path, '/users/ricardo@gateway-ds.com/messages/msg-1/attachments/file-1');
    });
});

test('a long microsoft attachment id can still be opened', function () {
    $user = mailboxUser();
    $attachmentId = str_repeat('A', 300).'/'.str_repeat('B', 300);
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', true);

    expect($png)->toBeString()->not->toBe('');

    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
    ]);

    Http::fake(function ($request) use ($png, $attachmentId) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response([
                'access_token' => 'graph-token',
                'expires_in' => 3600,
            ]);
        }

        $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

        if (str_contains($path, '/attachments/'.$attachmentId)) {
            return Http::response([
                'id' => $attachmentId,
                'name' => 'site.jpg',
                'contentType' => 'image/jpeg',
                'contentBytes' => base64_encode($png),
            ]);
        }

        if (str_ends_with($path, '/attachments')) {
            return Http::response([
                'value' => [[
                    'id' => $attachmentId,
                    'name' => 'site.jpg',
                    'contentType' => 'image/jpeg',
                    'isInline' => false,
                    'size' => strlen((string) $png),
                ]],
            ]);
        }

        if (preg_match('#/messages/[^/]+$#', $path) === 1) {
            return Http::response([
                'id' => 'msg-1',
                'subject' => 'Photo',
                'hasAttachments' => true,
                'from' => ['emailAddress' => ['address' => 'buyer@example.com']],
                'toRecipients' => [],
                'body' => ['contentType' => 'text', 'content' => 'Photo attached.'],
            ]);
        }

        return Http::response(['value' => []]);
    });

    $this->actingAs($user)
        ->get(route('mailbox.index', [
            'message' => EmailPlainText::encodeMessageId('msg-1'),
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('message.attachments.0.name', 'site.jpg')
            ->where('message.attachments.0.image', true)
            ->where('message.has_attachments', true)
        );

    $this->actingAs($user)
        ->get(route('mailbox.attachment', [
            'message' => EmailPlainText::encodeMessageId('msg-1'),
            'attachment' => EmailPlainText::encodeMessageId($attachmentId),
        ]))
        ->assertOk()
        ->assertHeader('content-type', 'image/png');
});

test('guests cannot open the mailbox', function () {
    $this->get(route('mailbox.index'))->assertRedirect(route('login'));
    $this->get(route('mailbox.attachment', [
        'message' => EmailPlainText::encodeMessageId('msg-1'),
        'attachment' => EmailPlainText::encodeMessageId('file-1'),
    ]))->assertRedirect(route('login'));
    $this->post(route('mailbox.send'), [
        'to' => 'buyer@example.com',
        'subject' => 'Hello',
        'body' => 'Message',
    ])->assertRedirect(route('login'));

    $this->put(route('mailbox.header.size'), ['width' => 50])->assertRedirect(route('login'));
    $this->put(route('mailbox.footer'), ['colors' => []])->assertRedirect(route('login'));
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

    $this->actingAs($user)
        ->get(route('mailbox.attachment', [
            'message' => EmailPlainText::encodeMessageId('msg-1'),
            'attachment' => EmailPlainText::encodeMessageId('file-1'),
        ]))
        ->assertForbidden();
});

test('a reply address can include the sender name', function () {
    $user = mailboxUser('ricardo@gateway-ds.com');
    fakeMailboxGraph();

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'Buyer <buyer@example.com>',
            'subject' => 'Re: Project update',
            'body' => 'Thanks for the note.',
        ])
        ->assertRedirect(route('mailbox.index', ['folder' => 'sent']))
        ->assertSessionHas('success');

    Http::assertSent(function ($request) {
        if (! savedMailboxMessage($request, 'ricardo@gateway-ds.com')) {
            return false;
        }

        $recipient = $request->data()['message']['toRecipients'][0]['emailAddress']['address'] ?? null;

        return $recipient === 'buyer@example.com';
    });
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

        $payload = $request->data();
        $message = $payload['message'];

        return $payload['saveToSentItems'] === true
            && ! array_key_exists('from', $message)
            && ! array_key_exists('sender', $message)
            && str_contains($message['body']['content'], 'The opening is ready.');
    });

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
        ->filter(fn (string $url) => str_ends_with((string) (parse_url($url, PHP_URL_PATH) ?? ''), '/sendMail'))
        ->values();

    expect($sent)->toHaveCount(2)
        ->and($sent[0])->toContain('/users/larryd@gateway-ds.com/sendMail')
        ->and($sent[1])->toContain('/users/sales@gateway-ds.com/sendMail');
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

        $message = $request->data()['message'];

        return ($request->data()['saveToSentItems'] ?? false) === true
            && ! array_key_exists('from', $message)
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

test('a message must contain at least 8 characters', function () {
    $user = mailboxUser();
    fakeMailboxGraph();

    $this->actingAs($user)
        ->from(route('mailbox.index'))
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Short note',
            'body' => 'Hello',
        ])
        ->assertRedirect(route('mailbox.index'))
        ->assertSessionHasErrors('body');

    $this->actingAs($user)
        ->from(route('mailbox.index'))
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Short reply',
            'body' => '<p>Hi</p><hr><p>On Monday, Buyer wrote:</p><blockquote><p>This original message is much longer than eight characters.</p></blockquote>',
        ])
        ->assertRedirect(route('mailbox.index'))
        ->assertSessionHasErrors('body');

    Http::assertNothingSent();

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Long enough',
            'body' => 'Hello yo',
        ])
        ->assertRedirect(route('mailbox.index', ['folder' => 'sent']))
        ->assertSessionHas('success');
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
            ->where('message.cc.0', 'Alex <alex@example.com>')
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

test('a message that cannot be opened leaves the rest of the folder on screen', function () {
    $user = mailboxUser();
    Cache::flush();
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
        'services.microsoft.mail_from' => 'sales@gateway-ds.com',
    ]);

    Http::fake(function ($request) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response([
                'access_token' => 'graph-token',
                'expires_in' => 3600,
            ]);
        }

        $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

        if (preg_match('#/messages/[^/?]+$#', $path) === 1) {
            return Http::response(['error' => ['message' => 'ErrorItemNotFound']], 500);
        }

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
            'unreadItemCount' => 1,
        ]);
    });

    $this->actingAs($user)
        ->get(route('mailbox.index', ['message' => EmailPlainText::encodeMessageId('msg-1')]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('messages.0.subject', 'Hello')
            ->where('message', null)
            ->where('graphError', fn ($error) => is_string($error) && $error !== '')
        );
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

    expect(fn () => $cursors->assertLink(
        'https://graph.microsoft.com/v1.0/users/'.rawurlencode('ricardo@gateway-ds.com').'/mailFolders/sentitems/messages',
        'ricardo@gateway-ds.com',
        'inbox',
    ))->toThrow(MicrosoftGraphException::class);

    $folderId = 'AAMkAGI2THVSAAA=';
    $folderLink = 'https://graph.microsoft.com/v1.0/users/'.rawurlencode('ricardo@gateway-ds.com').'/mailFolders/'.rawurlencode($folderId).'/messages?$skip=25';

    expect($cursors->store(4, 'ricardo@gateway-ds.com', 'sent', $folderLink))->toBeString();

    expect($cursors->store(
        4,
        'ricardo@gateway-ds.com',
        'inbox',
        "https://graph.microsoft.com/v1.0/users('ricardo@gateway-ds.com')/mailFolders('".$folderId."')/messages?%24skip=25",
    ))->toBeString();

    $user = mailboxUser();
    fakeMailboxGraph(['nextLink' => $folderLink]);

    $this->actingAs($user)
        ->get(route('mailbox.index', ['folder' => 'sent']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('folder', 'sent')
            ->where('messages.0.subject', 'Hello')
            ->where('nextCursor', fn ($cursor) => is_string($cursor) && $cursor !== '')
        );

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

test('reply all drops this mailbox and keeps a name that contains a comma', function () {
    $user = mailboxUser();
    fakeMailboxGraph();

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'Doe, Jane <jane@example.com>',
            'cc' => 'ricardo@gateway-ds.com, jane@example.com, Bob Smith <bob@example.com>',
            'subject' => 'Re: Project update',
            'body' => '<p>Replying to everyone on this thread.</p>',
        ])
        ->assertRedirect(route('mailbox.index', ['folder' => 'sent']))
        ->assertSessionHas('success');

    Http::assertSent(function ($request) {
        if (! savedMailboxMessage($request, 'ricardo@gateway-ds.com')) {
            return false;
        }

        $message = $request->data()['message'];
        $to = array_column(array_column($message['toRecipients'], 'emailAddress'), 'address');
        $cc = array_column(array_column($message['ccRecipients'] ?? [], 'emailAddress'), 'address');

        return $to === ['jane@example.com']
            && $cc === ['bob@example.com'];
    });
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

        $message = $request->data()['message'];

        return ($request->data()['saveToSentItems'] ?? false) === true
            && $message['importance'] === 'high'
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

test('outgoing mail writes the signature into the message and does not attach a logo', function () {
    Storage::fake('public');
    $user = mailboxUser();
    $user->mail_signature = "Ricardo Scarpim\nGateway Door Systems";
    $user->mail_header_path = 'mail-headers/header.png';
    $user->mail_header_width = 40;
    $user->mail_footer_colors = ['#047857', '#b45309'];
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

        $message = $request->data()['message'];
        $content = $message['body']['content'];

        return $message['body']['contentType'] === 'HTML'
            && ! str_contains($content, 'cid:gateway-mail-header')
            && str_contains($content, 'Gateway_Door_Systems_Logo.png')
            && str_contains($content, 'alt="Gateway Door Systems"')
            && ! isset($message['attachments'])
            && str_contains($content, 'The opening is ready.')
            && str_contains($content, 'Ricardo Scarpim')
            && str_contains($content, 'Gateway Door Systems')
            && str_contains($content, '<!DOCTYPE html>')
            && str_contains($content, 'bgcolor="#047857"')
            && str_contains($content, 'bgcolor="#b45309"')
            && ! isset($message['from'])
            && ! isset($message['sender']);
    });
});

test('saved stationery is part of the message and a placed signature is not added twice', function () {
    $user = mailboxUser();
    fakeMailboxGraph();

    $this->actingAs($user)
        ->put(route('mailbox.stationery'), [
            'header' => '<p>Project desk</p><img src="https://example.test/logo.png" alt="Gateway"><img src="'.asset('images/Gateway_Door_Systems_Logo.png').'" alt="Gateway Door Systems">',
            'footer' => '<p>Sent from the project desk</p>',
            'signatures' => [[
                'id' => 'ricardo',
                'name' => 'Ricardo',
                'html' => '<p>Ricardo Scarpim<br>Estimator</p><script>alert(1)</script>',
            ]],
            'new_signature_id' => 'ricardo',
            'reply_signature_id' => 'ricardo',
        ])
        ->assertRedirect();

    $stored = $user->fresh()->mail_stationery;
    expect($stored['header'])->toContain('Project desk')
        ->and($stored['header'])->toContain('Gateway_Door_Systems_Logo.png')
        ->and($stored['header'])->not->toContain('example.test')
        ->and($stored['signatures'][0]['html'])->not->toContain('<script')
        ->and($stored['signatures'][0]['html'])->toContain('Estimator');

    $this->actingAs($user)
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Project update',
            'body' => '<div data-gateway-mail="letter"><p>The opening is ready.</p><div data-mail-section="signature"><p>Ricardo Scarpim</p></div></div>',
        ])
        ->assertRedirect();

    Http::assertSent(function ($request) {
        if (! savedMailboxMessage($request, 'ricardo@gateway-ds.com')) {
            return false;
        }

        $content = $request->data()['message']['body']['content'];

        return substr_count($content, 'Ricardo Scarpim') === 1
            && ! str_contains($content, 'Project desk')
            && ! isset($request->data()['message']['attachments']);
    });
});

test('a super admin gets one logo header and a signature with name, phone, and position', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $user = mailboxUser();
    $user->forceFill([
        'name' => 'Ricardo Scarpim',
        'role' => 'super_admin',
        'level_id' => $level->id,
    ])->save();
    Employee::query()->create([
        'first_name' => 'Ricardo',
        'last_name' => 'Scarpim',
        'email' => 'ricardo-staff-'.$user->id.'@gateway-ds.com',
        'phone_number' => '305-555-0100',
        'job_title' => 'Estimator',
        'user_id' => $user->id,
    ]);

    $stationery = app(MailStationery::class);
    $payload = $stationery->payload($user->fresh());

    expect($payload['header'])->toContain('Gateway_Door_Systems_Logo.png')
        ->and($payload['header'])->not->toContain('>Gateway Door Systems<')
        ->and($payload['footer'])->toBe('')
        ->and($payload['signatures'][0]['html'])->toContain('Ricardo Scarpim')
        ->and($payload['signatures'][0]['html'])->toContain('305-555-0100')
        ->and($payload['signatures'][0]['html'])->toContain('Estimator')
        ->and($user->fresh()->mail_stationery['header'])->toContain('Gateway_Door_Systems_Logo.png');

    $composed = $stationery->compose(
        $user->fresh(),
        '<p>The opening is ready.</p><p><img src="'.$stationery->logoUrl().'" alt="Gateway Door Systems"></p><p><strong>Ricardo Scarpim</strong><br>305-555-0100<br>Estimator</p>',
        'HTML',
        [],
    );
    $content = $composed['content'];

    expect(substr_count($content, 'Gateway_Door_Systems_Logo.png'))->toBe(1)
        ->and(substr_count($content, 'Ricardo Scarpim'))->toBe(1)
        ->and(substr_count($content, 'Estimator'))->toBe(1)
        ->and($content)->not->toContain('data-mail-section="footer"');
});

test('header size and footer color boxes are saved for later messages', function () {
    $user = mailboxUser();

    $this->actingAs($user)
        ->put(route('mailbox.header.size'), ['width' => 40])
        ->assertRedirect();

    $this->actingAs($user)
        ->put(route('mailbox.footer'), ['colors' => ['#047857', '#B45309']])
        ->assertRedirect();

    $fresh = $user->fresh();

    expect($fresh->mail_header_width)->toBe(40)
        ->and($fresh->mailFooterColors())->toBe(['#047857', '#b45309']);

    $this->actingAs($user)
        ->put(route('mailbox.footer'), ['colors' => ['not-a-color']])
        ->assertSessionHasErrors('colors.0');

    $this->actingAs($user)
        ->put(route('mailbox.header.size'), ['width' => 10])
        ->assertSessionHasErrors('width');

    expect($user->fresh()->mail_header_width)->toBe(40)
        ->and($user->fresh()->mailFooterColors())->toBe(['#047857', '#b45309']);

    $this->actingAs($user)
        ->put(route('mailbox.footer'), ['colors' => []])
        ->assertRedirect();

    expect($user->fresh()->mail_footer_colors)->toBeNull();
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
        ->assertJson(['unread' => 3, 'messages' => []]);

    $this->actingAs($user)
        ->getJson(route('mailbox.unread'))
        ->assertOk()
        ->assertJson(['unread' => 3, 'messages' => []]);

    Http::assertSentCount(3);
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

test('an unread inbox message keeps the mail count when the badge cache is empty', function () {
    $user = mailboxUser();
    fakeMailboxGraph();
    Cache::put('mailbox-unread:'.$user->id.':ricardo@gateway-ds.com', [
        'unread' => 0,
        'messages' => [],
    ], 60);

    $this->actingAs($user)
        ->get(route('mailbox.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('messages.0.is_read', false)
            ->where('unreadCount', 1)
        );
});

test('unread mail includes the message that can be opened', function () {
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

        if (str_contains($request->url(), 'unreadItemCount')) {
            return Http::response(['unreadItemCount' => 1]);
        }

        return Http::response([
            'value' => [[
                'id' => 'msg-1',
                'subject' => 'Opening schedule',
                'from' => ['emailAddress' => ['name' => 'Buyer', 'address' => 'buyer@example.com']],
                'bodyPreview' => 'The dock is ready.',
                'isRead' => false,
                'receivedDateTime' => '2026-10-16T18:00:00Z',
            ]],
        ]);
    });

    $this->actingAs($user)
        ->getJson(route('mailbox.unread'))
        ->assertOk()
        ->assertJsonPath('unread', 1)
        ->assertJsonPath('messages.0.subject', 'Opening schedule')
        ->assertJsonPath('messages.0.from', 'Buyer <buyer@example.com>')
        ->assertJsonPath('messages.0.id', EmailPlainText::encodeMessageId('msg-1'));
});

test('checking for unread mail does not block sending', function () {
    fakeMailboxGraph();
    $user = mailboxUser();

    $this->actingAs($user);

    foreach (range(1, 8) as $ignored) {
        $this->getJson(route('mailbox.unread'))->assertOk();
    }

    $this->post(route('mailbox.send'), [
        'to' => 'buyer@example.com',
        'subject' => 'Hello',
        'body' => '<p>The opening is ready.</p>',
    ])->assertRedirect(route('mailbox.index', ['folder' => 'sent']));
});

test('sending too many messages stays on the form', function () {
    fakeMailboxGraph();
    $user = mailboxUser();

    $this->actingAs($user);

    foreach (range(1, 20) as $ignored) {
        $this->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Hello',
            'body' => '<p>The opening is ready.</p>',
        ])->assertRedirect(route('mailbox.index', ['folder' => 'sent']));
    }

    $this->from(route('mailbox.index'))
        ->post(route('mailbox.send'), [
            'to' => 'buyer@example.com',
            'subject' => 'Hello',
            'body' => '<p>The opening is ready.</p>',
        ])
        ->assertRedirect(route('mailbox.index'))
        ->assertSessionHasErrors('body');
});
