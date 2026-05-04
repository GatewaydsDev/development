<?php

use App\Mail\ContactSubmissionReceived;
use App\Models\Company;
use App\Models\ContactSubmission;
use Illuminate\Support\Facades\Mail;

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
