<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class AssignUserMailbox extends Command
{
    protected $signature = 'users:assign-mailbox {user : Existing user ID} {mailbox : Microsoft 365 mailbox address}';

    protected $description = 'Assign a Microsoft 365 mailbox to an existing user without changing their login email';

    public function handle(): int
    {
        $userId = $this->argument('user');
        $mailbox = strtolower(trim((string) $this->argument('mailbox')));

        if (! ctype_digit((string) $userId)) {
            $this->error('Pass an existing numeric user ID. This command does not look users up by name.');

            return self::FAILURE;
        }

        if (filter_var($mailbox, FILTER_VALIDATE_EMAIL) === false || strlen($mailbox) > 255) {
            $this->error('The mailbox must be a valid email address.');

            return self::FAILURE;
        }

        $user = User::query()->find((int) $userId);

        if ($user === null) {
            $this->error("No user exists with ID {$userId}.");

            return self::FAILURE;
        }

        $owner = User::query()
            ->where('microsoft_mailbox', $mailbox)
            ->whereKeyNot($user->id)
            ->first();

        if ($owner !== null) {
            $this->error("{$mailbox} is already assigned to user {$owner->id}.");

            return self::FAILURE;
        }

        if (strtolower((string) $user->microsoft_mailbox) === $mailbox) {
            $this->info("User {$user->id} already uses {$mailbox}.");

            return self::SUCCESS;
        }

        $user->forceFill(['microsoft_mailbox' => $mailbox])->save();

        $this->info("Assigned {$mailbox} to user {$user->id} ({$user->email}).");

        return self::SUCCESS;
    }
}
