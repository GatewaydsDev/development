<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserAccessOverview;
use App\Support\UserPrivileges;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserAccessController extends Controller
{
    /** The signed-in user's level, linked records and effective privileges in one call. */
    public function me(Request $request): JsonResponse
    {
        if ($unavailable = $this->unavailable()) {
            return $unavailable;
        }

        $row = UserAccessOverview::query()->find($request->user()->id);

        return response()->json([
            'data' => $row ? $this->payload($row) : null,
            'privileges' => UserPrivileges::for($request->user()),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && UserPrivileges::allows($user, 'view-users'), 403);

        if ($unavailable = $this->unavailable()) {
            return $unavailable;
        }

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'level' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $users = UserAccessOverview::query()
            ->when($validated['search'] ?? null, fn ($q, $term) => $q->where(
                fn ($w) => $w->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%")
            ))
            ->when($validated['level'] ?? null, fn ($q, $level) => $q->where('level', $level))
            ->orderBy('id')
            ->paginate($validated['per_page'] ?? 25)
            ->through(fn (UserAccessOverview $row) => $this->payload($row));

        return response()->json($users);
    }

    private function payload(UserAccessOverview $row): array
    {
        $payload = $row->toArray();
        $mergedWebsite = $row->effective_permissions ?? [];
        $mergedMobile = $row->effective_mobile_permissions ?? [];
        $restricted = ['manage-access'];

        $effectiveWebsite = collect(config('access.permissions', []))
            ->keys()
            ->mapWithKeys(fn (string $permission): array => [
                $permission => $row->is_super_admin
                    || (! in_array($permission, $restricted, true)
                        && (bool) ($mergedWebsite[$permission] ?? false)),
            ])
            ->all();
        $effectiveMobile = collect($effectiveWebsite)
            ->mapWithKeys(fn (bool $granted, string $permission): array => [
                $permission => $granted
                    && ($row->is_super_admin || (bool) ($mergedMobile[$permission] ?? false)),
            ])
            ->all();

        return [
            ...$payload,
            'effective_permissions' => $effectiveWebsite,
            'effective_mobile_permissions' => $effectiveMobile,
        ];
    }

    private function unavailable(): ?JsonResponse
    {
        return DB::getDriverName() === 'mysql'
            ? null
            : response()->json(['message' => 'User access view requires MySQL.'], 501);
    }
}
