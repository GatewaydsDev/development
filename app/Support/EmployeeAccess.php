<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\EmployeeAttendanceListing;
use App\Models\EmployeeAttendanceWeek;
use App\Models\EmployeeWorkSchedule;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Database\Eloquent\Builder;

class EmployeeAccess
{
    /**
     * @return list<string>
     */
    public static function managerLevels(): array
    {
        return [
            UserLevel::SUPER_ADMIN,
            UserLevel::ADMINISTRATOR,
            UserLevel::ADMIN,
        ];
    }

    public static function canView(User $user): bool
    {
        return self::canOpenSection($user) && $user->hasPermission('view-employees');
    }

    public static function canCreate(User $user): bool
    {
        return self::isManager($user) && $user->hasPermission('create-employees');
    }

    public static function canUpdate(User $user): bool
    {
        return self::isManager($user) && $user->hasPermission('update-employees');
    }

    public static function canDelete(User $user): bool
    {
        return self::isManager($user) && $user->hasPermission('delete-employees');
    }

    public static function canViewEmployee(User $user, Employee $employee): bool
    {
        if (! self::canView($user)) {
            return false;
        }

        if (! self::isForeman($user)) {
            return true;
        }

        return (int) $employee->foreman_user_id === (int) $user->id;
    }

    public static function ensureCanViewEmployee(User $user, Employee $employee): void
    {
        abort_unless(self::canViewEmployee($user, $employee), 403);
    }

    public static function ensureCanViewWeek(User $user, EmployeeAttendanceWeek $week): void
    {
        $week->loadMissing('employee');

        abort_unless(
            $week->employee instanceof Employee && self::canViewEmployee($user, $week->employee),
            403,
        );
    }

    /**
     * @param  Builder<Employee>  $query
     * @return Builder<Employee>
     */
    public static function scopeVisibleEmployees(Builder $query, User $user): Builder
    {
        if (self::isForeman($user)) {
            $query->where('foreman_user_id', $user->id);
        }

        return $query;
    }

    /**
     * @param  Builder<EmployeeAttendanceWeek>  $query
     * @return Builder<EmployeeAttendanceWeek>
     */
    public static function scopeVisibleWeeks(Builder $query, User $user): Builder
    {
        if (self::isForeman($user)) {
            $query->whereHas('employee', fn (Builder $employee) => $employee->where('foreman_user_id', $user->id));
        }

        return $query;
    }

    /**
     * @param  Builder<EmployeeAttendanceListing>  $query
     * @return Builder<EmployeeAttendanceListing>
     */
    public static function scopeVisibleListings(Builder $query, User $user): Builder
    {
        if (self::isForeman($user)) {
            $query->where('foreman_user_id', $user->id);
        }

        return $query;
    }

    /**
     * @param  Builder<EmployeeWorkSchedule>  $query
     * @return Builder<EmployeeWorkSchedule>
     */
    public static function scopeVisibleSchedules(Builder $query, User $user): Builder
    {
        if (self::isForeman($user)) {
            $query->where('foreman_user_id', $user->id);
        }

        return $query;
    }

    public static function ensureCanViewSchedule(User $user, EmployeeWorkSchedule $schedule): void
    {
        abort_unless(self::canView($user), 403);

        if (self::isForeman($user)) {
            abort_unless((int) $schedule->foreman_user_id === (int) $user->id, 403);
        }
    }

    public static function isForeman(User $user): bool
    {
        return $user->hasUserLevel(UserLevel::FOREMAN);
    }

    public static function isManager(User $user): bool
    {
        return $user->hasUserLevel(self::managerLevels());
    }

    private static function canOpenSection(User $user): bool
    {
        return self::isManager($user) || self::isForeman($user);
    }
}
