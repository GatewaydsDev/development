<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;

class QuotationAccess
{
    public static function canView(User $user): bool
    {
        return $user->hasPermission('view-quotations');
    }

    public static function canCreate(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
        ]) && $user->hasPermission('create-quotations');
    }

    public static function canUpdate(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
            UserLevel::PROJECT_MANAGER,
        ]) && $user->hasPermission('update-quotations');
    }

    public static function canDelete(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
        ]) && $user->hasPermission('delete-quotations');
    }
}
