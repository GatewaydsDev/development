<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DailyTask;
use App\Models\Employee;
use App\Models\EmployeeWorkSchedule;
use App\Models\User;
use App\Models\WorkScheduleListing;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MyScheduleController extends Controller
{
    private const WINDOW_DAYS = 14;

    public function index(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        $today = now()->toDateString();
        $until = now()->addDays(self::WINDOW_DAYS)->toDateString();
        $employee = Employee::query()->where('user_id', $user->id)->first();

        $schedules = [];

        if ($employee instanceof Employee) {
            $listings = EmployeeWorkSchedule::query()
                ->where('status', '!=', EmployeeWorkSchedule::STATUS_INACTIVE)
                ->whereDate('ends_on', '>=', $today)
                ->whereDate('starts_on', '<=', $until)
                ->where(fn ($query) => $query
                    ->whereHas('employees', fn ($crew) => $crew->whereKey($employee->id))
                    ->orWhere('competent_person_employee_id', $employee->id)
                    ->orWhere('quality_control_employee_id', $employee->id))
                ->with([
                    'qualityControl:id,first_name,last_name',
                    'dailyTasks' => fn ($query) => $query->active()->ordered(),
                ])
                ->orderBy('starts_on')
                ->orderBy('id')
                ->get();

            $payloads = app(EmployeeWorkScheduleController::class);

            $schedules = $listings
                ->map(function (EmployeeWorkSchedule $schedule) use ($payloads, $today): array {
                    $listing = WorkScheduleListing::query()->findOrFail($schedule->id);
                    $payload = $payloads->listingPayload($listing);

                    return [
                        'uuid' => $payload['uuid'],
                        'starts_on' => $payload['starts_on'],
                        'ends_on' => $payload['ends_on'],
                        'date_label' => $payload['date_label'],
                        'status' => $payload['status'],
                        'status_label' => $payload['status_label'],
                        'is_today' => $payload['starts_on'] <= $today && $payload['ends_on'] >= $today,
                        'notes' => $payload['notes'],
                        'project' => $payload['project'],
                        'foreman' => $payload['foreman'],
                        'competent_person' => $payload['competent_person'],
                        'quality_control' => $schedule->qualityControl
                            ? ['full_name' => $schedule->qualityControl->fullName()]
                            : null,
                        'crew' => collect($payload['employees'])
                            ->map(fn (array $member): array => [
                                'full_name' => $member['full_name'],
                                'job_title' => $member['job_title'],
                            ])
                            ->values()
                            ->all(),
                        'tasks' => $schedule->dailyTasks
                            ->map(fn (DailyTask $task): array => [
                                'uuid' => $task->uuid,
                                'title' => $task->title,
                                'description' => $task->description,
                                'requires_photo' => (bool) $task->requires_photo,
                                'requires_quality_control' => (bool) $task->requires_quality_control,
                                'performed_by' => $task->performed_by,
                                'performed_by_label' => DailyTask::PERFORMERS[$task->performed_by] ?? null,
                            ])
                            ->values()
                            ->all(),
                    ];
                })
                ->all();
        }

        return Inertia::render('Admin/MySchedule/Index', [
            'employee' => $employee ? ['full_name' => $employee->fullName()] : null,
            'schedules' => $schedules,
            'today' => $today,
            'windowDays' => self::WINDOW_DAYS,
        ]);
    }
}
