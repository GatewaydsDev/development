<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserActivity;
use App\Support\LoginDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

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
            ->with(['level:id,name', 'presenceDevices'])
            ->orderBy('name')
            ->get(['id', 'uuid', 'name', 'level_id', 'last_login_at', 'last_seen_at', 'last_seen_device', 'last_login_device', 'last_logout_at'])
            ->map(function (User $user): array {
                $sessions = $this->sessions($user);
                $status = $this->bestStatus($sessions);
                $active = $sessions->where('status', '!=', 'offline')->values();

                return [
                    'id' => $user->id,
                    'uuid' => $user->uuid,
                    'name' => $user->name,
                    'level' => $user->level?->name,
                    'status' => $status,
                    'logged_in_at' => $user->last_login_at?->toIso8601String(),
                    'device' => $active->first()['device'] ?? null,
                    'devices' => $active->all(),
                    'last_seen_at' => $user->last_seen_at?->toIso8601String(),
                    'last_logout_at' => $user->last_logout_at?->toIso8601String(),
                ];
            });

        $deviceCount = fn (string $device): int => $users->sum(
            fn (array $user): int => collect($user['devices'])->where('device', $device)->count(),
        );

        return response()->json([
            'users' => $users->sortBy([['status', 'asc'], ['name', 'asc']])->values(),
            'counts' => [
                'online' => $users->where('status', 'online')->count(),
                'away' => $users->where('status', 'away')->count(),
                'offline' => $users->where('status', 'offline')->count(),
            ],
            'devices' => [
                'website' => $deviceCount('website'),
                'mobile' => $deviceCount('mobile'),
                'tablet' => $deviceCount('tablet'),
            ],
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    public function activities(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $validated = $request->validate([
            'days' => ['nullable', 'integer', Rule::in([4, 10, 30, 90, 365])],
            'event_type' => ['nullable', 'string', 'max:50'],
        ]);
        $days = (int) ($validated['days'] ?? 4);
        $from = now()->subDays($days);
        $base = UserActivity::query()
            ->where('user_id', $user->id)
            ->where('occurred_at', '>=', $from);
        $eventTypes = (clone $base)
            ->whereNotNull('event_type')
            ->distinct()
            ->orderBy('event_type')
            ->pluck('event_type')
            ->values();
        $activities = $base
            ->when(
                $validated['event_type'] ?? null,
                fn ($query, string $eventType) => $query->where('event_type', $eventType),
            )
            ->latest('occurred_at')
            ->limit(500)
            ->get()
            ->map(fn (UserActivity $activity): array => [
                'id' => $activity->id,
                'event_type' => $activity->event_type,
                'action' => $activity->action,
                'description' => $activity->description,
                'page_name' => $activity->page_name,
                'route_name' => $activity->route_name,
                'method' => $activity->method,
                'path' => $activity->path,
                'ip_address' => $activity->ip_address,
                'user_agent' => $activity->user_agent,
                'device_type' => LoginDevice::fromUserAgent(
                    $activity->user_agent,
                    str_starts_with(ltrim((string) $activity->path, '/'), 'api/')
                        ? LoginDevice::MOBILE
                        : LoginDevice::WEBSITE,
                ),
                'metadata' => $activity->metadata,
                'occurred_at' => $activity->occurred_at?->toIso8601String(),
            ]);

        return response()->json([
            'user' => [
                'uuid' => $user->uuid,
                'name' => $user->name,
                'level' => $user->level?->name,
            ],
            'days' => $days,
            'event_types' => $eventTypes,
            'activities' => $activities,
        ]);
    }

    /**
     * One entry per device the user has been seen on. Users without device rows yet fall back to
     * the single last-seen device stored on the user.
     *
     * @return Collection<int, array{device: string, status: string, last_seen_at: string|null}>
     */
    private function sessions(User $user): Collection
    {
        if ($user->presenceDevices->isNotEmpty()) {
            return $user->presenceDevices->map(fn ($row): array => [
                'device' => $row->device,
                'status' => $this->statusFor($row->last_seen_at, $row->logged_out_at),
                'last_seen_at' => $row->last_seen_at?->toIso8601String(),
            ])->values();
        }

        if ($user->last_seen_at === null) {
            return collect();
        }

        return collect([[
            'device' => $user->last_seen_device ?? $user->last_login_device ?? 'website',
            'status' => $this->statusFor($user->last_seen_at, $user->last_logout_at),
            'last_seen_at' => $user->last_seen_at->toIso8601String(),
        ]]);
    }

    /** @param Collection<int, array{status: string}> $sessions */
    private function bestStatus(Collection $sessions): string
    {
        return match (true) {
            $sessions->contains('status', 'online') => 'online',
            $sessions->contains('status', 'away') => 'away',
            default => 'offline',
        };
    }

    private function statusFor(?Carbon $seen, ?Carbon $loggedOut): string
    {
        if ($seen === null || ($loggedOut !== null && $loggedOut >= $seen)) {
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
