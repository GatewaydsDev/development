<?php

namespace App\Support;

/** Spots bounce and blocked-delivery notices so they stay out of the inbox list. */
class MailBounceFilter
{
    private const SENDERS = '/(mailer-daemon|postmaster|mail\s*delivery\s*(sub)?system|microsoftexchange)/i';

    private const SUBJECTS = '/^\s*(undeliverable|undelivered|delivery (status notification|has failed|failure|incomplete)|'
        .'mail delivery (failed|system failure)|returned mail|failure notice|message (blocked|not delivered)|'
        .'blocked\b|your message (to .+ )?(was|has been) (blocked|rejected)|could not be delivered|couldn.t be delivered)/i';

    public static function isBounce(string $from, string $subject): bool
    {
        return preg_match(self::SENDERS, $from) === 1
            || preg_match(self::SUBJECTS, $subject) === 1;
    }
}
