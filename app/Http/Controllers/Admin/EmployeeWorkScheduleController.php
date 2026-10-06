<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\EmployeeAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

        $schedules = EmployeeAccess::scopeVisibleSchedules(EmployeeWorkSchedule::query(), $user)
            ->with($this->relations())
            ->whereDate('work_date', $date)
            ->tap(fn ($query) => $this->applySearch($query, $search))
            ->orderBy('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (EmployeeWorkSchedule $schedule): array => $this->payload($schedule));

        return Inertia::render('Admin/EmployeeSchedules/Index', [
            'filters' => [
                'date' => $date,
                'search' => $search,
            ],
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

        $this->saveSchedule($request);

        return redirect()
            ->route('admin.employee-schedules.index', [
                'date' => $request->input('work_date'),
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

        $this->saveSchedule($request, $schedule);

        return redirect()
            ->route('admin.employee-schedules.index', [
                'date' => $request->input('work_date'),
            ])
            ->with('success', 'Work schedule updated.');
    }

    public function destroy(Request $request, EmployeeWorkSchedule $schedule): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && EmployeeAccess::canDelete($user), 403);
        EmployeeAccess::ensureCanViewSchedule($user, $schedule);

        $date = $schedule->work_date?->toDateString();
        $schedule->delete();

        return redirect()
            ->route('admin.employee-schedules.index', ['date' => $date])
            ->with('success', 'Work schedule removed.');
    }

    public function saveSchedule(Request $request, ?EmployeeWorkSchedule $schedule = null): EmployeeWorkSchedule
    {
        $validated = $request->validate([
            'project_id' => ['required', 'integer', Rule::exists(Project::class, 'id')],
            'work_date' => ['required', 'date'],
            'foreman_user_id' => [
                'required',
                'integer',
                Rule::exists(User::class, 'id')->where(fn ($query) => $query->whereIn(
                    'level_id',
                    UserLevel::query()->where('name', UserLevel::FOREMAN)->select('id'),
                )),
            ],
            'employee_ids' => ['required', 'array', 'min:1'],
            'employee_ids.*' => ['integer', 'distinct', Rule::exists(Employee::class, 'id')],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $duplicate = EmployeeWorkSchedule::query()
            ->where('project_id', $validated['project_id'])
            ->whereDate('work_date', $validated['work_date'])
            ->when($schedule, fn ($query) => $query->whereKeyNot($schedule->id))
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'project_id' => 'This job already has a crew on that date. Open that schedule to change who is attending.',
            ]);
        }

        $attributes = [
            'project_id' => $validated['project_id'],
            'work_date' => $validated['work_date'],
            'foreman_user_id' => $validated['foreman_user_id'],
            'notes' => $validated['notes'] ?? null,
        ];

        if ($schedule) {
            $schedule->update($attributes);
        } else {
            $schedule = EmployeeWorkSchedule::query()->create($attributes);
        }

        $schedule->employees()->sync($validated['employee_ids']);
        $schedule->load($this->relations());

        return $schedule;
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(EmployeeWorkSchedule $schedule): array
    {
        $schedule->loadMissing($this->relations());

        return [
            'id' => $schedule->id,
            'work_date' => $schedule->work_date?->toDateString(),
            'notes' => $schedule->notes,
            'project' => $schedule->project
                ? [
                    'id' => $schedule->project->id,
                    'name' => $schedule->project->name,
                    'project_number' => $schedule->project->project_number,
                    'address' => $this->projectAddress($schedule->project),
                ]
                : null,
            'foreman' => $schedule->foreman
                ? [
                    'id' => $schedule->foreman->id,
                    'name' => $schedule->foreman->name,
                    'email' => $schedule->foreman->email,
                ]
                : null,
            'employees' => $schedule->employees
                ->sortBy(fn (Employee $employee): string => $employee->fullName())
                ->map(fn (Employee $employee): array => [
                    'id' => $employee->id,
                    'full_name' => $employee->fullName(),
                    'email' => $employee->email,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function formOptions(): array
    {
        return [
            'projects' => Project::query()
                ->orderBy('name')
                ->get(['id', 'name', 'project_number'])
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
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
                ->whereIn('employment_status', [
                    Employee::STATUS_ACTIVE,
                    Employee::STATUS_ON_LEAVE,
                ])
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->get(['id', 'first_name', 'last_name', 'email'])
                ->map(fn (Employee $employee): array => [
                    'id' => $employee->id,
                    'full_name' => $employee->fullName(),
                    'email' => $employee->email,
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
            'project:id,name,project_number,site_address_line_1,site_address_line_2,site_city,site_state,site_postal_code',
            'foreman:id,name,email',
            'employees:id,first_name,last_name,email',
        ];
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
                        ->orWhere('email', 'like', "%{$search}%");
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
