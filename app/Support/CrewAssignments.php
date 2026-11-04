<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\EmployeePayRate;
use App\Models\EmployeeWorkSchedule;

/**
 * The skill and pay rate each employee is hired for on a job crew.
 */
class CrewAssignments
{
    /**
     * @return array<string, array{skill_id: int|null, employee_pay_rate_id: int|null}> keyed by employee uuid
     */
    public static function forSchedule(EmployeeWorkSchedule $schedule): array
    {
        return $schedule->employees()->get()->mapWithKeys(fn (Employee $employee): array => [
            $employee->uuid => [
                'skill_id' => $employee->pivot->skill_id,
                'employee_pay_rate_id' => $employee->pivot->employee_pay_rate_id,
            ],
        ])->all();
    }

    /**
     * Returns the pivot attributes, or null when the rate does not belong to the employee.
     *
     * @return array{skill_id: int|null, employee_pay_rate_id: int|null}|null
     */
    public static function resolve(Employee $employee, mixed $skillId, mixed $rateId): ?array
    {
        $rate = null;

        if ($rateId !== null && $rateId !== '') {
            $rate = EmployeePayRate::query()->where('employee_id', $employee->id)->find($rateId);

            if (! $rate) {
                return null;
            }

            $skillId = $rate->skill_id ?? $skillId;
        }

        if ($skillId !== null && $skillId !== '' && ! $employee->skills()->whereKey($skillId)->exists()
            && ! $employee->payRates()->where('skill_id', $skillId)->exists()) {
            return null;
        }

        return [
            'skill_id' => $skillId !== null && $skillId !== '' ? (int) $skillId : null,
            'employee_pay_rate_id' => $rate?->id,
        ];
    }

    /** The crew rate wins over the employee's default rate. */
    public static function rateFor(EmployeeWorkSchedule $schedule, Employee $employee): ?EmployeePayRate
    {
        $id = $schedule->employees()->whereKey($employee->id)->first()?->pivot->employee_pay_rate_id;

        return $id ? EmployeePayRate::query()->where('employee_id', $employee->id)->find($id) : null;
    }

    /**
     * Skills the employee has, each with the pay rates recorded for it.
     *
     * @return list<array<string, mixed>>
     */
    public static function options(Employee $employee): array
    {
        $employee->loadMissing(['skills:skills.id,skills.name', 'payRates.skill:id,name']);

        $groups = $employee->skills
            ->map(fn ($skill): array => ['id' => $skill->id, 'name' => $skill->name])
            ->keyBy('id');

        foreach ($employee->payRates as $rate) {
            if ($rate->skill_id && ! $groups->has($rate->skill_id)) {
                $groups->put($rate->skill_id, ['id' => $rate->skill_id, 'name' => $rate->skill?->name ?? 'Skill removed']);
            }
        }

        $labels = ['half_day' => 'Half day', 'day_off' => 'Day off'];

        return $groups->sortBy('name')->values()->map(fn (array $group): array => [
            ...$group,
            'rates' => $employee->payRates
                ->where('skill_id', $group['id'])
                ->map(fn ($rate): array => [
                    'id' => $rate->id,
                    'label' => $rate->rate_type === 'custom'
                        ? ($rate->custom_rate_type ?: 'Custom')
                        : ($labels[$rate->rate_type] ?? ucfirst(str_replace('_', ' ', $rate->rate_type))),
                    'amount' => (string) $rate->amount,
                    'notes' => $rate->notes,
                ])
                ->values()
                ->all(),
        ])->all();
    }
}
