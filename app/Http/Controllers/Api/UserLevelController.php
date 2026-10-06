<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\UserLevelAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserLevelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        return response()->json([
            'permissions' => UserLevelAccess::catalog(),
            'data' => UserLevel::query()
                ->orderBy('id')
                ->get()
                ->map(fn (UserLevel $level): array => UserLevelAccess::payload($level))
                ->values()
                ->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'permissions' => ['sometimes', 'array'],
            'mobile_permissions' => ['sometimes', 'array'],
        ]);

        $level = UserLevelAccess::create(
            $validated['name'],
            $validated['permissions'] ?? [],
            $validated['mobile_permissions'] ?? null,
        );

        return response()->json([
            'data' => UserLevelAccess::payload($level),
        ], 201);
    }

    public function show(Request $request, UserLevel $userLevel): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        return response()->json([
            'data' => UserLevelAccess::payload($userLevel),
        ]);
    }

    public function update(Request $request, UserLevel $userLevel): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        abort_if($userLevel->isSuperAdminLevel(), 403);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'permissions' => ['sometimes', 'array'],
            'mobile_permissions' => ['sometimes', 'array'],
        ]);

        if (array_key_exists('name', $validated)) {
            UserLevelAccess::assertNameIsAvailable($validated['name'], $userLevel->id);
            $userLevel->forceFill(['name' => trim($validated['name'])])->save();
        }

        if (array_key_exists('permissions', $validated) || array_key_exists('mobile_permissions', $validated)) {
            UserLevelAccess::update(
                $userLevel,
                $validated['permissions'] ?? ($userLevel->permissions ?? []),
                array_key_exists('mobile_permissions', $validated)
                    ? $validated['mobile_permissions']
                    : null,
            );
        }

        return response()->json([
            'data' => UserLevelAccess::payload($userLevel->refresh()),
        ]);
    }

    private function authorizeSuperAdmin(Request $request): User
    {
        $user = $request->user();

        abort_unless($user instanceof User && $user->isSuperAdmin(), 403);

        return $user;
    }
}
