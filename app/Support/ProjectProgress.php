<?php

namespace App\Support;

use App\Models\DailyTaskCompletion;
use App\Models\DailyTaskPhoto;
use App\Models\Employee;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use Illuminate\Support\Collection;

/**
 * Client-safe view of how a job is going: crew, task progress and photos.
 * It never exposes pay rates, contact details or internal notes.
 */
class ProjectProgress
{
    private const PHOTO_LIMIT = 48;

    /**
     * @return array<string, mixed>
     */
    public static function for(Project $project): array
    {
        $today = now()->toDateString();

        $schedules = EmployeeWorkSchedule::query()
            ->where('project_id', $project->id)
            ->with([
                'foreman:id,name',
                'competentPerson.jobTitle',
                'qualityControl.jobTitle',
                'employees.jobTitle',
                'dailyTasks' => fn ($query) => $query->active()->ordered(),
            ])
            ->orderByDesc('starts_on')
            ->orderByDesc('id')
            ->get();

        $completions = DailyTaskCompletion::query()
            ->whereIn('employee_work_schedule_id', $schedules->pluck('id'))
            ->orderBy('work_date')
            ->orderBy('id')
            ->get();

        $tasks = self::tasks($schedules, $completions);

        return [
            'overall_progress' => $tasks->isEmpty() ? null : (int) round($tasks->avg('progress')),
            'tasks_total' => $tasks->count(),
            'tasks_done' => $tasks->where('status', DailyTaskCompletion::STATUS_COMPLETED)->count(),
            'is_working_today' => $schedules->contains(fn (EmployeeWorkSchedule $schedule): bool => $schedule->status === EmployeeWorkSchedule::STATUS_ACTIVE
                && $schedule->starts_on->toDateString() <= $today
                && $schedule->ends_on->toDateString() >= $today),
            'schedules' => $schedules->map(fn (EmployeeWorkSchedule $schedule): array => [
                'uuid' => $schedule->uuid,
                'starts_on' => $schedule->starts_on?->toDateString(),
                'ends_on' => $schedule->ends_on?->toDateString(),
                'status' => $schedule->status,
                'status_label' => EmployeeWorkSchedule::STATUSES[$schedule->status] ?? ucfirst((string) $schedule->status),
                'foreman' => $schedule->foreman?->name,
                'crew' => self::crew($schedule),
            ])->values()->all(),
            'tasks' => $tasks->values()->all(),
            'photos' => self::photos($completions),
        ];
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private static function tasks(Collection $schedules, Collection $completions): Collection
    {
        $tasks = collect();

        foreach ($schedules as $schedule) {
            foreach ($schedule->dailyTasks as $task) {
                $latest = $completions
                    ->where('employee_work_schedule_id', $schedule->id)
                    ->where('daily_task_id', $task->id)
                    ->last();

                $status = $latest?->status ?? DailyTaskCompletion::STATUS_PENDING;
                $progress = $status === DailyTaskCompletion::STATUS_COMPLETED
                    ? 100
                    : (int) ($latest?->progress ?? 0);

                $tasks->push([
                    'key' => $schedule->id.'-'.$task->id,
                    'title' => $task->title,
                    'status' => $status,
                    'status_label' => DailyTaskCompletion::STATUSES[$status] ?? ucfirst($status),
                    'progress' => max(0, min(100, $progress)),
                    'updated_on' => $latest?->work_date?->toDateString(),
                ]);
            }
        }

        return $tasks;
    }

    /**
     * @return list<array{name: string, job_title: ?string, role: string}>
     */
    private static function crew(EmployeeWorkSchedule $schedule): array
    {
        $members = collect();

        $add = function (?Employee $employee, string $role) use ($members): void {
            if ($employee && ! $members->has($employee->id.'-'.$role)) {
                $members->put($employee->id.'-'.$role, [
                    'name' => $employee->fullName(),
                    'job_title' => $employee->jobTitle?->name ?? $employee->job_title,
                    'role' => $role,
                ]);
            }
        };

        $add($schedule->competentPerson, 'Competent person');
        $add($schedule->qualityControl, 'Quality control');

        foreach ($schedule->employees as $employee) {
            $add($employee, 'Crew');
        }

        return $members->values()->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function photos(Collection $completions): array
    {
        $byCompletion = $completions->keyBy('id');

        return DailyTaskPhoto::query()
            ->whereIn('daily_task_completion_id', $byCompletion->keys())
            ->with('completion.task:id,title')
            ->latest('id')
            ->limit(self::PHOTO_LIMIT)
            ->get()
            ->map(fn (DailyTaskPhoto $photo): array => [
                'uuid' => $photo->uuid,
                'caption' => $photo->caption,
                'task' => $photo->completion?->task?->title,
                'taken_at' => ($photo->taken_at ?? $photo->created_at)?->toDateTimeString(),
                'work_date' => $photo->completion?->work_date?->toDateString(),
            ])
            ->all();
    }
}
