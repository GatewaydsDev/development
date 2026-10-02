<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeePayRate;
use App\Models\EmployeeProjectAssignment;
use App\Models\EmployeeSkillShift;
use App\Models\Language;
use App\Models\Profession;
use App\Models\Project;
use App\Models\Skill;
use App\Support\EmployeeAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless(EmployeeAccess::canView($request->user()), 403);

        $search = (string) $request->query('search', '');

        return Inertia::render('Admin/Employees/Index', [
            'filters' => [
                'search' => $search,
            ],
            'employees' => Employee::query()
                ->with($this->employeeRelations())
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('phone_number', 'like', "%{$search}%")
                            ->orWhere('job_title', 'like', "%{$search}%")
                            ->orWhere('department', 'like', "%{$search}%")
                            ->orWhereHas('payRates.profession', function ($query) use ($search): void {
                                $query->where('name', 'like', "%{$search}%");
                            })
                            ->orWhereHas('professions', function ($query) use ($search): void {
                                $query->where('name', 'like', "%{$search}%");
                            })
                            ->orWhereHas('skills', function ($query) use ($search): void {
                                $query->where('name', 'like', "%{$search}%");
                            })
                            ->orWhereHas('languagePreference.language', function ($query) use ($search): void {
                                $query->where('name', 'like', "%{$search}%");
                            })
                            ->orWhereHas('projectAssignments.project', function ($query) use ($search): void {
                                $query->where('name', 'like', "%{$search}%");
                            });
                    });
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Employee $employee): array => $this->employeePayload($employee)),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless(EmployeeAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Employees/Create', $this->formOptions());
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(EmployeeAccess::canCreate($request->user()), 403);

        $this->saveEmployee($request);

        return redirect()
            ->route('admin.employees.index')
            ->with('success', 'Employee created successfully.');
    }

    public function edit(Request $request, Employee $employee): Response
    {
        abort_unless(EmployeeAccess::canUpdate($request->user()), 403);

        $employee->load($this->employeeRelations());

        return Inertia::render('Admin/Employees/Edit', [
            'employee' => $this->employeePayload($employee),
            ...$this->formOptions(),
        ]);
    }

    public function update(Request $request, Employee $employee): RedirectResponse
    {
        abort_unless(EmployeeAccess::canUpdate($request->user()), 403);

        $this->saveEmployee($request, $employee);

        return redirect()
            ->route('admin.employees.index')
            ->with('success', 'Employee updated successfully.');
    }

    public function destroy(Request $request, Employee $employee): RedirectResponse
    {
        abort_unless(EmployeeAccess::canDelete($request->user()), 403);

        $employee->delete();

        return redirect()
            ->route('admin.employees.index')
            ->with('success', 'Employee deleted successfully.');
    }

    public function saveEmployee(Request $request, ?Employee $employee = null): Employee
    {
        return DB::transaction(function () use ($request, $employee): Employee {
            $validated = $this->validatedEmployee($request, $employee);
            $payRates = $validated['pay_rates'] ?? [];
            $professionIds = $validated['profession_ids'] ?? [];
            $skillIds = $validated['skill_ids'] ?? [];
            $projectAssignments = $validated['project_assignments'] ?? [];
            $skillShifts = $validated['skill_shifts'] ?? [];
            $languageId = $validated['language_id'] ?? null;

            $attributes = collect($validated)
                ->except([
                    'pay_rates',
                    'profession_ids',
                    'skill_ids',
                    'project_assignments',
                    'skill_shifts',
                    'language_id',
                ])
                ->all();

            if ($employee) {
                $employee->update($attributes);
            } else {
                $employee = Employee::create($attributes);
            }

            $this->syncPayRates($employee, $payRates);
            $this->syncProfessions($employee, $professionIds, $payRates);
            $this->syncLanguage($employee, $languageId);
            $this->syncProjectAssignments($employee, $projectAssignments);
            $this->syncSkills($employee, $skillIds, $skillShifts);
            $this->syncSkillShifts($employee, $skillShifts);

            return $employee;
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function validatedEmployee(Request $request, ?Employee $employee = null): array
    {
        $skillShifts = collect($request->input('skill_shifts', []))
            ->map(function (mixed $shift): array {
                $shift = is_array($shift) ? $shift : [];

                return [
                    ...$shift,
                    'is_union_member' => filter_var($shift['is_union_member'] ?? false, FILTER_VALIDATE_BOOLEAN),
                    'union_rate' => ($shift['union_rate'] ?? '') === '' ? null : $shift['union_rate'],
                    'notes' => ($shift['notes'] ?? '') === '' ? null : $shift['notes'],
                ];
            })
            ->all();

        $request->merge([
            'skill_shifts' => $skillShifts,
            'language_id' => $request->input('language_id') ?: null,
            'date_of_birth' => $request->input('date_of_birth') ?: null,
            'hire_date' => $request->input('hire_date') ?: null,
        ]);

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique(Employee::class, 'email')->ignore($employee),
            ],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:255'],
            'employment_status' => ['required', Rule::in(array_keys($this->statusOptions()))],
            'hire_date' => ['nullable', 'date'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'language_id' => ['nullable', 'integer', Rule::exists(Language::class, 'id')],
            'notes' => ['nullable', 'string', 'max:5000'],
            'profession_ids' => ['nullable', 'array'],
            'profession_ids.*' => ['integer', Rule::exists(Profession::class, 'id')],
            'skill_ids' => ['nullable', 'array'],
            'skill_ids.*' => ['integer', Rule::exists(Skill::class, 'id')],
            'project_assignments' => ['nullable', 'array'],
            'project_assignments.*.project_id' => ['required', 'integer', Rule::exists(Project::class, 'id')],
            'project_assignments.*.work_date' => ['required', 'date'],
            'project_assignments.*.notes' => ['nullable', 'string', 'max:1000'],
            'skill_shifts' => ['nullable', 'array'],
            'skill_shifts.*.skill_id' => ['required', 'integer', Rule::exists(Skill::class, 'id')],
            'skill_shifts.*.shift_type' => ['required', 'string', Rule::in(array_keys($this->shiftTypeOptions()))],
            'skill_shifts.*.pay_basis' => ['required', 'string', Rule::in(array_keys($this->payBasisOptions()))],
            'skill_shifts.*.amount' => ['required', 'numeric', 'min:0.01'],
            'skill_shifts.*.is_union_member' => ['required', 'boolean'],
            'skill_shifts.*.union_rate' => ['nullable', 'numeric', 'min:0.01'],
            'skill_shifts.*.notes' => ['nullable', 'string', 'max:1000'],
            'pay_rates' => ['array'],
            'pay_rates.*.profession_id' => ['required', 'integer', Rule::exists(Profession::class, 'id')],
            'pay_rates.*.rate_type' => ['required', 'string', Rule::in(array_keys($this->rateTypeOptions()))],
            'pay_rates.*.custom_rate_type' => ['nullable', 'string', 'max:255'],
            'pay_rates.*.amount' => ['required', 'numeric', 'min:0.01'],
            'pay_rates.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        foreach ($validated['pay_rates'] ?? [] as $index => $payRate) {
            if (
                ($payRate['rate_type'] ?? null) === EmployeePayRate::RATE_CUSTOM
                && blank($payRate['custom_rate_type'] ?? null)
            ) {
                throw ValidationException::withMessages([
                    "pay_rates.{$index}.custom_rate_type" => 'Enter a custom rate type.',
                ]);
            }
        }

        $assignmentKeys = [];

        foreach ($validated['project_assignments'] ?? [] as $index => $assignment) {
            $key = $assignment['project_id'].'|'.$assignment['work_date'];

            if (isset($assignmentKeys[$key])) {
                throw ValidationException::withMessages([
                    "project_assignments.{$index}.project_id" => 'This project is already assigned on that date.',
                ]);
            }

            $assignmentKeys[$key] = true;
        }

        $shiftKeys = [];

        foreach ($validated['skill_shifts'] ?? [] as $index => $shift) {
            if (($shift['is_union_member'] ?? false) && blank($shift['union_rate'] ?? null)) {
                throw ValidationException::withMessages([
                    "skill_shifts.{$index}.union_rate" => 'Enter the union rate.',
                ]);
            }

            $key = $shift['skill_id'].'|'.$shift['shift_type'].'|'.$shift['pay_basis'];

            if (isset($shiftKeys[$key])) {
                throw ValidationException::withMessages([
                    "skill_shifts.{$index}.shift_type" => 'This shift and payment are already listed for that skill.',
                ]);
            }

            $shiftKeys[$key] = true;
        }

        return $validated;
    }

    /**
     * @return array<string, mixed>
     */
    public function formOptions(): array
    {
        return [
            'professions' => $this->namedOptions(Profession::class),
            'languages' => $this->namedOptions(Language::class),
            'skills' => $this->namedOptions(Skill::class),
            'projects' => Project::query()
                ->orderBy('name')
                ->get(['id', 'name', 'project_number'])
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'project_number' => $project->project_number,
                ])
                ->all(),
            'rateTypeOptions' => $this->rateTypeOptions(),
            'statusOptions' => $this->statusOptions(),
            'shiftTypeOptions' => $this->shiftTypeOptions(),
            'payBasisOptions' => $this->payBasisOptions(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function statusOptions(): array
    {
        return [
            Employee::STATUS_ACTIVE => 'Active',
            Employee::STATUS_INACTIVE => 'Inactive',
            Employee::STATUS_ON_LEAVE => 'On leave',
            Employee::STATUS_TERMINATED => 'Terminated',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function rateTypeOptions(): array
    {
        return [
            EmployeePayRate::RATE_HOURLY => 'Hourly',
            EmployeePayRate::RATE_HALF_DAY => 'Half day',
            EmployeePayRate::RATE_DAILY => 'Daily',
            EmployeePayRate::RATE_OVERTIME => 'Overtime',
            EmployeePayRate::RATE_DAY_OFF => 'Day off',
            EmployeePayRate::RATE_CUSTOM => 'Custom',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function shiftTypeOptions(): array
    {
        return [
            EmployeeSkillShift::SHIFT_FULL_DAY => '8 hour shift',
            EmployeeSkillShift::SHIFT_HALF_DAY => 'Half day shift',
            EmployeeSkillShift::SHIFT_COUPLE_HOURS => 'A couple of hours',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function payBasisOptions(): array
    {
        return [
            EmployeeSkillShift::PAY_HOURLY => 'Hourly payment',
            EmployeeSkillShift::PAY_DAILY => 'Day payment',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function employeePayload(Employee $employee): array
    {
        $employee->loadMissing($this->employeeRelations());

        return [
            'id' => $employee->id,
            'uuid' => $employee->uuid,
            'first_name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'full_name' => $employee->fullName(),
            'email' => $employee->email,
            'phone_number' => $employee->phone_number,
            'job_title' => $employee->job_title,
            'department' => $employee->department,
            'employment_status' => $employee->employment_status,
            'hire_date' => $employee->hire_date?->toDateString(),
            'date_of_birth' => $employee->date_of_birth?->toDateString(),
            'language' => $employee->languagePreference?->language
                ? [
                    'id' => $employee->languagePreference->language->id,
                    'name' => $employee->languagePreference->language->name,
                ]
                : null,
            'notes' => $employee->notes,
            'professions' => $employee->professions
                ->map(fn (Profession $profession): array => [
                    'id' => $profession->id,
                    'name' => $profession->name,
                ])
                ->values()
                ->all(),
            'skills' => $employee->skills
                ->map(fn (Skill $skill): array => [
                    'id' => $skill->id,
                    'name' => $skill->name,
                ])
                ->values()
                ->all(),
            'project_assignments' => $employee->projectAssignments
                ->sortBy([
                    ['work_date', 'desc'],
                    ['id', 'desc'],
                ])
                ->map(fn (EmployeeProjectAssignment $assignment): array => [
                    'id' => $assignment->id,
                    'project_id' => $assignment->project_id,
                    'work_date' => $assignment->work_date?->toDateString(),
                    'notes' => $assignment->notes,
                    'project' => $assignment->project
                        ? [
                            'id' => $assignment->project->id,
                            'name' => $assignment->project->name,
                            'project_number' => $assignment->project->project_number,
                        ]
                        : null,
                ])
                ->values()
                ->all(),
            'skill_shifts' => $employee->skillShifts
                ->map(fn (EmployeeSkillShift $shift): array => [
                    'id' => $shift->id,
                    'skill_id' => $shift->skill_id,
                    'skill' => $shift->skill
                        ? [
                            'id' => $shift->skill->id,
                            'name' => $shift->skill->name,
                        ]
                        : null,
                    'shift_type' => $shift->shift_type,
                    'pay_basis' => $shift->pay_basis,
                    'amount' => $shift->amount,
                    'is_union_member' => $shift->is_union_member,
                    'union_rate' => $shift->union_rate,
                    'notes' => $shift->notes,
                ])
                ->values()
                ->all(),
            'pay_rates' => $employee->payRates
                ->map(fn (EmployeePayRate $payRate): array => [
                    'id' => $payRate->id,
                    'profession_id' => $payRate->profession_id,
                    'profession' => $payRate->profession
                        ? [
                            'id' => $payRate->profession->id,
                            'name' => $payRate->profession->name,
                        ]
                        : null,
                    'rate_type' => $payRate->rate_type,
                    'custom_rate_type' => $payRate->custom_rate_type,
                    'amount' => $payRate->amount,
                    'notes' => $payRate->notes,
                ])
                ->all(),
            'created_at' => $employee->created_at?->toISOString(),
            'updated_at' => $employee->updated_at?->toISOString(),
        ];
    }

    /**
     * @return list<string>
     */
    public function employeeRelations(): array
    {
        return [
            'languagePreference.language:id,name',
            'professions:id,name',
            'skills:id,name',
            'projectAssignments.project:id,name,project_number',
            'skillShifts.skill:id,name',
            'payRates.profession:id,name',
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $payRates
     */
    public function syncPayRates(Employee $employee, array $payRates): void
    {
        $employee->payRates()->delete();

        collect($payRates)
            ->map(fn (array $payRate): array => [
                'profession_id' => $payRate['profession_id'],
                'rate_type' => $payRate['rate_type'],
                'custom_rate_type' => $payRate['rate_type'] === EmployeePayRate::RATE_CUSTOM
                    ? ($payRate['custom_rate_type'] ?? null)
                    : null,
                'amount' => $payRate['amount'],
                'notes' => $payRate['notes'] ?? null,
            ])
            ->each(fn (array $payRate): EmployeePayRate => $employee->payRates()->create($payRate));
    }

    /**
     * @param  array<int, mixed>  $professionIds
     * @param  array<int, array<string, mixed>>  $payRates
     */
    public function syncProfessions(Employee $employee, array $professionIds, array $payRates): void
    {
        $ids = collect($professionIds)
            ->merge(collect($payRates)->pluck('profession_id'))
            ->filter()
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        $employee->professions()->sync($ids);
    }

    public function syncLanguage(Employee $employee, mixed $languageId): void
    {
        if (blank($languageId)) {
            $employee->languagePreference()->delete();

            return;
        }

        $employee->languagePreference()->updateOrCreate([], [
            'language_id' => $languageId,
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $assignments
     */
    public function syncProjectAssignments(Employee $employee, array $assignments): void
    {
        $employee->projectAssignments()->delete();

        collect($assignments)->each(function (array $assignment) use ($employee): void {
            $employee->projectAssignments()->create([
                'project_id' => $assignment['project_id'],
                'work_date' => $assignment['work_date'],
                'notes' => $assignment['notes'] ?? null,
            ]);
        });
    }

    /**
     * @param  array<int, mixed>  $skillIds
     * @param  array<int, array<string, mixed>>  $skillShifts
     */
    public function syncSkills(Employee $employee, array $skillIds, array $skillShifts): void
    {
        $ids = collect($skillIds)
            ->merge(collect($skillShifts)->pluck('skill_id'))
            ->filter()
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        $employee->skills()->sync($ids);
    }

    /**
     * @param  array<int, array<string, mixed>>  $skillShifts
     */
    public function syncSkillShifts(Employee $employee, array $skillShifts): void
    {
        $employee->skillShifts()->delete();

        collect($skillShifts)->each(function (array $shift) use ($employee): void {
            $isUnionMember = (bool) ($shift['is_union_member'] ?? false);

            $employee->skillShifts()->create([
                'skill_id' => $shift['skill_id'],
                'shift_type' => $shift['shift_type'],
                'pay_basis' => $shift['pay_basis'],
                'amount' => $shift['amount'],
                'is_union_member' => $isUnionMember,
                'union_rate' => $isUnionMember ? $shift['union_rate'] : null,
                'notes' => $shift['notes'] ?? null,
            ]);
        });
    }

    /**
     * @param  class-string  $model
     * @return array<int, array{id: int, name: string}>
     */
    private function namedOptions(string $model): array
    {
        /** @var Collection<int, Language|Profession|Skill> $records */
        $records = $model::query()->orderBy('name')->get(['id', 'name']);

        return $records
            ->map(fn (Language|Profession|Skill $record): array => [
                'id' => $record->id,
                'name' => $record->name,
            ])
            ->all();
    }
}
