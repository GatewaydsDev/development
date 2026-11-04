<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\LoginDevice;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TrackPresence
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $guard = $request->bearerToken() ? 'sanctum' : null;
        $user = $guard ? $request->user('sanctum') : $request->user();

        if ($user instanceof User && $this->isStale($user)) {
            $user->forceFill([
                'last_seen_at' => now(),
                'last_seen_device' => LoginDevice::detect($request, $guard),
            ])->saveQuietly();
        }

        return $response;
    }

    private function isStale(User $user): bool
    {
        return $user->last_seen_at === null || $user->last_seen_at->diffInSeconds(now()) >= 30;
    }
}
