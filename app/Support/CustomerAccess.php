<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;

class CustomerAccess
{
    public static function canView(User $user): bool
    {
        return self::canAccessCustomers($user) && $user->hasPermission('view-customers');
    }

    public static function canCreate(User $user): bool
    {
        return self::canAccessCustomers($user) && $user->hasPermission('create-customers');
    }

    public static function canUpdate(User $user): bool
    {
        return self::canAccessCustomers($user) && $user->hasPermission('update-customers');
    }

    public static function canDelete(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
        ]) && $user->hasPermission('delete-customers');
    }

    private static function canAccessCustomers(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
            UserLevel::PROJECT_MANAGER,
        ]);
    }
}

