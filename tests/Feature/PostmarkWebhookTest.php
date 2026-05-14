<?php

use App\Models\EmailDeliveryEvent;

test('postmark webhooks record delivery events', function () {
    config(['services.postmark.webhook_token' => 'secret-token']);

    $response = $this
        ->withToken('secret-token')
        ->postJson(route('webhooks.postmark'), [
            'RecordType' => 'Bounce',
            'Recipient' => 'customer@example.com',
            'MessageID' => 'postmark-message-id',
            'Tag' => 'password-reset',
            'Metadata' => [
                'email_type' => 'password-reset',
            ],
            'BouncedAt' => '2026-05-13T22:10:00Z',
        ]);

    $response->assertOk()->assertJson(['ok' => true]);

    $event = EmailDeliveryEvent::firstOrFail();

    expect($event->provider)->toBe('postmark');
    expect($event->event_type)->toBe('Bounce');
    expect($event->recipient)->toBe('customer@example.com');
    expect($event->message_id)->toBe('postmark-message-id');
    expect($event->tag)->toBe('password-reset');
    expect($event->metadata)->toBe(['email_type' => 'password-reset']);
});

test('postmark webhook token is required when configured', function () {
    config(['services.postmark.webhook_token' => 'secret-token']);

    $this
        ->postJson(route('webhooks.postmark'), [
            'RecordType' => 'SpamComplaint',
            'Recipient' => 'customer@example.com',
        ])
        ->assertForbidden();

    expect(EmailDeliveryEvent::count())->toBe(0);
});
