<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;

class ProjectAccess
{
    public static function canView(User $user): bool
    {
        return $user->hasPermission('view-projects');
    }

    public static function canCreate(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
        ]) && $user->hasPermission('create-projects');
    }

    public static function canUpdate(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
            UserLevel::PROJECT_MANAGER,
        ]) && $user->hasPermission('update-projects');
    }

    public static function canDelete(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
        ]) && $user->hasPermission('delete-projects');
    }

    public static function canViewSensitiveFields(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
        ]);
    }
}

