<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;

class CustomerAccess
{
    public static function canManage(User $user): bool
    {
        return $user->hasUserLevel([
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
            UserLevel::PROJECT_MANAGER,
        ]) && $user->hasPermission('manage-customers');
    }
}

