<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Throwable;

/** Cloudflare Turnstile: confirms the visitor is a person, not a robot. */
class Turnstile
{
    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public static function siteKey(): ?string
    {
        return config('services.turnstile.site_key') ?: null;
    }

    public static function enabled(): bool
    {
        return self::siteKey() !== null && config('services.turnstile.secret_key');
    }

    public static function passes(?string $token, ?string $ip): bool
    {
        if (! self::enabled()) {
            return true;
        }

        if (! is_string($token) || $token === '') {
            return false;
        }

        try {
            return (bool) Http::asForm()->timeout(8)->post(self::VERIFY_URL, [
                'secret' => config('services.turnstile.secret_key'),
                'response' => $token,
                'remoteip' => $ip,
            ])->json('success', false);
        } catch (Throwable $exception) {
            report($exception);

            return false;
        }
    }
}
