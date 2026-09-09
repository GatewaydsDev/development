<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;

class BidAccess
{
    public static function canView(User $user): bool
    {
        return $user->hasPermission('view-bids');
    }

    public static function canCreate(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
        ]) && $user->hasPermission('create-bids');
    }

    public static function canUpdate(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
            UserLevel::PROJECT_MANAGER,
        ]) && $user->hasPermission('update-bids');
    }

    public static function canDelete(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
        ]) && $user->hasPermission('delete-bids');
    }
}
