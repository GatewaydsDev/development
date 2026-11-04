<?php

namespace App\Support;

use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Database\Eloquent\Builder;

class ClientPortalAccess
{
    public static function canOpen(User $user): bool
    {
        return $user->hasPermission('view-client-portal') && ! $user->isSuperAdmin();
    }

    public static function company(User $user): ?ClientCompany
    {
        return $user->clientCompanies()->first();
    }

    public static function isMaster(User $user): bool
    {
        return (bool) $user->clientCompanies()->first()?->pivot->is_master;
    }

    public static function canManageTeam(User $user): bool
    {
        return self::canOpen($user)
            && $user->hasPermission('manage-client-team')
            && self::company($user) !== null;
    }

    /**
     * Managers and the master see every company project; other members see the
     * whole company or only the projects delegated to them.
     *
     * @return Builder<Project>
     */
    public static function projects(User $user): Builder
    {
        $company = self::company($user);
        $granted = fn (Builder $query) => $query->whereHas(
            'clientUsers',
            fn (Builder $grants) => $grants->whereKey($user->id),
        );

        if (! $company) {
            return Project::query()->where($granted);
        }

        $query = Project::query()->where('client_company_id', $company->id);

        if ($company->pivot->is_master || $company->pivot->all_projects || $user->hasPermission('manage-client-team')) {
            return $query;
        }

        return $query->where($granted);
    }

    public static function canViewProject(User $user, Project $project): bool
    {
        return self::canOpen($user) && self::projects($user)->whereKey($project->id)->exists();
    }

    /**
     * Masters can manage everyone in the company, managers only viewers, and
     * nobody can edit themselves or the master through the portal.
     */
    public static function canManageMember(User $actor, ClientCompany $company, User $target): bool
    {
        if ($actor->is($target) || ! self::canManageTeam($actor)) {
            return false;
        }

        $membership = $company->users()->whereKey($target->id)->first()?->pivot;

        if (! $membership || $membership->is_master) {
            return false;
        }

        return self::isMaster($actor) || ! $target->hasPermission('manage-client-team');
    }

    public static function levelFor(bool $manager): UserLevel
    {
        $level = UserLevel::firstOrCreate(['name' => $manager ? UserLevel::CLIENT_MANAGER : UserLevel::CLIENT]);

        if ($level->wasRecentlyCreated) {
            $level->forceFill(['permissions' => $level->defaultPermissions()])->save();
        }

        return $level;
    }
}
