<?php

namespace App\Support;

use Illuminate\Http\Request;

class LoginDevice
{
    public const WEBSITE = 'website';

    public const MOBILE = 'mobile';

    public const TABLET = 'tablet';

    public const TYPES = [self::WEBSITE, self::MOBILE, self::TABLET];

    public static function detect(Request $request, ?string $guard = null): string
    {
        $declared = strtolower((string) ($request->header('X-Device-Type') ?: $request->input('device_type')));

        if (in_array($declared, self::TYPES, true)) {
            return $declared;
        }

        return self::fromUserAgent(
            (string) $request->userAgent(),
            $guard === 'sanctum' ? self::MOBILE : self::WEBSITE,
        );
    }

    public static function fromUserAgent(?string $agent, string $fallback = self::WEBSITE): string
    {
        $agent = (string) $agent;

        if (preg_match('/iPad|Tablet|PlayBook|Silk|Kindle|(Android(?!.*Mobile))/i', $agent)) {
            return self::TABLET;
        }

        if (preg_match('/Mobi|iPhone|iPod|Android|BlackBerry|Windows Phone/i', $agent)) {
            return self::MOBILE;
        }

        return $fallback;
    }
}
