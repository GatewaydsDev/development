<?php

namespace App\Support;

use App\Models\SystemUpdate;
use App\Models\User;

class SystemUpdateAccess
{
    public static function canManage(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public static function canView(User $user): bool
    {
        return $user->isSuperAdmin()
            || ($user->level_id !== null && SystemUpdate::query()->recent()->visibleTo($user)->exists());
    }
}
