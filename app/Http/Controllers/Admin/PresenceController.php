<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PresenceController extends Controller
{
    public const ONLINE_SECONDS = 120;

    public const AWAY_SECONDS = 900;

    public function ping(): Response
    {
        return response()->noContent();
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $users = User::query()
            ->with('level:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'level_id', 'last_login_at', 'last_seen_at', 'last_seen_device', 'last_login_device', 'last_logout_at'])
            ->map(function (User $user): array {
                $status = $this->status($user);

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'level' => $user->level?->name,
                    'status' => $status,
                    'device' => $status === 'offline' ? null : ($user->last_seen_device ?? $user->last_login_device),
                    'last_seen_at' => $user->last_seen_at?->toIso8601String(),
                    'last_logout_at' => $user->last_logout_at?->toIso8601String(),
                ];
            });

        $active = $users->where('status', '!=', 'offline');

        return response()->json([
            'users' => $users->sortBy([['status', 'asc'], ['name', 'asc']])->values(),
            'counts' => [
                'online' => $users->where('status', 'online')->count(),
                'away' => $users->where('status', 'away')->count(),
                'offline' => $users->where('status', 'offline')->count(),
            ],
            'devices' => [
                'website' => $active->where('device', 'website')->count(),
                'mobile' => $active->where('device', 'mobile')->count(),
                'tablet' => $active->where('device', 'tablet')->count(),
            ],
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    private function status(User $user): string
    {
        $seen = $user->last_seen_at;

        if ($seen === null || ($user->last_logout_at !== null && $user->last_logout_at >= $seen)) {
            return 'offline';
        }

        $age = $seen->diffInSeconds(now());

        return match (true) {
            $age <= self::ONLINE_SECONDS => 'online',
            $age <= self::AWAY_SECONDS => 'away',
            default => 'offline',
        };
    }
}
