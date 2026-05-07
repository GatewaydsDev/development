<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;

class EmployeeAccess
{
    public static function canView(User $user): bool
    {
        return self::canAccessEmployees($user) && $user->hasPermission('view-employees');
    }

    public static function canCreate(User $user): bool
    {
        return self::canAccessEmployees($user) && $user->hasPermission('create-employees');
    }

    public static function canUpdate(User $user): bool
    {
        return self::canAccessEmployees($user) && $user->hasPermission('update-employees');
    }

    public static function canDelete(User $user): bool
    {
        return self::canAccessEmployees($user) && $user->hasPermission('delete-employees');
    }

    private static function canAccessEmployees(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
        ]);
    }
}
