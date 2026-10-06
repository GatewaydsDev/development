<?php

namespace App\Support;

use App\Models\UserLevel;
use Illuminate\Validation\ValidationException;

class UserLevelAccess
{
    /**
     * @param  array<string, mixed>  $permissions
     * @param  array<string, mixed>|null  $mobilePermissions
     */
    public static function create(string $name, array $permissions, ?array $mobilePermissions = null): UserLevel
    {
        $name = trim($name);
        self::assertNameIsAvailable($name);

        $website = self::normalize($permissions);
        $mobile = self::normalizeMobile($website, $mobilePermissions);

        return UserLevel::query()->create([
            'name' => $name,
            'permissions' => $website,
            'mobile_permissions' => $mobile,
        ]);
    }

    /**
     * @param  array<string, mixed>  $permissions
     * @param  array<string, mixed>|null  $mobilePermissions
     */
    public static function update(UserLevel $level, array $permissions, ?array $mobilePermissions = null): UserLevel
    {
        if ($level->isSuperAdminLevel()) {
            throw ValidationException::withMessages([
                'name' => 'Super Admin access cannot be changed.',
            ]);
        }

        $website = self::normalize($permissions);
        $attributes = [
            'permissions' => $website,
        ];

        if ($mobilePermissions !== null) {
            $attributes['mobile_permissions'] = self::normalizeMobile($website, $mobilePermissions);
        }

        $level->forceFill($attributes)->save();

        return $level->refresh();
    }

    /**
     * @return array<string, mixed>
     */
    public static function payload(UserLevel $level): array
    {
        return [
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
        ];
    }

    /**
     * @return list<array{key: string, name: string, group: string, description: string}>
     */
    public static function catalog(): array
    {
        return collect(config('access.permissions', []))
            ->map(fn (array $permission, string $key): array => [
                'key' => $key,
                'name' => $permission['name'],
                'group' => $permission['group'],
                'description' => $permission['description'],
            ])
            ->values()
            ->all();
    }

    public static function assertNameIsAvailable(string $name, ?int $ignoreId = null): void
    {
        if (UserLevel::isSuperAdminName($name)) {
            throw ValidationException::withMessages([
                'name' => 'Super Admin already exists.',
            ]);
        }

        $exists = UserLevel::query()
            ->whereRaw('LOWER(name) = ?', [strtolower($name)])
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'name' => 'A user level with this name already exists.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, bool>
     */
    public static function normalize(array $input): array
    {
        return collect(config('access.permissions', []))
            ->keys()
            ->mapWithKeys(fn (string $permission): array => [
                $permission => filter_var($input[$permission] ?? false, FILTER_VALIDATE_BOOLEAN),
            ])
            ->all();
    }

    /**
     * @param  array<string, bool>  $website
     * @param  array<string, mixed>|null  $mobile
     * @return array<string, bool>
     */
    public static function normalizeMobile(array $website, ?array $mobile): array
    {
        return collect($website)
            ->mapWithKeys(function (bool $granted, string $permission) use ($mobile): array {
                $allowed = $mobile === null
                    ? $granted
                    : filter_var($mobile[$permission] ?? false, FILTER_VALIDATE_BOOLEAN);

                return [$permission => $granted && $allowed];
            })
            ->all();
    }
}
