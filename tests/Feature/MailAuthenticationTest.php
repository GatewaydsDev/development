<?php

use App\Support\MailAuthentication;

test('mail authentication reports a domain that does not authorize microsoft 365', function () {
    $problems = (new MailAuthentication)->problems(
        'gateway-ds.com',
        [['txt' => 'v=spf1 include:secureserver.net -all']],
        [],
        [],
        [],
    );

    expect($problems)->toHaveCount(3)
        ->and(implode(' ', $problems))->toContain('does not authorize Microsoft 365')
        ->and(implode(' ', $problems))->toContain('no DMARC record')
        ->and(implode(' ', $problems))->toContain('no Microsoft 365 DKIM');
});

test('mail authentication accepts spf dmarc and dkim for microsoft 365', function () {
    $problems = (new MailAuthentication)->problems(
        'gateway-ds.com',
        [['txt' => 'v=spf1 include:secureserver.net include:spf.protection.outlook.com -all']],
        [['txt' => 'v=DMARC1; p=quarantine; rua=mailto:dmarc@gateway-ds.com']],
        [['target' => 'selector1-gateway-ds-com._domainkey.example.w-v1.dkim.mail.microsoft']],
        [['target' => 'selector2-gateway-ds-com._domainkey.example.w-v1.dkim.mail.microsoft']],
    );

    expect($problems)->toBe([]);
});
