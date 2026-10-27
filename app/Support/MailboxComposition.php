<?php

namespace App\Support;

use App\Models\User;

class MailboxComposition
{
    /**
     * Header, signature, and footer are written into the message.
     * The company logo is not added as an attached file.
     *
     * @param  list<array{name: string, contentType: string, bytes: string, inline?: bool, contentId?: string}>  $attachments
     * @return array{content: string, type: string, attachments: list<array{name: string, contentType: string, bytes: string, inline?: bool, contentId?: string}>}
     */
    public function apply(User $user, string $content, string $type, array $attachments): array
    {
        return app(MailStationery::class)->compose($user, $content, $type, $attachments);
    }
}
