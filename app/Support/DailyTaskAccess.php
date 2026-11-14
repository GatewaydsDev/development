<?php

namespace App\Support;

use App\Models\DailyTask;
use App\Models\EmployeeWorkSchedule;
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

    public static function canCreateForSchedule(User $user, EmployeeWorkSchedule $schedule, bool $mobile = false): bool
    {
        $granted = $mobile
            ? $user->hasMobilePermission('create-schedule-tasks')
            : $user->hasPermission('create-schedule-tasks');

        return $granted
            && EmployeeAccess::isForeman($user)
            && (int) $schedule->foreman_user_id === (int) $user->id;
    }

    public static function canUpdateForSchedule(
        User $user,
        EmployeeWorkSchedule $schedule,
        DailyTask $task,
        bool $mobile = false,
    ): bool {
        return self::canChangeForSchedule(
            $user,
            $schedule,
            $task,
            'update-schedule-tasks',
            $mobile,
        );
    }

    public static function canDeleteForSchedule(
        User $user,
        EmployeeWorkSchedule $schedule,
        DailyTask $task,
        bool $mobile = false,
    ): bool {
        return self::canChangeForSchedule(
            $user,
            $schedule,
            $task,
            'delete-schedule-tasks',
            $mobile,
        );
    }

    private static function canChangeForSchedule(
        User $user,
        EmployeeWorkSchedule $schedule,
        DailyTask $task,
        string $permission,
        bool $mobile,
    ): bool {
        $granted = $mobile
            ? $user->hasMobilePermission($permission)
            : $user->hasPermission($permission);

        if (! $granted
            || ! EmployeeAccess::isForeman($user)
            || (int) $schedule->foreman_user_id !== (int) $user->id
            || (int) $task->foreman_user_id !== (int) $user->id
            || (int) $task->created_by !== (int) $user->id
        ) {
            return false;
        }

        $scheduleIds = $task->schedules()->pluck('employee_work_schedules.id');

        return $scheduleIds->isNotEmpty()
            && ! EmployeeWorkSchedule::query()
                ->whereIn('id', $scheduleIds)
                ->where('foreman_user_id', '!=', $user->id)
                ->exists()
            && $scheduleIds->contains($schedule->id);
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
