<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAttendanceDay;
use App\Models\EmployeeAttendanceListing;
use App\Models\EmployeeAttendanceWeek;
use App\Models\EmployeePayRate;
use App\Models\Profession;
use App\Models\Skill;
use App\Support\EmployeeAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeAttendanceController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless(EmployeeAccess::canView($request->user()), 403);

        $search = trim((string) $request->query('search', ''));
        $week = $this->weekQuery($request->query('week'));
        [$from, $to] = $this->dateRange($request->query('from'), $request->query('to'));

        $weeks = EmployeeAccess::scopeVisibleListings(EmployeeAttendanceListing::query(), $request->user())
            ->with('week:id,uuid')
            ->tap(fn (Builder $query) => $this->applyListFilters($query, $search, $week, $from, $to))
            ->orderByDesc('week_start')
            ->orderByDesc('id')
            ->paginate(12)
            ->withQueryString()
            ->through(fn (EmployeeAttendanceListing $listing): array => $this->listingPayload($listing));

        return Inertia::render('Admin/EmployeeAttendance/Index', [
            'filters' => [
                'search' => $search,
                'from' => $from ?? '',
                'to' => $to ?? '',
            ],
            'weeks' => $weeks,
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless(EmployeeAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/EmployeeAttendance/Create', [
            'employees' => $this->employeeOptions(),
            'defaultWeekStart' => now()->startOfWeek(Carbon::MONDAY)->toDateString(),
        ]);
    }

    public function existing(Request $request): JsonResponse
    {
        abort_unless(EmployeeAccess::canCreate($request->user()), 403);

        $validated = $request->validate([
            'employee_id' => ['required', 'integer', Rule::exists(Employee::class, 'id')],
            'week_start' => ['required', 'date'],
        ]);

        $employee = Employee::query()->findOrFail($validated['employee_id']);
        EmployeeAccess::ensureCanViewEmployee($request->user(), $employee);

        $monday = EmployeeAttendanceWeek::mondayOf($validated['week_start'])->toDateString();
        $week = EmployeeAttendanceWeek::query()
            ->where('employee_id', $employee->id)
            ->whereDate('week_start', $monday)
            ->first();

        return response()->json([
            'attendance' => $week ? $this->presentWeek($week->id) : null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(EmployeeAccess::canCreate($request->user()), 403);

        $this->saveWeek($request);

        return redirect()
            ->route('admin.employee-attendance.index')
            ->with('success', 'Attendance week saved.');
    }

    public function edit(Request $request, EmployeeAttendanceWeek $attendanceWeek): Response
    {
        abort_unless(EmployeeAccess::canUpdate($request->user()), 403);
        EmployeeAccess::ensureCanViewWeek($request->user(), $attendanceWeek);

        return Inertia::render('Admin/EmployeeAttendance/Edit', [
            'attendance' => $this->presentWeek($attendanceWeek->id),
            'employees' => $this->employeeOptions(),
        ]);
    }

    public function update(Request $request, EmployeeAttendanceWeek $attendanceWeek): RedirectResponse
    {
        abort_unless(EmployeeAccess::canUpdate($request->user()), 403);
        EmployeeAccess::ensureCanViewWeek($request->user(), $attendanceWeek);

        $this->saveWeek($request, $attendanceWeek);

        return redirect()
            ->route('admin.employee-attendance.index')
            ->with('success', 'Attendance week updated.');
    }

    public function destroy(Request $request, EmployeeAttendanceWeek $attendanceWeek): RedirectResponse
    {
        abort_unless(EmployeeAccess::canDelete($request->user()), 403);
        EmployeeAccess::ensureCanViewWeek($request->user(), $attendanceWeek);

        $attendanceWeek->delete();

        return redirect()
            ->route('admin.employee-attendance.index')
            ->with('success', 'Attendance week removed.');
    }

    public function bulkCreate(Request $request): Response
    {
        abort_unless(EmployeeAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/EmployeeAttendance/Bulk', [
            'employees' => $this->employeeOptions(),
            'defaultWorkDate' => $this->defaultWorkDate(),
        ]);
    }

    public function bulkStore(Request $request): RedirectResponse
    {
        abort_unless(EmployeeAccess::canCreate($request->user()), 403);

        $weeks = $this->saveBulk($request);
        $count = count($weeks);

        return redirect()
            ->route('admin.employee-attendance.index')
            ->with('success', $count === 1
                ? 'Attendance saved for 1 employee.'
                : "Attendance saved for {$count} employees.");
    }

    /**
     * @return list<EmployeeAttendanceWeek>
     */
    public function saveBulk(Request $request): array
    {
        return DB::transaction(function () use ($request): array {
            $validated = $this->validatedBulk($request);
            $workDate = $validated['work_date'];
            $monday = EmployeeAttendanceWeek::mondayOf($workDate)->toDateString();
            $weeks = [];

            foreach ($validated['employees'] as $row) {
                $employee = Employee::query()->findOrFail($row['employee_id']);
                EmployeeAccess::ensureCanViewEmployee($request->user(), $employee);

                $week = EmployeeAttendanceWeek::query()
                    ->where('employee_id', $row['employee_id'])
                    ->whereDate('week_start', $monday)
                    ->first();

                if (! $week) {
                    $week = EmployeeAttendanceWeek::create([
                        'employee_id' => $row['employee_id'],
                        'week_start' => $monday,
                    ]);
                }

                $rate = EmployeePayRate::query()->findOrFail($row['pay_rate_id']);
                $attributes = [
                    'skill_id' => $rate->skill_id,
                    'profession_id' => $rate->profession_id,
                    'employee_pay_rate_id' => $rate->id,
                    'rate_type' => $rate->rate_type,
                    'custom_rate_type' => $rate->rate_type === EmployeePayRate::RATE_CUSTOM
                        ? $rate->custom_rate_type
                        : null,
                    'amount' => $rate->amount,
                    'hours' => $row['hours'] ?? null,
                    'scheduled' => $validated['scheduled'],
                    'worked' => $validated['worked'],
                    'notes' => $validated['notes'] ?? null,
                ];
                $day = $week->days()->whereDate('work_date', $workDate)->first();

                if ($day) {
                    $day->update($attributes);
                } else {
                    $week->days()->create([
                        'work_date' => $workDate,
                        ...$attributes,
                    ]);
                }

                $weeks[] = $week->load($this->weekRelations());
            }

            return $weeks;
        });
    }

    public function saveWeek(Request $request, ?EmployeeAttendanceWeek $week = null): EmployeeAttendanceWeek
    {
        return DB::transaction(function () use ($request, $week): EmployeeAttendanceWeek {
            $validated = $this->validatedWeek($request, $week);
            $activeDays = collect($validated['days'])
                ->filter(fn (array $day): bool => $day['scheduled'] || $day['worked'])
                ->values();

            $employee = Employee::query()->findOrFail($validated['employee_id']);
            EmployeeAccess::ensureCanViewEmployee($request->user(), $employee);

            if ($week) {
                $week->update([
                    'employee_id' => $validated['employee_id'],
                    'week_start' => $validated['week_start'],
                    'notes' => $validated['notes'] ?? null,
                ]);
                $week->days()->delete();
                $activeDays->each(fn (array $day) => $this->createAttendanceDay($week, $day));

                return $week->load($this->weekRelations());
            }

            $existing = EmployeeAttendanceWeek::query()
                ->where('employee_id', $validated['employee_id'])
                ->whereDate('week_start', $validated['week_start'])
                ->first();

            if ($existing) {
                $notes = $validated['notes'] ?? null;

                if (filled($notes)) {
                    $existing->update([
                        'notes' => filled($existing->notes)
                            ? trim($existing->notes."\n".$notes)
                            : $notes,
                    ]);
                }

                $activeDays->each(fn (array $day) => $this->createAttendanceDay($existing, $day));

                return $existing->load($this->weekRelations());
            }

            $week = EmployeeAttendanceWeek::create([
                'employee_id' => $validated['employee_id'],
                'week_start' => $validated['week_start'],
                'notes' => $validated['notes'] ?? null,
            ]);
            $activeDays->each(fn (array $day) => $this->createAttendanceDay($week, $day));

            return $week->load($this->weekRelations());
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function weekPayload(EmployeeAttendanceWeek $week): array
    {
        return $this->presentWeek($week->id);
    }

    /**
     * @return array<string, mixed>
     */
    public function presentWeek(int $weekId): array
    {
        return $this->listingPayload(
            EmployeeAttendanceListing::query()->with('week:id,uuid')->findOrFail($weekId),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function listingPayload(EmployeeAttendanceListing $listing): array
    {
        $listing->loadMissing('week:id,uuid');
        $start = $listing->week_start;
        $end = $listing->week_end;
        $employee = is_array($listing->employee) ? $listing->employee : null;
        $days = collect($listing->days ?? [])
            ->filter(fn (mixed $day): bool => is_array($day))
            ->sortBy(fn (array $day): string => (string) ($day['work_date'] ?? ''))
            ->map(fn (array $day): array => $this->listingDayPayload($day))
            ->values()
            ->all();

        return [
            'id' => $listing->id,
            'uuid' => $listing->week?->uuid,
            'employee_id' => $listing->employee_id,
            'employee' => [
                'id' => (int) ($employee['id'] ?? $listing->employee_id),
                'full_name' => (string) ($employee['full_name'] ?? $listing->employee_full_name),
                'email' => (string) ($employee['email'] ?? $listing->employee_email),
            ],
            'week_start' => $start?->toDateString(),
            'week_end' => $end?->toDateString(),
            'week_label' => $start && $end
                ? $start->format('l, M j').' – '.$end->format('l, M j, Y')
                : null,
            'notes' => $listing->notes,
            'scheduled_count' => $listing->scheduled_count,
            'worked_count' => $listing->worked_count,
            'pay_total' => $this->weekPayTotal($days),
            'days' => $days,
            'created_at' => $listing->created_at?->toISOString(),
            'updated_at' => $listing->updated_at?->toISOString(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function employeeOptions(): array
    {
        return EmployeeAccess::scopeVisibleEmployees(Employee::query(), request()->user())
            ->with([
                'professions:id,name',
                'skills:id,name',
                'payRates:id,employee_id,profession_id,skill_id,rate_type,custom_rate_type,amount',
            ])
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get()
            ->map(function (Employee $employee): array {
                $ratesByProfession = $employee->payRates->groupBy('profession_id');
                $ratesBySkill = $employee->payRates->groupBy('skill_id');
                $ratePayload = fn (EmployeePayRate $rate): array => [
                    'id' => $rate->id,
                    'rate_type' => $rate->rate_type,
                    'custom_rate_type' => $rate->custom_rate_type,
                    'amount' => $rate->amount,
                    'label' => $this->rateLabel(
                        $rate->rate_type,
                        $rate->custom_rate_type,
                        (string) $rate->amount,
                    ),
                ];

                return [
                    'id' => $employee->id,
                    'full_name' => $employee->fullName(),
                    'email' => $employee->email,
                    'professions' => $employee->professions
                        ->sortBy('name')
                        ->values()
                        ->map(fn (Profession $profession): array => [
                            'id' => $profession->id,
                            'name' => $profession->name,
                            'rates' => $ratesByProfession
                                ->get($profession->id, collect())
                                ->map($ratePayload)
                                ->values()
                                ->all(),
                        ])
                        ->all(),
                    'skills' => $employee->skills
                        ->sortBy('name')
                        ->values()
                        ->map(fn (Skill $skill): array => [
                            'id' => $skill->id,
                            'name' => $skill->name,
                            'rates' => $ratesBySkill
                                ->get($skill->id, collect())
                                ->map($ratePayload)
                                ->values()
                                ->all(),
                        ])
                        ->all(),
                ];
            })
            ->all();
    }

    /**
     * @return list<string>
     */
    public function weekRelations(): array
    {
        return [
            'employee:id,first_name,last_name,email',
            'days.profession:id,name',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedWeek(Request $request, ?EmployeeAttendanceWeek $week = null): array
    {
        $days = collect($request->input('days', []))
            ->map(function (mixed $day): array {
                $day = is_array($day) ? $day : [];

                return [
                    'work_date' => is_string($day['work_date'] ?? null)
                        ? substr($day['work_date'], 0, 10)
                        : ($day['work_date'] ?? null),
                    'skill_id' => ($day['skill_id'] ?? '') === '' ? null : $day['skill_id'],
                    'profession_id' => ($day['profession_id'] ?? '') === '' ? null : $day['profession_id'],
                    'pay_rate_id' => ($day['pay_rate_id'] ?? '') === '' ? null : $day['pay_rate_id'],
                    'hours' => ($day['hours'] ?? '') === '' ? null : $day['hours'],
                    'scheduled' => filter_var($day['scheduled'] ?? false, FILTER_VALIDATE_BOOLEAN),
                    'worked' => filter_var($day['worked'] ?? false, FILTER_VALIDATE_BOOLEAN),
                    'notes' => ($day['notes'] ?? '') === '' ? null : $day['notes'],
                ];
            })
            ->all();

        $weekStart = $request->input('week_start');

        if (is_string($weekStart) && preg_match('/^\d{4}-\d{2}-\d{2}/', $weekStart) === 1) {
            try {
                $weekStart = EmployeeAttendanceWeek::mondayOf($weekStart)->toDateString();
            } catch (\Throwable) {
                // Leave the raw value for the date rule.
            }
        }

        $request->merge([
            'week_start' => $weekStart,
            'notes' => ($request->input('notes') ?? '') === '' ? null : $request->input('notes'),
            'days' => $days,
        ]);

        $validated = $request->validate([
            'employee_id' => ['required', 'integer', Rule::exists(Employee::class, 'id')],
            'week_start' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'days' => ['required', 'array', 'min:1'],
            'days.*.work_date' => ['required', 'date'],
            'days.*.skill_id' => ['nullable', 'integer'],
            'days.*.profession_id' => ['nullable', 'integer'],
            'days.*.pay_rate_id' => ['nullable', 'integer'],
            'days.*.hours' => ['nullable', 'numeric'],
            'days.*.scheduled' => ['required', 'boolean'],
            'days.*.worked' => ['required', 'boolean'],
            'days.*.notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'days.required' => 'Add at least one Monday through Saturday day.',
            'days.min' => 'Add at least one Monday through Saturday day.',
        ]);

        $monday = EmployeeAttendanceWeek::mondayOf($validated['week_start'])->startOfDay();
        $saturday = $monday->copy()->addDays(5);
        $existingWeek = EmployeeAttendanceWeek::query()
            ->where('employee_id', $validated['employee_id'])
            ->whereDate('week_start', $monday->toDateString())
            ->when($week, fn ($query) => $query->whereKeyNot($week->getKey()))
            ->with('days')
            ->first();

        if ($existingWeek && $week) {
            throw ValidationException::withMessages([
                'week_start' => 'This employee already has attendance for that work week.',
            ]);
        }

        $takenDates = $existingWeek
            ? $existingWeek->days
                ->map(fn (EmployeeAttendanceDay $day): string => $day->work_date->toDateString())
                ->all()
            : [];
        $seenDates = [];
        $activeCount = 0;

        foreach ($validated['days'] as $index => $day) {
            $workDate = Carbon::parse($day['work_date'])->startOfDay();

            if ($workDate->lt($monday) || $workDate->gt($saturday)) {
                throw ValidationException::withMessages([
                    "days.{$index}.work_date" => 'Choose a Monday through Saturday in this work week.',
                ]);
            }

            $dateKey = $workDate->toDateString();

            if (isset($seenDates[$dateKey])) {
                throw ValidationException::withMessages([
                    "days.{$index}.work_date" => 'This day is already listed in the week.',
                ]);
            }

            $seenDates[$dateKey] = true;
            $validated['days'][$index]['work_date'] = $dateKey;

            if (in_array($dateKey, $takenDates, true) && ($day['scheduled'] || $day['worked'])) {
                $weekday = EmployeeAttendanceWeek::weekdayFor($workDate);
                $label = $weekday['label'] ?? 'This day';

                throw ValidationException::withMessages([
                    "days.{$index}.work_date" => "{$label} already has attendance. Enter a day that is still open.",
                ]);
            }

            if (! $day['scheduled'] && ! $day['worked']) {
                continue;
            }

            $activeCount++;

            if ((blank($day['skill_id']) && blank($day['profession_id'])) || blank($day['pay_rate_id'])) {
                throw ValidationException::withMessages([
                    "days.{$index}.pay_rate_id" => 'Choose the skill and rate for this day.',
                ]);
            }

            $rateQuery = EmployeePayRate::query()
                ->whereKey($day['pay_rate_id'])
                ->where('employee_id', $validated['employee_id']);

            if (filled($day['skill_id'])) {
                $rateQuery->where('skill_id', $day['skill_id']);
            } else {
                $rateQuery->where('profession_id', $day['profession_id']);
            }

            $rate = $rateQuery->first();

            if (! $rate) {
                throw ValidationException::withMessages([
                    "days.{$index}.pay_rate_id" => 'Choose a rate assigned to this employee and skill.',
                ]);
            }

            $validated['days'][$index]['hours'] = $this->validatedHours(
                $rate,
                $day['hours'] ?? null,
                "days.{$index}.hours",
            );
        }

        if ($activeCount === 0) {
            throw ValidationException::withMessages([
                'days' => 'Mark at least one Monday through Saturday day as scheduled or worked.',
            ]);
        }

        $validated['week_start'] = $monday->toDateString();

        return $validated;
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * @param  array<string, mixed>  $day
     * @return array<string, mixed>
     */
    private function listingDayPayload(array $day): array
    {
        $amount = number_format((float) ($day['amount'] ?? 0), 2, '.', '');
        $rateType = (string) ($day['rate_type'] ?? '');
        $customRateType = isset($day['custom_rate_type']) && $day['custom_rate_type'] !== ''
            ? (string) $day['custom_rate_type']
            : null;
        $skill = is_array($day['skill'] ?? null) ? $day['skill'] : null;
        $profession = is_array($day['profession'] ?? null) ? $day['profession'] : null;

        return [
            'id' => (int) ($day['id'] ?? 0),
            'work_date' => substr((string) ($day['work_date'] ?? ''), 0, 10),
            'weekday' => $day['weekday'] ?? null,
            'weekday_label' => $day['weekday_label'] ?? null,
            'weekday_short' => $day['weekday_short'] ?? null,
            'skill_id' => isset($day['skill_id']) && $day['skill_id'] !== null
                ? (int) $day['skill_id']
                : null,
            'skill' => $skill && isset($skill['id'])
                ? [
                    'id' => (int) $skill['id'],
                    'name' => (string) ($skill['name'] ?? ''),
                ]
                : null,
            'profession_id' => (int) ($day['profession_id'] ?? 0),
            'profession' => $profession && isset($profession['id'])
                ? [
                    'id' => (int) $profession['id'],
                    'name' => (string) ($profession['name'] ?? ''),
                ]
                : null,
            'pay_rate_id' => isset($day['pay_rate_id']) && $day['pay_rate_id'] !== null
                ? (int) $day['pay_rate_id']
                : null,
            'rate_type' => $rateType,
            'custom_rate_type' => $customRateType,
            'amount' => $amount,
            'hours' => $this->hoursValue($day['hours'] ?? null),
            'rate_label' => $this->rateLabel($rateType, $customRateType, $amount),
            'scheduled' => filter_var($day['scheduled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'worked' => filter_var($day['worked'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'notes' => isset($day['notes']) && $day['notes'] !== '' ? $day['notes'] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function dayPayload(EmployeeAttendanceDay $day): array
    {
        $weekday = $day->work_date
            ? EmployeeAttendanceWeek::weekdayFor($day->work_date)
            : null;

        return [
            'id' => $day->id,
            'work_date' => $day->work_date?->toDateString(),
            'weekday' => $weekday['key'] ?? null,
            'weekday_label' => $weekday['label'] ?? null,
            'weekday_short' => $weekday['short'] ?? null,
            'profession_id' => $day->profession_id,
            'profession' => $day->profession
                ? [
                    'id' => $day->profession->id,
                    'name' => $day->profession->name,
                ]
                : null,
            'pay_rate_id' => $day->employee_pay_rate_id,
            'rate_type' => $day->rate_type,
            'custom_rate_type' => $day->custom_rate_type,
            'amount' => $day->amount,
            'hours' => $this->hoursValue($day->hours),
            'rate_label' => $this->rateLabel($day->rate_type, $day->custom_rate_type, (string) $day->amount),
            'scheduled' => $day->scheduled,
            'worked' => $day->worked,
            'notes' => $day->notes,
        ];
    }

    /**
     * @param  array<string, mixed>  $day
     */
    private function createAttendanceDay(EmployeeAttendanceWeek $week, array $day): void
    {
        $rate = EmployeePayRate::query()->findOrFail($day['pay_rate_id']);

        $week->days()->create([
            'work_date' => Carbon::parse($day['work_date'])->toDateString(),
            'skill_id' => $rate->skill_id,
            'profession_id' => $rate->profession_id,
            'employee_pay_rate_id' => $rate->id,
            'rate_type' => $rate->rate_type,
            'custom_rate_type' => $rate->rate_type === EmployeePayRate::RATE_CUSTOM
                ? $rate->custom_rate_type
                : null,
            'amount' => $rate->amount,
            'hours' => $day['hours'] ?? null,
            'scheduled' => $day['scheduled'],
            'worked' => $day['worked'],
            'notes' => $day['notes'] ?? null,
        ]);
    }

    private function validatedHours(EmployeePayRate $rate, mixed $hours, string $key): ?string
    {
        if ($rate->rate_type !== EmployeePayRate::RATE_HOURLY) {
            return null;
        }

        if (! is_numeric($hours)) {
            throw ValidationException::withMessages([
                $key => 'Enter the hours worked.',
            ]);
        }

        $value = (float) $hours;

        if ($value < 0.01 || $value > 24) {
            throw ValidationException::withMessages([
                $key => 'Enter the hours worked as a number up to 24.',
            ]);
        }

        return number_format($value, 2, '.', '');
    }

    /**
     * @param  list<array<string, mixed>>  $days
     */
    private function weekPayTotal(array $days): string
    {
        $total = 0.0;

        foreach ($days as $day) {
            $amount = (float) ($day['amount'] ?? 0);

            if (($day['rate_type'] ?? '') === EmployeePayRate::RATE_HOURLY) {
                $total += $amount * (float) ($day['hours'] ?? 0);

                continue;
            }

            $total += $amount;
        }

        return number_format($total, 2, '.', '');
    }

    private function hoursValue(mixed $hours): ?string
    {
        if ($hours === null || $hours === '') {
            return null;
        }

        return number_format((float) $hours, 2, '.', '');
    }

    private function rateLabel(string $rateType, ?string $customRateType, string $amount): string
    {
        $options = app(EmployeeController::class)->rateTypeOptions();
        $name = $rateType === EmployeePayRate::RATE_CUSTOM
            ? ($customRateType ?: 'Custom')
            : ($options[$rateType] ?? $rateType);

        return $name.' · $'.number_format((float) $amount, 2);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedBulk(Request $request): array
    {
        $employees = collect($request->input('employees', []))
            ->map(function (mixed $row): array {
                $row = is_array($row) ? $row : [];

                return [
                    'employee_id' => ($row['employee_id'] ?? '') === '' ? null : $row['employee_id'],
                    'skill_id' => ($row['skill_id'] ?? '') === '' ? null : $row['skill_id'],
                    'profession_id' => ($row['profession_id'] ?? '') === '' ? null : $row['profession_id'],
                    'pay_rate_id' => ($row['pay_rate_id'] ?? '') === '' ? null : $row['pay_rate_id'],
                    'hours' => ($row['hours'] ?? '') === '' ? null : $row['hours'],
                ];
            })
            ->all();

        $workDate = $request->input('work_date');

        if (is_string($workDate) && preg_match('/^\d{4}-\d{2}-\d{2}/', $workDate) === 1) {
            $workDate = substr($workDate, 0, 10);
        }

        $request->merge([
            'work_date' => $workDate,
            'scheduled' => filter_var($request->input('scheduled', false), FILTER_VALIDATE_BOOLEAN),
            'worked' => filter_var($request->input('worked', false), FILTER_VALIDATE_BOOLEAN),
            'notes' => ($request->input('notes') ?? '') === '' ? null : $request->input('notes'),
            'employees' => $employees,
        ]);

        $validated = $request->validate([
            'work_date' => ['required', 'date'],
            'scheduled' => ['required', 'boolean'],
            'worked' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'employees' => ['required', 'array', 'min:1'],
            'employees.*.employee_id' => ['required', 'integer', Rule::exists(Employee::class, 'id')],
            'employees.*.skill_id' => ['nullable', 'integer'],
            'employees.*.profession_id' => ['nullable', 'integer'],
            'employees.*.pay_rate_id' => ['required', 'integer'],
            'employees.*.hours' => ['nullable', 'numeric'],
        ], [
            'employees.required' => 'Select at least one employee.',
            'employees.min' => 'Select at least one employee.',
            'employees.*.pay_rate_id.required' => 'Choose the skill and rate for this employee.',
        ]);

        $date = Carbon::parse($validated['work_date'])->startOfDay();

        if ($date->dayOfWeekIso === 7) {
            throw ValidationException::withMessages([
                'work_date' => 'Choose a Monday through Saturday.',
            ]);
        }

        if (! $validated['scheduled'] && ! $validated['worked']) {
            throw ValidationException::withMessages([
                'scheduled' => 'Mark the day as scheduled, worked, or both.',
            ]);
        }

        $seenEmployeeIds = [];

        foreach ($validated['employees'] as $index => $row) {
            $employeeId = (int) $row['employee_id'];

            if (isset($seenEmployeeIds[$employeeId])) {
                throw ValidationException::withMessages([
                    "employees.{$index}.employee_id" => 'This employee is already selected.',
                ]);
            }

            $seenEmployeeIds[$employeeId] = true;

            if (blank($row['skill_id']) && blank($row['profession_id'])) {
                throw ValidationException::withMessages([
                    "employees.{$index}.pay_rate_id" => 'Choose the skill and rate for this employee.',
                ]);
            }

            $rateQuery = EmployeePayRate::query()
                ->whereKey($row['pay_rate_id'])
                ->where('employee_id', $employeeId);

            if (filled($row['skill_id'])) {
                $rateQuery->where('skill_id', $row['skill_id']);
            } else {
                $rateQuery->where('profession_id', $row['profession_id']);
            }

            $rate = $rateQuery->first();

            if (! $rate) {
                throw ValidationException::withMessages([
                    "employees.{$index}.pay_rate_id" => 'Choose a rate assigned to this employee and skill.',
                ]);
            }

            $validated['employees'][$index]['hours'] = $this->validatedHours(
                $rate,
                $row['hours'] ?? null,
                "employees.{$index}.hours",
            );
        }

        $validated['work_date'] = $date->toDateString();

        return $validated;
    }

    private function defaultWorkDate(): string
    {
        $today = now()->startOfDay();

        if ($today->dayOfWeekIso === 7) {
            return $today->subDay()->toDateString();
        }

        return $today->toDateString();
    }

    public function weekQuery(mixed $value): ?string
    {
        if (! is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}/', $value) !== 1) {
            return null;
        }

        try {
            return EmployeeAttendanceWeek::mondayOf($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array{0: ?string, 1: ?string}
     */
    public function dateRange(mixed $from, mixed $to): array
    {
        $start = $this->dateQuery($from);
        $end = $this->dateQuery($to);

        if ($start !== null && $end === null) {
            $end = $start;
        }

        if ($end !== null && $start === null) {
            $start = $end;
        }

        if ($start !== null && $end !== null && $start > $end) {
            return [$end, $start];
        }

        return [$start, $end];
    }

    /**
     * @param  Builder<EmployeeAttendanceWeek>  $query
     * @return Builder<EmployeeAttendanceWeek>
     */
    public function applyListFilters(
        Builder $query,
        string $search,
        ?string $week,
        ?string $from,
        ?string $to,
    ): Builder {
        return $query
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('employee_first_name', 'like', "%{$search}%")
                        ->orWhere('employee_last_name', 'like', "%{$search}%")
                        ->orWhere('employee_full_name', 'like', "%{$search}%")
                        ->orWhere('employee_email', 'like', "%{$search}%");
                });
            })
            ->when($week !== null, fn (Builder $query) => $query->whereDate('week_start', $week))
            ->when($from !== null && $to !== null, function (Builder $query) use ($from, $to): void {
                $query
                    ->whereDate('week_start', '<=', $to)
                    ->whereDate('week_end', '>=', $from)
                    ->whereExists(function ($days) use ($from, $to): void {
                        $days->selectRaw('1')
                            ->from('employee_attendance_days')
                            ->whereColumn(
                                'employee_attendance_days.employee_attendance_week_id',
                                'employee_attendance_listings.id',
                            )
                            ->whereDate('employee_attendance_days.work_date', '>=', $from)
                            ->whereDate('employee_attendance_days.work_date', '<=', $to);
                    });
            });
    }

    private function dateQuery(mixed $value): ?string
    {
        if (! is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            return null;
        }

        try {
            $date = Carbon::createFromFormat('Y-m-d', $value);

            return $date instanceof Carbon && $date->format('Y-m-d') === $value
                ? $value
                : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
