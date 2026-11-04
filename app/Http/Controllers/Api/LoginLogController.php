<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserLoginLog;
use App\Support\LoginDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LoginLogController extends Controller
{
    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        return $this->respond($request, UserLoginLog::query()->where('user_id', $user->id), false);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $filters = $request->validate([
            'user_id' => ['nullable', 'integer'],
        ]);

        $query = UserLoginLog::query()
            ->when($filters['user_id'] ?? null, fn ($q, int $id) => $q->where('user_id', $id));

        return $this->respond($request, $query, true);
    }

    private function respond(Request $request, $query, bool $withUser): JsonResponse
    {
        $filters = $request->validate([
            'event' => ['nullable', Rule::in([UserLoginLog::LOGIN, UserLoginLog::LOGOUT])],
            'device_type' => ['nullable', Rule::in(LoginDevice::TYPES)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $page = $query
            ->when($withUser, fn ($q) => $q->with('user:id,name,email'))
            ->when($filters['event'] ?? null, fn ($q, string $v) => $q->where('event', $v))
            ->when($filters['device_type'] ?? null, fn ($q, string $v) => $q->where('device_type', $v))
            ->when($filters['from'] ?? null, fn ($q, string $v) => $q->where('created_at', '>=', $v))
            ->when($filters['to'] ?? null, fn ($q, string $v) => $q->where('created_at', '<=', $v.' 23:59:59'))
            ->latest('id')
            ->paginate($filters['per_page'] ?? 25);

        return response()->json($page->through(fn (UserLoginLog $log): array => [
            'id' => $log->id,
            'event' => $log->event,
            'device_type' => $log->device_type,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'location' => [
                'country' => $log->country,
                'region' => $log->region,
                'city' => $log->city,
                'latitude' => $log->latitude,
                'longitude' => $log->longitude,
            ],
            'user' => $withUser && $log->user
                ? ['id' => $log->user->id, 'name' => $log->user->name, 'email' => $log->user->email]
                : null,
            'created_at' => $log->created_at?->toIso8601String(),
        ]));
    }
}
