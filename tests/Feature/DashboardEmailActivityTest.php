<?php

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Cache::flush();
    Carbon::setTestNow(Carbon::parse('2026-11-02 15:00:00', 'UTC'));
    config([
        'app.timezone' => 'UTC',
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
    ]);
});

afterEach(function () {
    Carbon::setTestNow();
});

function fakeEmailActivityGraph(array $inbox, array $sent): void
{
    Http::fake(function ($request) use ($inbox, $sent) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response(['access_token' => 'graph-token', 'expires_in' => 3600]);
        }

        $path = rawurldecode((string) parse_url($request->url(), PHP_URL_PATH));

        if (str_ends_with($path, '/mailFolders/sentitems/messages')) {
            return Http::response(['value' => $sent]);
        }

        if (str_ends_with($path, '/mailFolders/inbox/messages')) {
            return Http::response(['value' => $inbox]);
        }

        return Http::response([], 404);
    });
}

function inboxItem(string $at, string $from = 'buyer@example.com', string $subject = 'Hello'): array
{
    return [
        'receivedDateTime' => $at,
        'subject' => $subject,
        'from' => ['emailAddress' => ['address' => $from, 'name' => $from]],
    ];
}

test('email activity is deferred so the dashboard does not wait on microsoft 365', function () {
    Http::fake();
    $user = User::factory()->create(['microsoft_mailbox' => 'ricardo@gateway-ds.com']);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->missing('emailActivity'));

    Http::assertNothingSent();
});

test('dashboard summarizes received and sent email per day for the signed-in user', function () {
    fakeEmailActivityGraph(
        inbox: [
            inboxItem('2026-11-02T13:00:00Z'),
            inboxItem('2026-11-02T09:00:00Z'),
            inboxItem('2026-11-01T09:00:00Z'),
            inboxItem('2026-11-01T08:00:00Z', 'MAILER-DAEMON@outlook.com', 'Undeliverable: Quote'),
        ],
        sent: [
            ['sentDateTime' => '2026-11-02T10:00:00Z'],
            ['sentDateTime' => '2026-10-27T10:00:00Z'],
        ],
    );

    $user = User::factory()->create(['microsoft_mailbox' => 'Ricardo@Gateway-DS.com']);

    $this->actingAs($user)
        ->get(route('dashboard', ['emailRange' => 7]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->where('emailActivity.status', 'ok')
                ->where('emailActivity.mailbox', 'ricardo@gateway-ds.com')
                ->where('emailActivity.range', 7)
                ->has('emailActivity.days', 7)
                ->where('emailActivity.days.0.date', '2026-10-27')
                ->where('emailActivity.days.0.sent', 1)
                ->where('emailActivity.days.5.date', '2026-11-01')
                ->where('emailActivity.days.5.received', 1)
                ->where('emailActivity.days.6.date', '2026-11-02')
                ->where('emailActivity.days.6.received', 2)
                ->where('emailActivity.days.6.sent', 1)
                ->where('emailActivity.totals.received', 3)
                ->where('emailActivity.totals.sent', 2)));

    Http::assertSent(function ($request) {
        $path = rawurldecode((string) parse_url($request->url(), PHP_URL_PATH));
        parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);

        return str_ends_with($path, '/users/ricardo@gateway-ds.com/mailFolders/inbox/messages')
            && $query['$filter'] === 'receivedDateTime ge 2026-10-27T00:00:00Z';
    });
});

test('email activity reports when no mailbox is assigned', function () {
    Http::fake();
    $user = User::factory()->create(['microsoft_mailbox' => null]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->where('emailActivity.status', 'no_mailbox')
                ->where('emailActivity.range', 14)
                ->has('emailActivity.days', 14)));

    Http::assertNothingSent();
});

test('email activity shows a friendly error when microsoft 365 fails', function () {
    Http::fake(function ($request) {
        if (str_contains($request->url(), 'login.microsoftonline.com')) {
            return Http::response(['access_token' => 'graph-token', 'expires_in' => 3600]);
        }

        return Http::response(['error' => ['code' => 'ErrorAccessDenied']], 403);
    });

    $user = User::factory()->create(['microsoft_mailbox' => 'ricardo@gateway-ds.com']);

    $this->actingAs($user)
        ->get(route('dashboard', ['emailRange' => 999]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->where('emailActivity.status', 'error')
                ->where('emailActivity.range', 14)
                ->where('emailActivity.error', 'Microsoft 365 denied access to this mailbox (ErrorAccessDenied).')));
});
