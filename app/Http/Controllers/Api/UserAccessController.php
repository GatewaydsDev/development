<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        abort_unless($request->user()->can('view-users'), 403);

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
        return $row->makeHidden(['level_permissions', 'level_mobile_permissions'])->toArray();
    }

    private function unavailable(): ?JsonResponse
    {
        return DB::getDriverName() === 'mysql'
            ? null
            : response()->json(['message' => 'User access view requires MySQL.'], 501);
    }
}
