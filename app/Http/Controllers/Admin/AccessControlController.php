<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\UserLevel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AccessControlController extends Controller
{
    public function edit(Request $request): Response
    {
        $permissions = collect(config('access.permissions', []))
            ->map(fn (array $permission, string $key): array => [
                'key' => $key,
                'name' => $permission['name'],
                'group' => $permission['group'],
                'description' => $permission['description'],
            ])
            ->values()
            ->all();

        $levels = UserLevel::query()
            ->orderBy('id')
            ->get()
            ->map(fn (UserLevel $level): array => [
                'id' => $level->id,
                'name' => $level->name,
                'locked' => $level->isSuperAdminLevel(),
                'permissions' => collect(config('access.permissions', []))
                    ->keys()
                    ->mapWithKeys(fn (string $permission): array => [
                        $permission => $level->hasPermission($permission),
                    ])
                    ->all(),
                'mobile_permissions' => collect(config('access.permissions', []))
                    ->keys()
                    ->mapWithKeys(fn (string $permission): array => [
                        $permission => $level->hasMobilePermission($permission),
                    ])
                    ->all(),
            ])
            ->all();

        return Inertia::render('Admin/AccessControl/Edit', [
            'permissions' => $permissions,
            'levels' => $levels,
            'selectedLevelId' => $request->integer('level') ?: null,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'levels' => ['required', 'array'],
            'levels.*' => ['array'],
            'mobile_levels' => ['sometimes', 'array'],
            'mobile_levels.*' => ['array'],
        ]);

        $permissionKeys = collect(config('access.permissions', []))->keys();
        $saveMobile = array_key_exists('mobile_levels', $validated);

        UserLevel::query()
            ->get()
            ->each(function (UserLevel $level) use ($validated, $permissionKeys, $saveMobile): void {
                if ($level->isSuperAdminLevel()) {
                    $allGranted = $level->defaultPermissions();

                    $level->forceFill([
                        'permissions' => $allGranted,
                        'mobile_permissions' => $allGranted,
                    ])->save();

                    return;
                }

                $submittedPermissions = $validated['levels'][$level->id] ?? [];

                $permissions = $permissionKeys
                    ->mapWithKeys(fn (string $permission): array => [
                        $permission => filter_var(
                            $submittedPermissions[$permission] ?? false,
                            FILTER_VALIDATE_BOOLEAN,
                        ),
                    ])
                    ->all();

                $attributes = [
                    'permissions' => $permissions,
                ];

                if ($saveMobile) {
                    $submittedMobile = $validated['mobile_levels'][$level->id] ?? [];

                    $attributes['mobile_permissions'] = $permissionKeys
                        ->mapWithKeys(fn (string $permission): array => [
                            $permission => ($permissions[$permission] ?? false) && filter_var(
                                $submittedMobile[$permission] ?? false,
                                FILTER_VALIDATE_BOOLEAN,
                            ),
                        ])
                        ->all();
                }

                $level->forceFill($attributes)->save();
            });

        return redirect()
            ->route('admin.users.index')
            ->with('success', 'Access control permissions updated successfully.');
    }
}
