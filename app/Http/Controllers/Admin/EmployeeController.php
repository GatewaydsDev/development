<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Certification;
use App\Models\Employee;
use App\Models\EmployeeCertification;
use App\Models\EmployeePayRate;
use App\Models\EmployeeProjectAssignment;
use App\Models\EmployeeSkillShift;
use App\Models\Language;
use App\Models\Profession;
use App\Models\Project;
use App\Models\Skill;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\EmployeeAccess;
use App\Support\EmployeeAccount;
use App\Support\EmployeeListVersion;
use App\Support\SkillListVersion;
use App\Support\UserLevelAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
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
            'employees' => EmployeeAccess::scopeVisibleEmployees(Employee::query(), $request->user())
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
                            ->orWhereHas('certifications.certification', function ($query) use ($search): void {
                                $query->where('name', 'like', "%{$search}%");
                            })
                            ->orWhereHas('languagePreference.language', function ($query) use ($search): void {
                                $query->where('name', 'like', "%{$search}%");
                            })
                            ->orWhereHas('projectAssignments.project', function ($query) use ($search): void {
                                $query->where('name', 'like', "%{$search}%");
                            })
                            ->orWhereHas('foreman', function ($query) use ($search): void {
                                $query->where('name', 'like', "%{$search}%");
                            });
                    });
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Employee $employee): array => $this->employeePayload($employee)),
            'employeesVersion' => EmployeeListVersion::current(),
        ]);
    }

    public function version(Request $request): JsonResponse
    {
        abort_unless(EmployeeAccess::canView($request->user()), 403);

        return response()->json([
            'version' => EmployeeListVersion::current(),
        ]);
    }

    public function emailAvailability(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User && (
                EmployeeAccess::canCreate($user) || EmployeeAccess::canUpdate($user)
            ),
            403,
        );

        $validated = $request->validate([
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'employee' => ['nullable', 'uuid', Rule::exists(Employee::class, 'uuid')],
        ]);

        $email = strtolower(trim((string) ($validated['email'] ?? '')));

        if ($email === '') {
            return response()->json(['available' => true]);
        }

        $employee = isset($validated['employee'])
            ? Employee::query()->where('uuid', $validated['employee'])->first()
            : null;

        if ($employee && strtolower(trim((string) $employee->email)) === $email) {
            return response()->json(['available' => true]);
        }

        $usedByEmployee = Employee::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->when($employee, fn ($query) => $query->whereKeyNot($employee->id))
            ->exists();

        if ($usedByEmployee) {
            return response()->json(['available' => false]);
        }

        $usedByLogin = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->when(
                $employee?->user_id,
                fn ($query) => $query->whereKeyNot($employee->user_id),
            )
            ->exists();

        return response()->json([
            'available' => ! $usedByLogin,
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
        EmployeeAccess::ensureCanViewEmployee($request->user(), $employee);

        $employee->load($this->employeeRelations());

        return Inertia::render('Admin/Employees/Edit', [
            'employee' => $this->employeePayload($employee),
            'employeesVersion' => EmployeeListVersion::current(),
            ...$this->formOptions(),
        ]);
    }

    public function update(Request $request, Employee $employee): RedirectResponse
    {
        abort_unless(EmployeeAccess::canUpdate($request->user()), 403);
        EmployeeAccess::ensureCanViewEmployee($request->user(), $employee);

        $this->saveEmployee($request, $employee);

        return redirect()
            ->route('admin.employees.index')
            ->with('success', 'Employee updated successfully.');
    }

    public function destroy(Request $request, Employee $employee): RedirectResponse
    {
        abort_unless(EmployeeAccess::canDelete($request->user()), 403);
        EmployeeAccess::ensureCanViewEmployee($request->user(), $employee);

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
            $skillShifts = $validated['skill_shifts'] ?? [];
            $languageId = $validated['language_id'] ?? null;

            $accountPassword = $validated['account_password'] ?? null;
            $accountLevel = $this->accountLevel($validated);
            $originalEmail = $employee?->email;

            $attributes = collect($validated)
                ->except([
                    'pay_rates',
                    'profession_ids',
                    'skill_ids',
                    'project_assignments',
                    'skill_shifts',
                    'certifications',
                    'language_id',
                    'account_role',
                    'account_level_id',
                    'account_password',
                ])
                ->all();

            if ($employee) {
                $employee->update($attributes);
            } else {
                $employee = Employee::create($attributes);
            }

            EmployeeAccount::sync($employee, $accountLevel, $accountPassword, $originalEmail);

            if (array_key_exists('project_assignments', $validated)) {
                $this->syncProjectAssignments($employee, $validated['project_assignments'] ?? []);
            }

            $this->syncPayRates($employee, $payRates);
            $this->syncProfessions($employee, $professionIds, $payRates);
            $this->syncLanguage($employee, $languageId);
            $this->syncSkills($employee, $skillIds, $skillShifts, $payRates);
            $this->syncSkillShifts($employee, $skillShifts);

            if (array_key_exists('certifications', $validated)) {
                $this->syncCertifications($employee, $validated['certifications']);
            }
            $employee->load($this->employeeRelations());

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

        $accountRole = $request->input('account.role', $request->input('account_role'));
        $accountLevelId = $request->input('account.level_id', $request->input('account_level_id'));
        $accountPassword = $request->input('account.password', $request->input('account_password'));
        $accountPasswordConfirmation = $request->input(
            'account.password_confirmation',
            $request->input('account_password_confirmation'),
        );

        $request->merge([
            'skill_shifts' => $skillShifts,
            'language_id' => $request->input('language_id') ?: null,
            'date_of_birth' => $request->input('date_of_birth') ?: null,
            'hire_date' => $request->input('hire_date') ?: null,
            'account_role' => $accountRole === '' ? null : $accountRole,
            'account_level_id' => $accountLevelId === '' ? null : $accountLevelId,
            'account_password' => $accountPassword === '' ? null : $accountPassword,
            'account_password_confirmation' => $accountPasswordConfirmation === '' ? null : $accountPasswordConfirmation,
        ]);

        if ($request->exists('foreman_user_id')) {
            $request->merge([
                'foreman_user_id' => $request->input('foreman_user_id') ?: null,
            ]);
        }

        if ($request->exists('certifications')) {
            $request->merge([
                'certifications' => collect($request->input('certifications', []))
                    ->map(function (mixed $row): array {
                        $row = is_array($row) ? $row : [];
                        $name = trim((string) ($row['name'] ?? ''));
                        $certificationId = $row['certification_id'] ?? null;

                        if (($certificationId === null || $certificationId === '') && $name !== '') {
                            $certificationId = Certification::findOrCreateByName(
                                $name,
                                filter_var($row['is_competent_person'] ?? false, FILTER_VALIDATE_BOOLEAN),
                            )->id;
                        }

                        return [
                            'certification_id' => $certificationId === '' ? null : $certificationId,
                            'issued_on' => ($row['issued_on'] ?? '') === '' ? null : $row['issued_on'],
                            'expires_on' => ($row['expires_on'] ?? '') === '' ? null : $row['expires_on'],
                        ];
                    })
                    ->filter(fn (array $row): bool => $row['certification_id'] !== null && $row['certification_id'] !== '')
                    ->values()
                    ->all(),
            ]);
        }

        $groupedProfessions = $this->groupedProfessions($request);
        $ratePaths = [];

        if ($groupedProfessions !== null) {
            $expanded = $this->expandGroupedProfessions($groupedProfessions);
            $ratePaths = $expanded['rate_paths'];

            $request->merge([
                'profession_ids' => $expanded['profession_ids'],
                'pay_rates' => $expanded['pay_rates'],
            ]);
        }

        try {
            $validated = $this->validateEmployeeRequest($request, $employee);
        } catch (ValidationException $exception) {
            if ($groupedProfessions !== null) {
                throw $this->remapGroupedProfessionErrors($exception, $ratePaths);
            }

            throw $exception;
        }

        foreach ($validated['certifications'] ?? [] as $index => $certification) {
            $issuedOn = $certification['issued_on'] ?? null;
            $expiresOn = $certification['expires_on'] ?? null;

            if ($issuedOn && $expiresOn && $expiresOn < $issuedOn) {
                throw ValidationException::withMessages([
                    "certifications.$index.expires_on" => 'The expiration date must be on or after the issued date.',
                ]);
            }
        }

        return $validated;
    }

    /**
     * @return array<string, mixed>
     */
    private function validateEmployeeRequest(Request $request, ?Employee $employee = null): array
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => $this->emailRules($request, $employee),
            'phone_number' => ['nullable', 'string', 'max:50'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:255'],
            'employment_status' => ['required', Rule::in(array_keys($this->statusOptions()))],
            'hire_date' => ['nullable', 'date'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'language_id' => ['nullable', 'integer', Rule::exists(Language::class, 'id')],
            'notes' => ['nullable', 'string', 'max:5000'],
            'foreman_user_id' => [
                'nullable',
                'integer',
                Rule::exists(User::class, 'id')->where(fn ($query) => $query->whereIn(
                    'level_id',
                    UserLevel::query()->where('name', UserLevel::FOREMAN)->select('id'),
                )),
            ],
            'account_role' => ['nullable', Rule::in(['employee', 'foreman'])],
            'account_level_id' => ['nullable', 'integer', Rule::exists(UserLevel::class, 'id')],
            'account_password' => [
                Rule::requiredIf(fn (): bool => $this->accountPasswordRequired($request, $employee)),
                'nullable',
                'confirmed',
                Password::defaults(),
            ],
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
            'pay_rates.*.skill_id' => ['nullable', 'integer', Rule::exists(Skill::class, 'id')],
            'pay_rates.*.profession_id' => ['nullable', 'integer', Rule::exists(Profession::class, 'id')],
            'pay_rates.*.rate_type' => ['required', 'string', Rule::in(array_keys($this->rateTypeOptions()))],
            'pay_rates.*.custom_rate_type' => ['nullable', 'string', 'max:255'],
            'pay_rates.*.amount' => ['required', 'numeric', 'min:0.01'],
            'pay_rates.*.notes' => ['nullable', 'string', 'max:1000'],
            'certifications' => ['nullable', 'array'],
            'certifications.*.certification_id' => ['required', 'integer', 'distinct', Rule::exists(Certification::class, 'id')],
            'certifications.*.issued_on' => ['nullable', 'date'],
            'certifications.*.expires_on' => ['nullable', 'date'],
        ]);

        $rateKeys = [];

        foreach ($validated['pay_rates'] ?? [] as $index => $payRate) {
            if (
                ($payRate['rate_type'] ?? null) === EmployeePayRate::RATE_CUSTOM
                && blank($payRate['custom_rate_type'] ?? null)
            ) {
                throw ValidationException::withMessages([
                    "pay_rates.{$index}.custom_rate_type" => 'Enter a custom rate type.',
                ]);
            }

            if (blank($payRate['skill_id'] ?? null) && blank($payRate['profession_id'] ?? null)) {
                throw ValidationException::withMessages([
                    "pay_rates.{$index}.skill_id" => 'Choose a skill for this rate.',
                ]);
            }

            $owner = filled($payRate['skill_id'] ?? null)
                ? 'skill:'.$payRate['skill_id']
                : 'profession:'.$payRate['profession_id'];
            $rateKey = $owner.'|'.$payRate['rate_type'];

            if (($payRate['rate_type'] ?? null) === EmployeePayRate::RATE_CUSTOM) {
                $rateKey .= '|'.strtolower(trim((string) ($payRate['custom_rate_type'] ?? '')));
            }

            if (isset($rateKeys[$rateKey])) {
                throw ValidationException::withMessages([
                    "pay_rates.{$index}.rate_type" => 'This rate is already added for this skill.',
                ]);
            }

            $rateKeys[$rateKey] = true;
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
     * Professions sent as `{ profession_id, rates: [...] }` are the mobile shape.
     * The admin form still sends profession_ids and a flat pay_rates list.
     *
     * @return list<array<string, mixed>>|null
     */
    private function groupedProfessions(Request $request): ?array
    {
        if (! $request->exists('professions')) {
            return null;
        }

        $groups = $request->input('professions');

        if (! is_array($groups)) {
            return null;
        }

        foreach ($groups as $group) {
            if (! is_array($group)) {
                return null;
            }
        }

        return array_values($groups);
    }

    /**
     * @param  list<array<string, mixed>>  $groups
     * @return array{
     *     profession_ids: list<mixed>,
     *     pay_rates: list<array<string, mixed>>,
     *     rate_paths: array<int, string>
     * }
     */
    private function expandGroupedProfessions(array $groups): array
    {
        $professionIds = [];
        $payRates = [];
        $ratePaths = [];
        $seenProfessionIds = [];

        foreach ($groups as $groupIndex => $group) {
            $professionId = $group['profession_id'] ?? null;
            $professionIds[] = $professionId;

            if (filled($professionId)) {
                $seenKey = (string) $professionId;

                if (isset($seenProfessionIds[$seenKey])) {
                    throw ValidationException::withMessages([
                        "professions.{$groupIndex}.profession_id" => 'This profession is already added.',
                    ]);
                }

                $seenProfessionIds[$seenKey] = true;
            }

            $rates = is_array($group['rates'] ?? null) ? array_values($group['rates']) : [];

            foreach ($rates as $rateIndex => $rate) {
                $rate = is_array($rate) ? $rate : [];
                $flatIndex = count($payRates);
                $payRates[] = [
                    'profession_id' => $professionId,
                    'rate_type' => $rate['rate_type'] ?? null,
                    'custom_rate_type' => $rate['custom_rate_type'] ?? null,
                    'amount' => $rate['amount'] ?? null,
                    'notes' => ($rate['notes'] ?? null) === '' ? null : ($rate['notes'] ?? null),
                ];
                $ratePaths[$flatIndex] = "professions.{$groupIndex}.rates.{$rateIndex}";
            }
        }

        return [
            'profession_ids' => $professionIds,
            'pay_rates' => $payRates,
            'rate_paths' => $ratePaths,
        ];
    }

    /**
     * @param  array<int, string>  $ratePaths
     */
    private function remapGroupedProfessionErrors(ValidationException $exception, array $ratePaths): ValidationException
    {
        $messages = [];

        foreach ($exception->errors() as $key => $errors) {
            if (preg_match('/^pay_rates\.(\d+)\.(.+)$/', $key, $matches) === 1) {
                $path = $ratePaths[(int) $matches[1]] ?? null;
                $key = $path !== null ? "{$path}.{$matches[2]}" : $key;
            } elseif (preg_match('/^profession_ids\.(\d+)$/', $key, $matches) === 1) {
                $key = "professions.{$matches[1]}.profession_id";
            }

            $messages[$key] = $errors;
        }

        return ValidationException::withMessages($messages);
    }

    /**
     * @return array<string, mixed>
     */
    public function formOptions(): array
    {
        return [
            'professions' => $this->namedOptions(Profession::class),
            'languages' => $this->namedOptions(Language::class),
            'certifications' => Certification::query()
                ->orderBy('name')
                ->get(['id', 'name', 'is_competent_person'])
                ->map(fn (Certification $certification): array => [
                    'id' => $certification->id,
                    'name' => $certification->name,
                    'is_competent_person' => $certification->is_competent_person,
                ])
                ->all(),
            'skills' => $this->namedOptions(Skill::class),
            'skillsVersion' => SkillListVersion::current(),
            'foremen' => $this->foremanOptions(),
            'rateTypeOptions' => $this->rateTypeOptions(),
            'statusOptions' => $this->statusOptions(),
            'shiftTypeOptions' => $this->shiftTypeOptions(),
            'payBasisOptions' => $this->payBasisOptions(),
            'userLevels' => $this->assignableUserLevels(),
            'accessPermissions' => UserLevelAccess::catalog(),
            'canCreateUserLevel' => (bool) auth()->user()?->isSuperAdmin(),
        ];
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    public function assignableUserLevels(): array
    {
        return UserLevel::query()
            ->orderBy('id')
            ->get()
            ->reject(fn (UserLevel $level): bool => $level->isSuperAdminLevel())
            ->map(fn (UserLevel $level): array => [
                'id' => $level->id,
                'name' => $level->name,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function accountLevel(array $validated): ?UserLevel
    {
        if (! empty($validated['account_level_id'])) {
            return UserLevel::query()->findOrFail($validated['account_level_id']);
        }

        $role = $validated['account_role'] ?? null;

        if (! is_string($role) || $role === '') {
            return null;
        }

        return EmployeeAccount::levelFor($role);
    }

    /**
     * @return list<mixed>
     */
    private function emailRules(Request $request, ?Employee $employee): array
    {
        $rules = ['required', 'email', 'max:255'];
        $submitted = strtolower(trim((string) $request->input('email')));
        $current = strtolower(trim((string) ($employee->email ?? '')));

        if ($employee && $submitted === $current) {
            return $rules;
        }

        $unique = Rule::unique(Employee::class, 'email');

        if ($employee) {
            $unique->ignore($employee->id);
        }

        $rules[] = $unique;

        return $rules;
    }

    private function accountPasswordRequired(Request $request, ?Employee $employee): bool
    {
        if (! $request->filled('account_role') && ! $request->filled('account_level_id')) {
            return false;
        }

        if ($employee?->user_id) {
            return false;
        }

        $submitted = strtolower(trim((string) $request->input('email')));
        $current = strtolower(trim((string) ($employee->email ?? '')));

        if ($employee && $submitted === $current && User::query()->whereRaw('LOWER(email) = ?', [$submitted])->exists()) {
            return false;
        }

        return true;
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
            EmployeePayRate::RATE_UNION => 'Union',
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
            'foreman' => $employee->foreman
                ? [
                    'id' => $employee->foreman->id,
                    'name' => $employee->foreman->name,
                    'email' => $employee->foreman->email,
                ]
                : null,
            'user' => $employee->user
                ? [
                    'id' => $employee->user->id,
                    'name' => $employee->user->name,
                    'email' => $employee->user->email,
                    'level' => $employee->user->level
                        ? [
                            'id' => $employee->user->level->id,
                            'name' => $employee->user->level->name,
                        ]
                        : null,
                ]
                : null,
            'professions' => $employee->professions
                ->map(fn (Profession $profession): array => [
                    'id' => $profession->id,
                    'name' => $profession->name,
                    'rates' => $employee->payRates
                        ->where('profession_id', $profession->id)
                        ->map(fn (EmployeePayRate $payRate): array => $this->payRatePayload($payRate, false))
                        ->values()
                        ->all(),
                ])
                ->values()
                ->all(),
            'certifications' => $employee->certifications
                ->sortBy(fn (EmployeeCertification $assignment): string => $assignment->certification?->name ?? '')
                ->map(fn (EmployeeCertification $assignment): array => [
                    'id' => $assignment->id,
                    'uuid' => $assignment->uuid,
                    'certification_id' => $assignment->certification_id,
                    'name' => $assignment->certification?->name,
                    'is_competent_person' => (bool) $assignment->certification?->is_competent_person,
                    'issued_on' => $assignment->issued_on?->toDateString(),
                    'expires_on' => $assignment->expires_on?->toDateString(),
                ])
                ->values()
                ->all(),
            'skills' => $employee->skills
                ->map(fn (Skill $skill): array => [
                    'id' => $skill->id,
                    'name' => $skill->name,
                    'rates' => $employee->payRates
                        ->where('skill_id', $skill->id)
                        ->map(fn (EmployeePayRate $payRate): array => $this->payRatePayload($payRate, false))
                        ->values()
                        ->all(),
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
                            'uuid' => $assignment->project->uuid,
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
                ->map(fn (EmployeePayRate $payRate): array => $this->payRatePayload($payRate))
                ->values()
                ->all(),
            'created_at' => $employee->created_at?->toISOString(),
            'updated_at' => $employee->updated_at?->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function payRatePayload(EmployeePayRate $payRate, bool $withProfession = true): array
    {
        $payload = [
            'id' => $payRate->id,
            'skill_id' => $payRate->skill_id,
            'profession_id' => $payRate->profession_id,
            'rate_type' => $payRate->rate_type,
            'custom_rate_type' => $payRate->custom_rate_type,
            'amount' => $payRate->amount,
            'notes' => $payRate->notes,
        ];

        if ($withProfession) {
            $payload['profession'] = $payRate->profession
                ? [
                    'id' => $payRate->profession->id,
                    'name' => $payRate->profession->name,
                ]
                : null;
        }

        $payload['skill'] = $payRate->skill
            ? [
                'id' => $payRate->skill->id,
                'name' => $payRate->skill->name,
            ]
            : null;

        return $payload;
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
            'projectAssignments.project:id,uuid,name,project_number',
            'skillShifts.skill:id,name',
            'payRates.profession:id,name',
            'payRates.skill:id,name',
            'foreman:id,name,email',
            'user.level:id,name',
            'certifications.certification:id,name,is_competent_person',
        ];
    }

    /**
     * @return list<array{id: int, name: string, email: string}>
     */
    public function foremanOptions(): array
    {
        return User::query()
            ->whereHas('level', fn ($query) => $query->where('name', UserLevel::FOREMAN))
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ])
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $payRates
     */
    public function syncPayRates(Employee $employee, array $payRates): void
    {
        $employee->payRates()->delete();

        collect($payRates)
            ->map(fn (array $payRate): array => [
                'skill_id' => $payRate['skill_id'] ?? null,
                'profession_id' => $payRate['profession_id'] ?? null,
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
     * @param  array<int, array<string, mixed>>  $payRates
     */
    public function syncSkills(Employee $employee, array $skillIds, array $skillShifts, array $payRates = []): void
    {
        $ids = collect($skillIds)
            ->merge(collect($skillShifts)->pluck('skill_id'))
            ->merge(collect($payRates)->pluck('skill_id'))
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
     * @param  array<int, array<string, mixed>>  $certifications
     */
    public function syncCertifications(Employee $employee, array $certifications): void
    {
        $employee->certifications()->delete();

        foreach ($certifications as $certification) {
            $employee->certifications()->create([
                'certification_id' => $certification['certification_id'],
                'issued_on' => $certification['issued_on'] ?? null,
                'expires_on' => $certification['expires_on'] ?? null,
            ]);
        }
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
