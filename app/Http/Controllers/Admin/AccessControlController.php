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
                'locked' => $level->name === UserLevel::SUPER_ADMIN,
                'permissions' => collect(config('access.permissions', []))
                    ->keys()
                    ->mapWithKeys(fn (string $permission): array => [
                        $permission => $level->hasPermission($permission),
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
        ]);

        $permissionKeys = collect(config('access.permissions', []))->keys();

        UserLevel::query()
            ->get()
            ->each(function (UserLevel $level) use ($validated, $permissionKeys): void {
                if ($level->name === UserLevel::SUPER_ADMIN) {
                    $level->forceFill([
                        'permissions' => $level->defaultPermissions(),
                    ])->save();

                    return;
                }

                $submittedPermissions = $validated['levels'][$level->id] ?? [];

                $level->forceFill([
                    'permissions' => $permissionKeys
                        ->mapWithKeys(fn (string $permission): array => [
                            $permission => filter_var(
                                $submittedPermissions[$permission] ?? false,
                                FILTER_VALIDATE_BOOLEAN,
                            ),
                        ])
                        ->all(),
                ])->save();
            });

        return redirect()
            ->route('admin.users.index')
            ->with('success', 'Access control permissions updated successfully.');
    }
}
