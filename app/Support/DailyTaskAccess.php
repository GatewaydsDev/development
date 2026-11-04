<?php

namespace App\Support;

use App\Models\User;

class DailyTaskAccess
{
    public static function canManage(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public static function mustComplete(User $user): bool
    {
        return ! $user->isSuperAdmin() && EmployeeAccess::isForeman($user) && $user->hasPermission('view-daily-tasks');
    }

    public static function canOpen(User $user): bool
    {
        return self::canManage($user) || self::mustComplete($user);
    }

    /**
     * Number of tasks on a foreman's checklist that are not done yet.
     */
    public static function pendingCount(User $user, ?string $date = null): int
    {
        if (! self::mustComplete($user)) {
            return 0;
        }

        return DailyTaskChecklist::pendingCount($user, $date ?? now()->toDateString());
    }
}
