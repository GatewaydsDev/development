<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;

class ProjectAccess
{
    public static function canView(User $user): bool
    {
        return $user->hasPermission('manage-projects');
    }

    public static function canCreate(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
        ]);
    }

    public static function canUpdate(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
            UserLevel::PROJECT_MANAGER,
        ]);
    }

    public static function canDelete(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
        ]);
    }

    public static function canViewSensitiveFields(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
        ]);
    }

    public static function canViewCustomerContactFields(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
        ]);
    }
}

