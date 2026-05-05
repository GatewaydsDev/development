<?php

use App\Mail\ContactSubmissionReceived;
use App\Models\Company;
use App\Models\ContactSubmission;
use App\Models\User;
use App\Models\UserLevel;
use App\Notifications\NewContactSubmissionNotification;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

test('contact form submissions are saved before notifications are sent', function () {
    Mail::fake();

    config(['contact.recipient' => 'leads@gatewaydoors.test']);

    $this
        ->withServerVariables([
            'REMOTE_ADDR' => '203.0.113.10',
            'HTTP_USER_AGENT' => 'Gateway Browser',
        ])
        ->post(route('contact.store'), [
            'name' => 'Jane Builder',
            'email' => 'jane@example.com',
            'phone_number' => '555-123-4567',
            'organization' => 'Builder Co',
            'project_type' => 'blast',
            'message' => 'We need a secure specialty door installation.',
            'source_url' => 'https://gatewaydoors.test/#quote',
            'website' => '',
        ])
        ->assertRedirect()
        ->assertSessionHas('contact.success', true);

    $submission = ContactSubmission::query()
        ->where('email', 'jane@example.com')
        ->firstOrFail();

    expect($submission->name)->toBe('Jane Builder')
        ->and($submission->phone_number)->toBe('555-123-4567')
        ->and($submission->organization)->toBe('Builder Co')
        ->and($submission->project_type)->toBe('blast')
        ->and($submission->message)->toBe('We need a secure specialty door installation.')
        ->and($submission->source_url)->toBe('https://gatewaydoors.test/#quote')
        ->and($submission->ip_address)->toBe('203.0.113.10')
        ->and($submission->user_agent)->toBe('Gateway Browser');

    Mail::assertSent(ContactSubmissionReceived::class, function (
        ContactSubmissionReceived $mail
    ) use ($submission): bool {
        return $mail->hasTo('leads@gatewaydoors.test')
            && $mail->submission->is($submission);
    });
});

test('contact notifications fall back to the active company email', function () {
    Mail::fake();

    config(['contact.recipient' => null]);

    Company::create([
        'name' => 'Gateway Door Systems',
        'email' => 'office@gatewaydoors.test',
        'is_active' => true,
    ]);

    $this
        ->post(route('contact.store'), [
            'name' => 'Alex Owner',
            'email' => 'alex@example.com',
            'phone_number' => '',
            'organization' => '',
            'project_type' => '',
            'message' => 'Please contact me about a door project.',
            'source_url' => 'https://gatewaydoors.test/',
            'website' => '',
        ])
        ->assertRedirect()
        ->assertSessionHas('contact.success', true);

    Mail::assertSent(ContactSubmissionReceived::class, function (
        ContactSubmissionReceived $mail
    ): bool {
        return $mail->hasTo('office@gatewaydoors.test');
    });
});

test('contact form submissions create dashboard notifications for administrators', function () {
    Mail::fake();

    $administratorLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $administrator = User::factory()->create([
        'level_id' => $administratorLevel->id,
    ]);

    $this
        ->post(route('contact.store'), [
            'name' => 'Morgan Security',
            'email' => 'morgan@example.com',
            'phone_number' => '555-5000',
            'organization' => 'Security Co',
            'project_type' => 'forcedEntryDoors',
            'message' => 'We need forced entry door help.',
            'source_url' => 'https://gatewaydoors.test/',
            'website' => '',
        ])
        ->assertRedirect()
        ->assertSessionHas('contact.success', true);

    expect($administrator->unreadNotifications()->count())->toBe(1);

    $notification = $administrator->unreadNotifications()->firstOrFail();

    expect($notification->data['title'])->toBe('New contact request')
        ->and($notification->data['name'])->toBe('Morgan Security')
        ->and($notification->data['email'])->toBe('morgan@example.com')
        ->and($notification->data['message'])->toBe('We need forced entry door help.');
});

test('users can mark their contact notifications as read', function () {
    Mail::fake();

    $administratorLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $administrator = User::factory()->create([
        'level_id' => $administratorLevel->id,
    ]);

    ContactSubmission::create([
        'name' => 'Taylor Contact',
        'email' => 'taylor@example.com',
        'message' => 'Please review this contact request.',
    ]);

    $submission = ContactSubmission::query()->firstOrFail();
    $administrator->notify(
        new NewContactSubmissionNotification($submission)
    );

    $notification = $administrator->unreadNotifications()->firstOrFail();

    $this->actingAs($administrator)
        ->post(route('notifications.read', $notification->id))
        ->assertRedirect();

    expect($administrator->fresh()->unreadNotifications()->count())->toBe(0);
});

test('users can list open update and delete their notifications', function () {
    Mail::fake();

    $administratorLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $administrator = User::factory()->create([
        'level_id' => $administratorLevel->id,
    ]);
    $submission = ContactSubmission::create([
        'name' => 'Jordan Lead',
        'email' => 'jordan@example.com',
        'message' => 'Please send information about blast doors.',
    ]);

    $administrator->notify(new NewContactSubmissionNotification($submission));

    $notification = $administrator->unreadNotifications()->firstOrFail();

    $this->actingAs($administrator)
        ->get(route('notifications.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Notifications/Index')
            ->has('notifications', 1)
            ->where('notifications.0.email', 'jordan@example.com')
        );

    $this->actingAs($administrator)
        ->get(route('notifications.show', $notification->id))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Notifications/Show')
            ->where('notification.email', 'jordan@example.com')
            ->where('notification.isRead', true)
        );

    $this->actingAs($administrator)
        ->patch(route('notifications.update', $notification->id), [
            'read' => false,
        ])
        ->assertRedirect();

    expect($notification->fresh()->unread())->toBeTrue();

    $this->actingAs($administrator)
        ->delete(route('notifications.destroy', $notification->id))
        ->assertRedirect(route('notifications.index', absolute: false));

    expect($administrator->notifications()->count())->toBe(0);
});
