<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\EmployeeWorkSchedule;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Who can follow a job's progress (and inspect its work) through the job progress pages.
 */
class JobProgressAccess
{
    public static function canOpen(User $user): bool
    {
        return $user->isSuperAdmin()
            || EmployeeAccess::isManager($user)
            || EmployeeAccess::isForeman($user)
            || self::isQualityControl($user);
    }

    public static function canViewAll(User $user): bool
    {
        return $user->isSuperAdmin() || EmployeeAccess::isManager($user);
    }

    /**
     * @param  Builder<EmployeeWorkSchedule>  $query
     * @return Builder<EmployeeWorkSchedule>
     */
    public static function visibleTo(User $user, Builder $query): Builder
    {
        if (self::canViewAll($user)) {
            return $query;
        }

        $employeeId = self::employeeId($user);

        return $query->where(fn (Builder $query) => $query
            ->where('foreman_user_id', $user->id)
            ->when($employeeId, fn (Builder $query) => $query
                ->orWhere('quality_control_employee_id', $employeeId)));
    }

    public static function canView(User $user, EmployeeWorkSchedule $schedule): bool
    {
        return self::visibleTo($user, EmployeeWorkSchedule::query()->whereKey($schedule->id))->exists();
    }

    public static function canUpdateProgress(User $user, EmployeeWorkSchedule $schedule): bool
    {
        return self::canViewAll($user) || (int) $schedule->foreman_user_id === (int) $user->id;
    }

    public static function canInspect(User $user, EmployeeWorkSchedule $schedule): bool
    {
        if (self::canViewAll($user)) {
            return true;
        }

        $employeeId = self::employeeId($user);

        return $employeeId !== null && (int) $schedule->quality_control_employee_id === $employeeId;
    }

    private static function isQualityControl(User $user): bool
    {
        $employeeId = self::employeeId($user);

        return $employeeId !== null
            && EmployeeWorkSchedule::query()->where('quality_control_employee_id', $employeeId)->exists();
    }

    private static function employeeId(User $user): ?int
    {
        $id = Employee::query()->where('user_id', $user->id)->value('id');

        return $id !== null ? (int) $id : null;
    }
}
