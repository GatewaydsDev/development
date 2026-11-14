<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLoginLog;
use Illuminate\Http\Request;

class LoginAudit
{
    public static function record(User $user, string $event, Request $request, ?string $guard = null): UserLoginLog
    {
        return UserLoginLog::query()->create([
            'user_id' => $user->id,
            'event' => $event,
            'guard' => $guard,
            'device_type' => LoginDevice::detect($request, $guard === 'sanctum' ? 'sanctum' : null),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 1000),
            ...self::location($request),
        ]);
    }

    /**
     * Location comes from the edge/CDN headers (no IP is sent to third parties),
     * or from coordinates the mobile app sends with the request.
     *
     * @return array{country: ?string, region: ?string, city: ?string, latitude: ?float, longitude: ?float}
     */
    public static function location(Request $request): array
    {
        $header = fn (string ...$names): ?string => collect($names)
            ->map(fn (string $name): ?string => $request->header($name))
            ->first(fn (?string $value): bool => filled($value) && $value !== 'XX');

        $coordinate = fn (mixed $value, float $limit): ?float => is_numeric($value) && abs((float) $value) <= $limit
            ? round((float) $value, 7)
            : null;

        $latitude = $coordinate($request->input('latitude') ?? $header('CF-IPLatitude', 'X-Vercel-IP-Latitude', 'CloudFront-Viewer-Latitude'), 90);
        $longitude = $coordinate($request->input('longitude') ?? $header('CF-IPLongitude', 'X-Vercel-IP-Longitude', 'CloudFront-Viewer-Longitude'), 180);

        $clean = fn (?string $value): ?string => $value === null ? null : mb_substr(rawurldecode($value), 0, 100);

        return [
            'country' => $clean($header('CF-IPCountry', 'X-Vercel-IP-Country', 'CloudFront-Viewer-Country')),
            'region' => $clean($header('CF-Region', 'X-Vercel-IP-Country-Region', 'CloudFront-Viewer-Country-Region')),
            'city' => $clean($header('CF-IPCity', 'X-Vercel-IP-City', 'CloudFront-Viewer-City')),
            'latitude' => $latitude !== null && $longitude !== null ? $latitude : null,
            'longitude' => $latitude !== null && $longitude !== null ? $longitude : null,
        ];
    }
}
