<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\EmployeeAttendanceDay;
use App\Models\EmployeeAttendanceWeek;
use App\Models\EmployeePayRate;
use App\Models\EmployeeWorkSchedule;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Carbon;

/**
 * Links a work schedule's crew to the payroll attendance records: when the foreman
 * marks who showed up, the attendance day for that employee is created or updated.
 */
class ScheduleAttendance
{
    public const DEFAULT_HOURS = '8.00';

    /**
     * @return list<array<string, mixed>>
     */
    public static function forForeman(User $user, string $date): array
    {
        return EmployeeWorkSchedule::query()
            ->with(['project:id,uuid,name,project_number', 'employees', 'competentPerson', 'qualityControl'])
            ->where('foreman_user_id', $user->id)
            ->where('status', EmployeeWorkSchedule::STATUS_ACTIVE)
            ->covering($date)
            ->orderBy('starts_on')
            ->orderBy('id')
            ->get()
            ->map(fn (EmployeeWorkSchedule $schedule): array => self::payload($schedule, $date))
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public static function payload(EmployeeWorkSchedule $schedule, string $date): array
    {
        $members = self::members($schedule);
        $days = EmployeeAttendanceDay::query()
            ->whereDate('work_date', $date)
            ->whereHas('week', fn ($query) => $query->whereIn('employee_id', $members->pluck('id')))
            ->with('week:id,employee_id')
            ->get()
            ->keyBy(fn (EmployeeAttendanceDay $day): int => (int) $day->week->employee_id);

        return [
            'schedule_uuid' => $schedule->uuid,
            'date' => $date,
            'project' => $schedule->project
                ? ['name' => $schedule->project->name, 'project_number' => $schedule->project->project_number]
                : null,
            'members' => $members->map(function (Employee $employee) use ($schedule, $days): array {
                $day = $days->get($employee->id);
                $rate = CrewAssignments::rateFor($schedule, $employee) ?? self::defaultRate($employee);
                $foreman = $employee->user_id !== null && (int) $employee->user_id === (int) $schedule->foreman_user_id;
                $elsewhere = $day
                    && $day->employee_work_schedule_id !== null
                    && (int) $day->employee_work_schedule_id !== $schedule->id;

                return [
                    'uuid' => $employee->uuid,
                    'name' => $employee->fullName(),
                    'skill' => $rate?->skill?->name,
                    'options' => CrewAssignments::options($employee),
                    'pay_rate_id' => $rate?->id,
                    'skill_id' => $rate?->skill_id,
                    'rate_label' => $rate ? self::rateLabel($rate) : null,
                    'is_foreman' => $foreman,
                    'present' => (bool) ($day?->worked) && ! $elsewhere,
                    'hours' => $day?->hours !== null ? number_format((float) $day->hours, 2, '.', '') : null,
                    'hourly' => ($day?->rate_type ?? $rate?->rate_type) === EmployeePayRate::RATE_HOURLY,
                    'has_rate' => $rate !== null || $day !== null,
                    'locked' => $elsewhere,
                ];
            })->values()->all(),
        ];
    }

    /**
     * @param  list<array{employee_uuid: string, present: bool, hours?: mixed}>  $entries
     * @return array<string, string> errors keyed by employee uuid
     */
    public static function record(EmployeeWorkSchedule $schedule, string $date, array $entries): array
    {
        $members = self::members($schedule)->keyBy('uuid');
        $workDate = Carbon::parse($date)->startOfDay();
        $errors = [];

        foreach ($entries as $entry) {
            $employee = $members->get($entry['employee_uuid'] ?? '');

            if (! $employee) {
                continue;
            }

            $day = self::existingDay($employee, $workDate);

            if ($day && $day->employee_work_schedule_id !== null && (int) $day->employee_work_schedule_id !== $schedule->id) {
                $errors[$employee->uuid] = 'Already recorded on another job today.';

                continue;
            }

            if (! $entry['present']) {
                if ($day && (int) $day->employee_work_schedule_id === $schedule->id) {
                    $day->delete();
                }

                continue;
            }

            if ($day) {
                $attributes = ['worked' => true, 'scheduled' => true, 'employee_work_schedule_id' => $schedule->id];

                if ($day->rate_type === EmployeePayRate::RATE_HOURLY) {
                    $hours = self::validHours($entry['hours'] ?? null, $day->hours);

                    if ($hours === null) {
                        $errors[$employee->uuid] = 'Enter the hours worked (up to 24).';

                        continue;
                    }

                    $attributes['hours'] = $hours;
                }

                $day->update($attributes);

                continue;
            }

            $rate = CrewAssignments::rateFor($schedule, $employee) ?? self::defaultRate($employee);

            if (! $rate) {
                $errors[$employee->uuid] = 'No pay rate on file. Ask the office to add one.';

                continue;
            }

            $hours = null;

            if ($rate->rate_type === EmployeePayRate::RATE_HOURLY) {
                $hours = self::validHours($entry['hours'] ?? null, self::DEFAULT_HOURS);

                if ($hours === null) {
                    $errors[$employee->uuid] = 'Enter the hours worked (up to 24).';

                    continue;
                }
            }

            $week = EmployeeAttendanceWeek::query()->firstOrCreate([
                'employee_id' => $employee->id,
                'week_start' => EmployeeAttendanceWeek::mondayOf($workDate->toDateString())->toDateString(),
            ]);

            $week->days()->create([
                'work_date' => $workDate->toDateString(),
                'skill_id' => $rate->skill_id,
                'profession_id' => $rate->profession_id,
                'employee_pay_rate_id' => $rate->id,
                'rate_type' => $rate->rate_type,
                'custom_rate_type' => $rate->rate_type === EmployeePayRate::RATE_CUSTOM ? $rate->custom_rate_type : null,
                'amount' => $rate->amount,
                'hours' => $hours,
                'scheduled' => true,
                'worked' => true,
                'employee_work_schedule_id' => $schedule->id,
            ]);
        }

        return $errors;
    }

    /**
     * The foreman, the crew, the competent person and the quality control person, once each.
     *
     * @return Collection<int, Employee>
     */
    public static function members(EmployeeWorkSchedule $schedule): Collection
    {
        $schedule->loadMissing(['employees', 'competentPerson', 'qualityControl']);

        $foreman = Employee::query()->where('user_id', $schedule->foreman_user_id)->get();

        return $foreman
            ->concat($schedule->employees)
            ->concat(array_filter([$schedule->competentPerson, $schedule->qualityControl]))
            ->unique('id')
            ->values();
    }

    private static function existingDay(Employee $employee, Carbon $date): ?EmployeeAttendanceDay
    {
        return EmployeeAttendanceDay::query()
            ->whereDate('work_date', $date->toDateString())
            ->whereHas('week', fn ($query) => $query->where('employee_id', $employee->id))
            ->first();
    }

    /**
     * Days worked, hours and pay per employee for each week of the schedule.
     * Hourly rates pay amount x hours; every other rate pays its amount per day.
     *
     * @return array{weeks: list<array<string, mixed>>, total_hours: string, total_pay: string}
     */
    public static function summary(EmployeeWorkSchedule $schedule): array
    {
        $days = EmployeeAttendanceDay::query()
            ->where('employee_work_schedule_id', $schedule->id)
            ->where('worked', true)
            ->with('week.employee:id,first_name,last_name')
            ->orderBy('work_date')
            ->get();

        $pay = fn (EmployeeAttendanceDay $day): float => $day->rate_type === EmployeePayRate::RATE_HOURLY
            ? (float) $day->amount * (float) $day->hours
            : (float) $day->amount;

        $weeks = $days->groupBy(fn (EmployeeAttendanceDay $day): string => $day->week->week_start->toDateString())
            ->sortKeys()
            ->map(function (Collection $weekDays, string $start) use ($pay): array {
                $employees = $weekDays->groupBy('week.employee_id')->map(fn (Collection $items): array => [
                    'name' => $items->first()->week->employee?->fullName() ?? 'Employee',
                    'days' => $items->count(),
                    'hours' => round((float) $items->sum('hours'), 2),
                    'pay' => round($items->sum($pay), 2),
                ])->sortBy('name')->values();

                return [
                    'week_start' => $start,
                    'week_end' => Carbon::parse($start)->addDays(6)->toDateString(),
                    'employees' => $employees->all(),
                    'hours' => round((float) $employees->sum('hours'), 2),
                    'pay' => round((float) $employees->sum('pay'), 2),
                ];
            })->values();

        return [
            'weeks' => $weeks->all(),
            'total_hours' => number_format((float) $weeks->sum('hours'), 2, '.', ''),
            'total_pay' => number_format((float) $weeks->sum('pay'), 2, '.', ''),
        ];
    }

    /**
     * @param  array<string, mixed>  $summary
     * @return array<string, mixed>
     */
    public static function withoutPay(array $summary): array
    {
        $summary['total_pay'] = '0.00';

        foreach ($summary['weeks'] as &$week) {
            $week['pay'] = 0;

            foreach ($week['employees'] as &$employee) {
                $employee['pay'] = 0;
            }
        }

        return $summary;
    }

    private static function rateLabel(EmployeePayRate $rate): string
    {
        $type = $rate->rate_type === EmployeePayRate::RATE_CUSTOM
            ? ($rate->custom_rate_type ?: 'Custom')
            : ucfirst(str_replace('_', ' ', $rate->rate_type));

        return $type.' · $'.number_format((float) $rate->amount, 2);
    }

    /** A daily rate is preferred, then hourly, then whichever rate was added first. */
    private static function defaultRate(Employee $employee): ?EmployeePayRate
    {
        $rates = $employee->payRates()->orderBy('id')->get();

        return $rates->firstWhere('rate_type', EmployeePayRate::RATE_DAILY)
            ?? $rates->firstWhere('rate_type', EmployeePayRate::RATE_HOURLY)
            ?? $rates->first();
    }

    private static function validHours(mixed $hours, mixed $fallback): ?string
    {
        $value = ($hours === null || $hours === '') ? $fallback : $hours;

        if (! is_numeric($value) || (float) $value < 0.01 || (float) $value > 24) {
            return null;
        }

        return number_format((float) $value, 2, '.', '');
    }
}
