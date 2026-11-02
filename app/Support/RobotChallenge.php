<?php

namespace App\Support;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

/** Built-in "what is 3 + 7?" check, used when Cloudflare Turnstile is not configured. */
class RobotChallenge
{
    private const MIN_SECONDS = 3;

    private const MAX_SECONDS = 1800;

    public static function enabled(): bool
    {
        return config('services.robot_challenge', true) && ! Turnstile::enabled();
    }

    /** @return array{question: string, token: string} */
    public static function make(): array
    {
        $a = random_int(2, 9);
        $b = random_int(2, 9);

        return [
            'question' => "What is {$a} + {$b}?",
            'token' => Crypt::encryptString(json_encode(['answer' => $a + $b, 'at' => time(), 'id' => bin2hex(random_bytes(8))])),
        ];
    }

    public static function passes(?string $token, mixed $answer): bool
    {
        if (! self::enabled()) {
            return true;
        }

        if (! is_string($token) || $token === '' || ! is_numeric($answer)) {
            return false;
        }

        try {
            $data = json_decode(Crypt::decryptString($token), true);
        } catch (DecryptException) {
            return false;
        }

        $age = time() - (int) ($data['at'] ?? 0);

        if ($age < self::MIN_SECONDS || $age > self::MAX_SECONDS || (int) $answer !== (int) $data['answer']) {
            return false;
        }

        // Each challenge can be used once.
        return Cache::add('robot-challenge:'.$data['id'], 1, self::MAX_SECONDS);
    }
}
