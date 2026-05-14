<?php

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Support\Facades\Notification;

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
            ->assertRedirect(route('password.request'))
            ->assertSessionHasErrors('email');

        $this
            ->get('/reset-password/not-a-valid-token?email='.urlencode($otherUser->email))
            ->assertRedirect(route('password.request'))
            ->assertSessionHasErrors('email');

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
