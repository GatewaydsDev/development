<?php

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

test('reset password link screen can be rendered', function () {
    $response = $this->get('/forgot-password');

    $response->assertStatus(200);
});

test('reset password link can be requested', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPasswordNotification::class);
});

test('reset password link requires an existing user email', function () {
    Notification::fake();

    $response = $this->post('/forgot-password', [
        'email' => 'missing@example.com',
    ]);

    $response->assertSessionHasErrors('email');

    Notification::assertNothingSent();
});

test('reset password screen can be rendered', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) use ($user) {
        $response = $this->get('/reset-password/'.$notification->token.'?email='.urlencode($user->email));

        $response->assertStatus(200);

        return true;
    });
});

test('reset password screen rejects invalid or mismatched tokens', function () {
    Notification::fake();

    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) use ($otherUser) {
        $this
            ->get('/reset-password/'.$notification->token.'?email='.urlencode($otherUser->email))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Auth/ResetLinkInvalid'));

        $this
            ->get('/reset-password/not-a-valid-token?email='.urlencode($otherUser->email))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Auth/ResetLinkInvalid'));

        return true;
    });
});

test('reset password email uses custom html and text views', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) use ($user) {
        $mail = $notification->toMail($user);
        $envelope = $mail->envelope();
        $content = $mail->content();

        expect($envelope->subject)->toBe('Reset your Gateway Door Systems password');
        expect($envelope->tags)->toBe(['password-reset']);
        expect($envelope->metadata)->toHaveKey('email_type', 'password-reset');
        expect($mail->hasTo($user->email))->toBeTrue();
        expect($content->view)->toBe('emails.password-reset-html');
        expect($content->text)->toBe('emails.password-reset-text');
        expect($mail->resetUrl)->toContain('/reset-password/');
        expect($mail->expiresInMinutes)->toBe(config('auth.passwords.users.expire'));
        expect($mail->userEmail)->toBe($user->email);

        return true;
    });
});

test('an account with a phone number must confirm that phone before the email is sent', function () {
    Notification::fake();

    $user = User::factory()->create();
    $user->phones()->create([
        'country' => 'US',
        'phone' => '(201) 555-0100',
        'is_primary' => true,
    ]);

    $this->post('/forgot-password', ['email' => $user->email])
        ->assertSessionHas('password_reset_phone', true);

    Notification::assertNothingSent();

    $this->get('/forgot-password')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Auth/ForgotPassword')
            ->where('phoneRequired', true)
            ->where('email', $user->email)
        );

    $this->post('/forgot-password', [
        'email' => $user->email,
        'phone' => '555-0199',
    ])->assertSessionHasErrors('phone');

    Notification::assertNothingSent();

    $this->post('/forgot-password', [
        'email' => $user->email,
        'phone' => '201-555-0100',
    ])->assertSessionHas('status');

    Notification::assertSentTo($user, ResetPasswordNotification::class);
});

test('a password reset link expires after 10 minutes', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    $token = null;

    Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) use (&$token) {
        $token = $notification->token;

        return true;
    });

    $this->travel(11)->minutes();

    $this->get('/reset-password/'.$token.'?email='.urlencode($user->email))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Auth/ResetLinkInvalid'));
});

test('the reset email is sent from the notifications mailbox', function () {
    config([
        'services.microsoft.tenant_id' => 'tenant-id',
        'services.microsoft.client_id' => 'client-id',
        'services.microsoft.client_secret' => 'client-secret',
        'services.microsoft.notification_from' => 'notifications@gateway-ds.com',
    ]);

    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response([
            'access_token' => 'graph-token',
            'expires_in' => 3600,
        ]),
        'https://graph.microsoft.com/*' => Http::response('', 202),
    ]);

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email])
        ->assertSessionHas('status');

    Http::assertSent(function ($request) use ($user) {
        $path = rawurldecode((string) (parse_url($request->url(), PHP_URL_PATH) ?? ''));

        if ($request->method() !== 'POST' || ! str_ends_with($path, '/users/notifications@gateway-ds.com/sendMail')) {
            return false;
        }

        $message = $request->data()['message'];

        return $message['toRecipients'][0]['emailAddress']['address'] === $user->email
            && $message['from']['emailAddress']['address'] === 'notifications@gateway-ds.com'
            && str_contains($message['body']['content'], '/reset-password/')
            && str_contains($message['body']['content'], '10 minutes');
    });
});

test('password can be reset with valid token', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) use ($user) {
        $response = $this->post('/reset-password', [
            'token' => $notification->token,
            'email' => $user->email,
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('login'));

        return true;
    });
});
