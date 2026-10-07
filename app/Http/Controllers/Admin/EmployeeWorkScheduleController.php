<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeCertification;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use App\Models\WorkScheduleListing;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\EmployeeAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeWorkScheduleController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User && EmployeeAccess::canView($user), 403);

        $date = $this->dateQuery($request->query('date')) ?? now()->toDateString();
        $search = trim((string) $request->query('search', ''));
        $status = $this->statusQuery($request->query('status'));

        $schedules = EmployeeAccess::scopeVisibleScheduleListings(WorkScheduleListing::query(), $user)
            ->covering($date)
            ->when($status, fn ($query) => $query->where('status', $status))
            ->tap(fn ($query) => $this->applyListingSearch($query, $search))
            ->orderBy('starts_on')
            ->orderBy('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (WorkScheduleListing $listing): array => $this->listingPayload($listing));

        return Inertia::render('Admin/EmployeeSchedules/Index', [
            'filters' => [
                'date' => $date,
                'search' => $search,
                'status' => $status ?? '',
            ],
            'statuses' => $this->statusOptions(),
            'schedules' => $schedules,
            'can' => $this->abilities($user),
        ]);
    }

    public function create(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User && EmployeeAccess::canCreate($user), 403);

        return Inertia::render('Admin/EmployeeSchedules/Create', [
            ...$this->formOptions(),
            'defaultDate' => now()->toDateString(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && EmployeeAccess::canCreate($user), 403);

        $schedule = $this->saveSchedule($request);

        return redirect()
            ->route('admin.employee-schedules.index', [
                'date' => $schedule->starts_on?->toDateString(),
            ])
            ->with('success', 'Work schedule saved.');
    }

    public function edit(Request $request, EmployeeWorkSchedule $schedule): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User && EmployeeAccess::canUpdate($user), 403);
        EmployeeAccess::ensureCanViewSchedule($user, $schedule);

        $schedule->load($this->relations());

        return Inertia::render('Admin/EmployeeSchedules/Edit', [
            ...$this->formOptions(),
            'schedule' => $this->payload($schedule),
        ]);
    }

    public function update(Request $request, EmployeeWorkSchedule $schedule): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && EmployeeAccess::canUpdate($user), 403);
        EmployeeAccess::ensureCanViewSchedule($user, $schedule);

        $schedule = $this->saveSchedule($request, $schedule);

        return redirect()
            ->route('admin.employee-schedules.index', [
                'date' => $schedule->starts_on?->toDateString(),
            ])
            ->with('success', 'Work schedule updated.');
    }

    public function destroy(Request $request, EmployeeWorkSchedule $schedule): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && EmployeeAccess::canDelete($user), 403);
        EmployeeAccess::ensureCanViewSchedule($user, $schedule);

        $date = $schedule->starts_on?->toDateString();
        $schedule->delete();

        return redirect()
            ->route('admin.employee-schedules.index', ['date' => $date])
            ->with('success', 'Work schedule removed.');
    }

    public function saveSchedule(Request $request, ?EmployeeWorkSchedule $schedule = null): EmployeeWorkSchedule
    {
        $start = $request->input('starts_on') ?: $request->input('work_date');
        $end = $request->input('ends_on') ?: $start;

        $request->merge([
            'starts_on' => is_string($start) ? substr($start, 0, 10) : $start,
            'ends_on' => is_string($end) ? substr($end, 0, 10) : $end,
            'status' => $request->input('status') ?: EmployeeWorkSchedule::STATUS_ACTIVE,
            'project_uuid' => $request->input('project_uuid') ?: $request->input('project_id'),
            'employee_uuids' => $request->input('employee_uuids') ?: $request->input('employee_ids'),
            'requires_competent_person' => filter_var(
                $request->input('requires_competent_person', false),
                FILTER_VALIDATE_BOOLEAN,
            ),
            'competent_person_uuid' => $request->input('competent_person_uuid') ?: null,
        ]);

        $validated = $request->validate([
            'project_uuid' => ['required', function (string $attribute, mixed $value, \Closure $fail): void {
                if ($this->recordId(Project::class, $value) === null) {
                    $fail('Select a job.');
                }
            }],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'status' => ['required', Rule::in(array_keys(EmployeeWorkSchedule::STATUSES))],
            'foreman_user_id' => [
                'required',
                'integer',
                Rule::exists(User::class, 'id')->where(fn ($query) => $query->whereIn(
                    'level_id',
                    UserLevel::query()->where('name', UserLevel::FOREMAN)->select('id'),
                )),
            ],
            'employee_uuids' => ['required', 'array', 'min:1'],
            'employee_uuids.*' => ['required', 'distinct', function (string $attribute, mixed $value, \Closure $fail): void {
                if ($this->recordId(Employee::class, $value) === null) {
                    $fail('Choose an employee that exists.');
                }
            }],
            'requires_competent_person' => ['required', 'boolean'],
            'competent_person_uuid' => ['nullable', 'string'],
            'notes' => ['nullable', 'string', 'max:60000'],
        ], [
            'ends_on.after_or_equal' => 'Choose an end date on or after the start date.',
        ]);

        $projectId = $this->recordId(Project::class, $validated['project_uuid']);
        $employeeIds = array_values(array_filter(array_map(
            fn (mixed $value): ?int => $this->recordId(Employee::class, $value),
            $validated['employee_uuids'],
        )));
        $competentPersonId = null;

        if ($validated['requires_competent_person']) {
            $competentPersonId = $this->recordId(Employee::class, $validated['competent_person_uuid'] ?? null);
            $qualified = $competentPersonId !== null && EmployeeCertification::query()
                ->where('employee_id', $competentPersonId)
                ->whereHas('certification', fn ($query) => $query->where('is_competent_person', true))
                ->exists();

            if (! $qualified) {
                throw ValidationException::withMessages([
                    'competent_person_uuid' => 'Choose an employee who has a competent person certification.',
                ]);
            }

            if (! in_array($competentPersonId, $employeeIds, true)) {
                $employeeIds[] = $competentPersonId;
            }
        }

        $duplicate = EmployeeWorkSchedule::query()
            ->where('project_id', $projectId)
            ->whereDate('starts_on', '<=', $validated['ends_on'])
            ->whereDate('ends_on', '>=', $validated['starts_on'])
            ->when($schedule, fn ($query) => $query->whereKeyNot($schedule->id))
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'starts_on' => 'This job already has a crew during those dates. Open that schedule to change who is attending.',
            ]);
        }

        $attributes = [
            'project_id' => $projectId,
            'starts_on' => $validated['starts_on'],
            'ends_on' => $validated['ends_on'],
            'status' => $validated['status'],
            'foreman_user_id' => $validated['foreman_user_id'],
            'requires_competent_person' => $validated['requires_competent_person'],
            'competent_person_employee_id' => $competentPersonId,
            'notes' => $validated['notes'] ?? null,
        ];

        if ($schedule) {
            $schedule->update($attributes);
        } else {
            $schedule = EmployeeWorkSchedule::query()->create($attributes);
        }

        $schedule->employees()->sync($employeeIds);
        $schedule->load($this->relations());

        return $schedule;
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(EmployeeWorkSchedule $schedule): array
    {
        return $this->listingPayload(
            WorkScheduleListing::query()->findOrFail($schedule->id),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function listingPayload(WorkScheduleListing $listing): array
    {
        $start = $listing->starts_on;
        $end = $listing->ends_on;
        $status = $listing->status ?: EmployeeWorkSchedule::STATUS_ACTIVE;
        $competent = is_array($listing->competent_person) ? $listing->competent_person : null;

        return [
            'id' => $listing->id,
            'uuid' => $listing->uuid,
            'starts_on' => $start?->toDateString(),
            'ends_on' => $end?->toDateString(),
            'work_date' => $start?->toDateString(),
            'date_label' => $this->dateLabel($start, $end),
            'status' => $status,
            'status_label' => EmployeeWorkSchedule::STATUSES[$status] ?? 'Active',
            'notes' => $listing->notes,
            'requires_competent_person' => (bool) $listing->requires_competent_person,
            'competent_person' => $competent
                ? [
                    'id' => (int) $competent['id'],
                    'uuid' => $competent['uuid'] ?? null,
                    'full_name' => $competent['full_name'] ?? null,
                    'email' => $competent['email'] ?? null,
                ]
                : null,
            'project' => $listing->project_id
                ? [
                    'id' => (int) $listing->project_id,
                    'uuid' => $listing->project_uuid,
                    'name' => $listing->project_name,
                    'project_number' => $listing->project_number,
                    'address' => $this->listingAddress($listing),
                ]
                : null,
            'foreman' => $listing->foreman_user_id
                ? [
                    'id' => (int) $listing->foreman_user_id,
                    'name' => $listing->foreman_name,
                    'email' => $listing->foreman_email,
                ]
                : null,
            'employees' => $this->listingEmployees($listing),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function formOptions(): array
    {
        return [
            'statuses' => $this->statusOptions(),
            'projects' => Project::query()
                ->orderBy('name')
                ->get(['id', 'uuid', 'name', 'project_number'])
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'uuid' => $project->uuid,
                    'name' => $project->name,
                    'project_number' => $project->project_number,
                ])
                ->all(),
            'foremen' => User::query()
                ->whereHas('level', fn ($query) => $query->where('name', UserLevel::FOREMAN))
                ->orderBy('name')
                ->get(['id', 'name', 'email'])
                ->map(fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ])
                ->all(),
            'employees' => Employee::query()
                ->with([
                    'skills:id,name',
                    'certifications:id,employee_id,certification_id',
                    'certifications.certification:id,name,is_competent_person',
                ])
                ->whereIn('employment_status', [
                    Employee::STATUS_ACTIVE,
                    Employee::STATUS_ON_LEAVE,
                ])
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->get(['id', 'uuid', 'first_name', 'last_name', 'email'])
                ->map(fn (Employee $employee): array => [
                    'id' => $employee->id,
                    'uuid' => $employee->uuid,
                    'full_name' => $employee->fullName(),
                    'email' => $employee->email,
                    'competent_person' => $employee->certifications->contains(
                        fn (EmployeeCertification $assignment): bool => (bool) $assignment->certification?->is_competent_person,
                    ),
                    'certifications' => $this->certificationPayload($employee),
                    'skills' => $employee->skills
                        ->sortBy('name')
                        ->map(fn ($skill): array => [
                            'id' => $skill->id,
                            'name' => $skill->name,
                        ])
                        ->values()
                        ->all(),
                ])
                ->all(),
        ];
    }

    /**
     * @return list<string>
     */
    public function relations(): array
    {
        return [
            'project:id,uuid,name,project_number,site_address_line_1,site_address_line_2,site_city,site_state,site_postal_code',
            'foreman:id,name,email',
            'competentPerson:id,uuid,first_name,last_name,email',
            'employees:id,uuid,first_name,last_name,email',
            'employees.certifications:id,employee_id,certification_id',
            'employees.certifications.certification:id,name,is_competent_person',
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public function statusOptions(): array
    {
        return collect(EmployeeWorkSchedule::STATUSES)
            ->map(fn (string $label, string $value): array => [
                'value' => $value,
                'label' => $label,
            ])
            ->values()
            ->all();
    }

    public function statusQuery(mixed $value): ?string
    {
        return is_string($value) && array_key_exists($value, EmployeeWorkSchedule::STATUSES)
            ? $value
            : null;
    }

    public function recordId(string $model, mixed $value): ?int
    {
        if (! is_scalar($value) || $value === '') {
            return null;
        }

        $value = (string) $value;
        $query = $model::query();

        if (Str::isUuid($value)) {
            $id = $query->where('uuid', $value)->value('id');

            return $id === null ? null : (int) $id;
        }

        if (ctype_digit($value)) {
            $id = $query->whereKey((int) $value)->value('id');

            return $id === null ? null : (int) $id;
        }

        return null;
    }

    public function dateQuery(mixed $value): ?string
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        return $value;
    }

    /**
     * @param  Builder<EmployeeWorkSchedule>  $query
     */
    /**
     * @param  Builder<WorkScheduleListing>  $query
     */
    public function applyListingSearch($query, string $search): void
    {
        if ($search === '') {
            return;
        }

        $query->where(function ($query) use ($search): void {
            $query
                ->where('project_name', 'like', "%{$search}%")
                ->orWhere('project_number', 'like', "%{$search}%")
                ->orWhere('foreman_name', 'like', "%{$search}%")
                ->orWhere('foreman_email', 'like', "%{$search}%")
                ->orWhere('employees', 'like', "%{$search}%");
        });
    }

    /**
     * @param  Builder<EmployeeWorkSchedule>  $query
     */
    public function applySearch($query, string $search): void
    {
        if ($search === '') {
            return;
        }

        $query->where(function ($query) use ($search): void {
            $query
                ->whereHas('project', function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('project_number', 'like', "%{$search}%");
                })
                ->orWhereHas('foreman', function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                })
                ->orWhereHas('employees', function ($query) use ($search): void {
                    $query
                        ->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhereHas('certifications.certification', function ($query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%");
                        });
                });
        });
    }

    /**
     * @return array{create: bool, update: bool, delete: bool}
     */
    private function abilities(User $user): array
    {
        return [
            'create' => EmployeeAccess::canCreate($user),
            'update' => EmployeeAccess::canUpdate($user),
            'delete' => EmployeeAccess::canDelete($user),
        ];
    }

    /**
     * @return list<array{id: int, name: string, is_competent_person: bool}>
     */
    private function certificationPayload(Employee $employee): array
    {
        return $employee->certifications
            ->sortBy(fn (EmployeeCertification $assignment): string => $assignment->certification?->name ?? '')
            ->map(fn (EmployeeCertification $assignment): array => [
                'id' => $assignment->certification_id,
                'name' => (string) ($assignment->certification?->name ?? ''),
                'is_competent_person' => (bool) $assignment->certification?->is_competent_person,
            ])
            ->filter(fn (array $certification): bool => $certification['name'] !== '')
            ->values()
            ->all();
    }

    private function dateLabel(?\Illuminate\Support\Carbon $start, ?\Illuminate\Support\Carbon $end): ?string
    {
        if (! $start) {
            return null;
        }

        if (! $end || $start->equalTo($end)) {
            return $start->format('l, M j, Y');
        }

        return $start->format('l, M j').' – '.$end->format('l, M j, Y');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function listingEmployees(WorkScheduleListing $listing): array
    {
        return collect($this->jsonList($listing->employees))
            ->map(function (array $employee): array {
                return [
                    'id' => (int) ($employee['id'] ?? 0),
                    'uuid' => $employee['uuid'] ?? null,
                    'full_name' => (string) ($employee['full_name'] ?? ''),
                    'email' => $employee['email'] ?? null,
                    'job_title' => $employee['job_title'] ?? null,
                    'phone_number' => $employee['phone_number'] ?? null,
                    'skills' => collect($this->jsonList($employee['skills'] ?? []))
                        ->map(fn (array $skill): array => [
                            'id' => (int) ($skill['id'] ?? 0),
                            'name' => (string) ($skill['name'] ?? ''),
                        ])
                        ->filter(fn (array $skill): bool => $skill['name'] !== '')
                        ->sortBy('name')
                        ->values()
                        ->all(),
                    'certifications' => collect($this->jsonList($employee['certifications'] ?? []))
                        ->map(fn (array $certification): array => [
                            'id' => (int) ($certification['id'] ?? 0),
                            'name' => (string) ($certification['name'] ?? ''),
                            'is_competent_person' => filter_var(
                                $certification['is_competent_person'] ?? false,
                                FILTER_VALIDATE_BOOLEAN,
                            ),
                        ])
                        ->filter(fn (array $certification): bool => $certification['name'] !== '')
                        ->sortBy('name')
                        ->values()
                        ->all(),
                ];
            })
            ->sortBy('full_name')
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function jsonList(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : [];
        }

        return collect(is_array($value) ? $value : [])
            ->filter(fn (mixed $row): bool => is_array($row))
            ->values()
            ->all();
    }

    private function listingAddress(WorkScheduleListing $listing): ?string
    {
        $address = collect([
            $listing->site_address_line_1,
            $listing->site_address_line_2,
            collect([$listing->site_city, $listing->site_state])->filter()->implode(', '),
            $listing->site_postal_code,
        ])->filter(fn (mixed $part): bool => is_string($part) && trim($part) !== '')->implode(', ');

        return $address !== '' ? $address : null;
    }

    private function projectAddress(Project $project): ?string
    {
        $address = collect([
            $project->site_address_line_1,
            $project->site_address_line_2,
            collect([$project->site_city, $project->site_state])->filter()->implode(', '),
            $project->site_postal_code,
        ])->filter(fn (mixed $part): bool => is_string($part) && trim($part) !== '')->implode(', ');

        return $address !== '' ? $address : null;
    }
}
