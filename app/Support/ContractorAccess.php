<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;

class ContractorAccess
{
    public static function canView(User $user): bool
    {
        return self::canAccessContractors($user) && $user->hasPermission('view-contractors');
    }

    public static function canCreate(User $user): bool
    {
        return self::canAccessContractors($user) && $user->hasPermission('create-contractors');
    }

    public static function canUpdate(User $user): bool
    {
        return self::canAccessContractors($user) && $user->hasPermission('update-contractors');
    }

    public static function canDelete(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
        ]) && $user->hasPermission('delete-contractors');
    }

    private static function canAccessContractors(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
            UserLevel::PROJECT_MANAGER,
        ]);
    }
}
