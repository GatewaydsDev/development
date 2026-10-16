<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Throwable;

class PasswordResetLink
{
    public const PHONE_REQUIRED = 'phone_required';

    public const SENT = 'sent';

    public function send(User $user, ?string $phone): string
    {
        if ($user->hasSavedPhone()) {
            $phone = trim((string) $phone);

            if ($phone === '') {
                return self::PHONE_REQUIRED;
            }

            if (! $user->matchesSavedPhone($phone)) {
                throw ValidationException::withMessages([
                    'phone' => 'That phone number does not match this account.',
                ]);
            }
        }

        try {
            $status = Password::sendResetLink([
                'email' => $user->email,
            ]);
        } catch (Throwable $exception) {
            report($exception);

            throw ValidationException::withMessages([
                'email' => ['There was an error sending the email. Please try again in a moment.'],
            ]);
        }

        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages([
                'email' => [trans($status)],
            ]);
        }

        return self::SENT;
    }
}
