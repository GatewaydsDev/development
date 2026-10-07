<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\UserLevel;
use App\Support\UserLevelAccess;
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
                'uuid' => $level->uuid,
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
            'selectedLevelId' => $this->selectedLevelId($request),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'grant_mobile' => ['sometimes', 'boolean'],
            'permissions' => ['sometimes', 'array'],
        ]);

        $website = UserLevelAccess::normalize($validated['permissions'] ?? []);
        $grantMobile = filter_var($validated['grant_mobile'] ?? true, FILTER_VALIDATE_BOOLEAN);
        $mobile = $grantMobile
            ? $website
            : array_map(static fn (): bool => false, $website);

        $level = UserLevelAccess::create($validated['name'], $website, $mobile);

        if (str_contains(url()->previous(), '/access-control')) {
            return redirect()
                ->route('admin.access-control.edit', ['level' => $level->uuid])
                ->with('success', 'User level created.');
        }

        return back()->with('success', 'User level created.');
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

    private function selectedLevelId(Request $request): ?int
    {
        $identifier = $request->query('level');

        if (! is_string($identifier) || $identifier === '') {
            return null;
        }

        $level = UserLevel::query()
            ->where('uuid', $identifier)
            ->when(
                ctype_digit($identifier),
                fn ($query) => $query->orWhere('id', (int) $identifier),
            )
            ->first();

        return $level?->id;
    }
}
