<?php

use App\Support\MailBounceFilter;

test('bounce and blocked notices are detected', function (string $from, string $subject) {
    expect(MailBounceFilter::isBounce($from, $subject))->toBeTrue();
})->with([
    ['Microsoft Outlook <MicrosoftExchange329e71ec@gateway-ds.com>', 'Undeliverable: Sign-up request: x@y.com'],
    ['Mail Delivery Subsystem <mailer-daemon@googlemail.com>', 'Delivery Status Notification (Failure)'],
    ['postmaster@example.com', 'Something'],
    ['a@b.com', 'Mail delivery failed: returning message to sender'],
    ['a@b.com', 'Your message was blocked'],
]);

test('normal emails are kept', function () {
    expect(MailBounceFilter::isBounce('Jose <jose@x.com>', 'Quote for the door job'))->toBeFalse()
        ->and(MailBounceFilter::isBounce('ricardo@gateway-ds.com', 'Login blocked: jose@x.com'))->toBeFalse();
});
