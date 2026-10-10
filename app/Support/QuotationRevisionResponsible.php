<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class QuotationRevisionResponsible
{
    /**
     * User levels allowed to be responsible for a quotation revision.
     * Add more level names here when new levels are allowed.
     *
     * @return array<int, string>
     */
    public static function eligibleLevels(): array
    {
        return [
            ...UserLevel::SUPER_ADMIN_ALIASES,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
        ];
    }

    /**
     * Legacy `users.role` values that match the eligible levels.
     *
     * @return array<int, string>
     */
    public static function eligibleRoles(): array
    {
        return ['super_admin', 'administrator', 'admin'];
    }

    /**
     * @return Builder<User>
     */
    public static function eligibleUsers(): Builder
    {
        $levels = self::eligibleLevels();
        $roles = self::eligibleRoles();

        return User::query()->where(function (Builder $query) use ($levels, $roles): void {
            $query->whereHas('level', fn (Builder $level) => $level->whereIn('name', $levels))
                ->orWhereIn(DB::raw('LOWER(role)'), $roles);
        });
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    public static function options(): array
    {
        return self::eligibleUsers()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user): array => ['id' => $user->id, 'name' => $user->name])
            ->values()
            ->all();
    }
}
