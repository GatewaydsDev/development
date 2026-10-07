<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Admin\EmployeeWorkScheduleController as AdminEmployeeWorkScheduleController;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAttendanceDay;
use App\Models\EmployeeCheckIn;
use App\Models\EmployeeProjectAssignment;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class EmployeeWorkdayController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $employee = $this->employee($request);

        return response()->json($this->payload($employee));
    }

    public function checkIn(Request $request): JsonResponse
    {
        $employee = $this->employee($request);
        $today = now()->toDateString();

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0', 'max:100000'],
        ]);

        $existing = $employee->checkIns()->whereDate('work_date', $today)->first();

        if ($existing instanceof EmployeeCheckIn) {
            return response()->json($this->payload($employee));
        }

        $assignment = $this->todayAssignments($employee, $today)->first();

        $employee->checkIns()->create([
            'work_date' => $today,
            'checked_in_at' => now(),
            'latitude' => $validated['latitude'],
            'longitude' => $validated['longitude'],
            'accuracy' => $validated['accuracy'] ?? null,
            'project_id' => $assignment?->project_id,
        ]);

        $day = EmployeeAttendanceDay::query()
            ->whereDate('work_date', $today)
            ->whereHas('week', fn ($query) => $query->where('employee_id', $employee->id))
            ->first();

        if ($day instanceof EmployeeAttendanceDay && ! $day->worked) {
            $day->forceFill(['worked' => true])->save();
        }

        return response()->json($this->payload($employee->fresh()), 201);
    }

    private function employee(Request $request): Employee
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        $employee = $user->employee;
        abort_unless($employee instanceof Employee, 404);

        return $employee;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Employee $employee): array
    {
        $today = now()->toDateString();
        $employee->loadMissing(['professions:id,name', 'skills:id,name']);

        $day = EmployeeAttendanceDay::query()
            ->whereDate('work_date', $today)
            ->whereHas('week', fn ($query) => $query->where('employee_id', $employee->id))
            ->first();

        $checkIn = $employee->checkIns()->whereDate('work_date', $today)->first();

        return [
            'date' => $today,
            'employee' => [
                'id' => $employee->id,
                'uuid' => $employee->uuid,
                'full_name' => $employee->fullName(),
                'email' => $employee->email,
                'phone_number' => $employee->phone_number,
                'job_title' => $employee->job_title,
                'department' => $employee->department,
                'employment_status' => $employee->employment_status,
                'professions' => $employee->professions
                    ->map(fn ($profession): array => [
                        'id' => $profession->id,
                        'name' => $profession->name,
                    ])
                    ->values()
                    ->all(),
                'skills' => $employee->skills
                    ->map(fn ($skill): array => [
                        'id' => $skill->id,
                        'name' => $skill->name,
                    ])
                    ->values()
                    ->all(),
            ],
            'schedules' => EmployeeWorkSchedule::query()
                ->covering($today)
                ->where('status', EmployeeWorkSchedule::STATUS_ACTIVE)
                ->whereHas('employees', fn ($query) => $query->whereKey($employee->id))
                ->with(app(AdminEmployeeWorkScheduleController::class)->relations())
                ->orderBy('id')
                ->get()
                ->map(fn (EmployeeWorkSchedule $schedule): array => app(AdminEmployeeWorkScheduleController::class)->payload($schedule))
                ->values()
                ->all(),
            'assignments' => $this->todayAssignments($employee, $today)
                ->map(fn (EmployeeProjectAssignment $assignment): array => [
                    'id' => $assignment->id,
                    'work_date' => $assignment->work_date?->toDateString(),
                    'notes' => $assignment->notes,
                    'project' => $assignment->project instanceof Project
                        ? [
                            'id' => $assignment->project->id,
                            'uuid' => $assignment->project->uuid,
                            'name' => $assignment->project->name,
                            'project_number' => $assignment->project->project_number,
                            'address' => $this->projectAddress($assignment->project),
                        ]
                        : null,
                ])
                ->values()
                ->all(),
            'attendance' => $day instanceof EmployeeAttendanceDay
                ? [
                    'scheduled' => $day->scheduled,
                    'worked' => $day->worked,
                ]
                : null,
            'check_in' => $checkIn instanceof EmployeeCheckIn
                ? [
                    'checked_in_at' => $checkIn->checked_in_at?->toIso8601String(),
                    'latitude' => $checkIn->latitude,
                    'longitude' => $checkIn->longitude,
                    'accuracy' => $checkIn->accuracy,
                    'project_id' => $checkIn->project_id,
                    'project_uuid' => $checkIn->project?->uuid,
                ]
                : null,
        ];
    }

    /**
     * @return Collection<int, EmployeeProjectAssignment>
     */
    private function todayAssignments(Employee $employee, string $today)
    {
        return $employee->projectAssignments()
            ->with('project')
            ->whereDate('work_date', $today)
            ->orderBy('id')
            ->get();
    }

    private function projectAddress(Project $project): ?string
    {
        $address = collect([
            $project->site_address_line_1,
            $project->site_address_line_2,
            collect([$project->site_city, $project->site_state])->filter()->implode(', '),
            $project->site_postal_code,
        ])->filter(fn (mixed $part): bool => is_string($part) && trim($part) !== '')->implode("\n");

        return $address !== '' ? $address : null;
    }
}
