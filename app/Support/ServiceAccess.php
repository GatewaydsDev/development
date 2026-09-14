<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;

class ServiceAccess
{
    public static function canView(User $user): bool
    {
        return $user->hasPermission('view-services');
    }

    public static function canCreate(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
        ]) && $user->hasPermission('create-services');
    }

    public static function canUpdate(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
            UserLevel::PROJECT_MANAGER,
        ]) && $user->hasPermission('update-services');
    }

    public static function canDelete(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
        ]) && $user->hasPermission('delete-services');
    }
}
