<?php

namespace App\Support;

use App\Models\DailyTask;
use App\Models\DailyTaskCompletion;
use App\Models\DailyTaskPhoto;
use App\Models\Employee;
use App\Models\EmployeeWorkSchedule;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Builds the tasks a foreman has to work through on a given day and records their progress.
 *
 * A task attached to work schedules only applies through those schedules (while they cover the date,
 * are active and belong to the foreman). A task attached to no schedule is a general daily task.
 */
class DailyTaskChecklist
{
    /**
     * @return Collection<int, array{task: DailyTask, schedule: ?EmployeeWorkSchedule, completion: ?DailyTaskCompletion}>
     */
    public static function entries(User $user, string $date): Collection
    {
        $schedules = EmployeeWorkSchedule::query()
            ->with([
                'project:id,uuid,name,project_number',
                'employees.jobTitle',
                'competentPerson.jobTitle',
                'qualityControl.jobTitle',
                'dailyTasks' => fn ($query) => $query->active()->with('employees:id,first_name,last_name'),
            ])
            ->where('foreman_user_id', $user->id)
            ->where('status', EmployeeWorkSchedule::STATUS_ACTIVE)
            ->covering($date)
            ->orderBy('starts_on')
            ->orderBy('id')
            ->get();

        $general = DailyTask::query()
            ->with('employees:id,first_name,last_name')
            ->active()
            ->forForeman($user->id)
            ->whereDoesntHave('schedules')
            ->ordered()
            ->get();

        $completions = DailyTaskCompletion::query()
            ->with('photos', 'performers')
            ->where('user_id', $user->id)
            ->whereDate('work_date', $date)
            ->get()
            ->keyBy(fn (DailyTaskCompletion $completion): string => self::key(
                $completion->daily_task_id,
                $completion->employee_work_schedule_id,
            ));

        $entries = collect();

        foreach ($schedules as $schedule) {
            foreach ($schedule->dailyTasks->sortBy([['sort_order', 'asc'], ['id', 'asc']]) as $task) {
                if ($task->foreman_user_id !== null && $task->foreman_user_id !== $user->id) {
                    continue;
                }

                $entries->push([
                    'task' => $task,
                    'schedule' => $schedule,
                    'completion' => $completions->get(self::key($task->id, $schedule->id)),
                ]);
            }
        }

        foreach ($general as $task) {
            $entries->push([
                'task' => $task,
                'schedule' => null,
                'completion' => $completions->get(self::key($task->id, null)),
            ]);
        }

        return $entries->values();
    }

    public static function find(User $user, string $date, DailyTask $task, ?EmployeeWorkSchedule $schedule): ?array
    {
        return self::entries($user, $date)->first(
            fn (array $entry): bool => $entry['task']->is($task)
                && ($entry['schedule']?->id) === $schedule?->id,
        );
    }

    public static function pendingCount(User $user, string $date): int
    {
        return self::entries($user, $date)
            ->filter(fn (array $entry): bool => $entry['completion']?->status !== DailyTaskCompletion::STATUS_COMPLETED)
            ->count();
    }

    /**
     * @param  array{status: string, progress?: ?int, notes?: ?string, latitude?: ?float, longitude?: ?float}  $data
     * @param  list<UploadedFile>  $photos
     */
    public static function record(
        User $user,
        string $date,
        DailyTask $task,
        ?EmployeeWorkSchedule $schedule,
        array $data,
        array $photos = [],
    ): DailyTaskCompletion {
        $status = $data['status'];

        if ($status === DailyTaskCompletion::STATUS_COMPLETED && $task->requires_photo) {
            $existing = DailyTaskPhoto::query()->whereHas('completion', fn ($query) => $query
                ->where('daily_task_id', $task->id)
                ->where('user_id', $user->id)
                ->whereDate('work_date', $date)
                ->where('employee_work_schedule_id', $schedule?->id))->exists();

            if (! $existing && count($photos) === 0) {
                throw ValidationException::withMessages(['photos' => 'This task needs at least one photo before it can be completed.']);
            }
        }
        $uuids = collect($data['performed_by_employee_uuids'] ?? [])
            ->when(! empty($data['performed_by_employee_uuid']), fn (Collection $list) => $list->push($data['performed_by_employee_uuid']))
            ->filter()->unique()->values();
        $assigned = self::resolvePerformers($user, $task, $schedule, $uuids);

        $progress = match ($status) {
            DailyTaskCompletion::STATUS_COMPLETED => 100,
            DailyTaskCompletion::STATUS_PENDING => 0,
            default => max(0, min(100, (int) ($data['progress'] ?? 0))),
        };

        $completion = DailyTaskCompletion::query()
            ->where('daily_task_id', $task->id)
            ->where('user_id', $user->id)
            ->whereDate('work_date', $date)
            ->where('employee_work_schedule_id', $schedule?->id)
            ->first() ?? new DailyTaskCompletion([
                'daily_task_id' => $task->id,
                'user_id' => $user->id,
                'work_date' => $date,
                'employee_work_schedule_id' => $schedule?->id,
            ]);

        $wasCompleted = $completion->status === DailyTaskCompletion::STATUS_COMPLETED && $completion->completed_at;

        $completion->fill([
            'status' => $status,
            'progress' => $progress,
            'performed_by_employee_id' => $assigned->first()?->id,
            'notes' => array_key_exists('notes', $data) ? ($data['notes'] ?: null) : $completion->notes,
            'latitude' => $data['latitude'] ?? $completion->latitude,
            'longitude' => $data['longitude'] ?? $completion->longitude,
            'completed_at' => $status === DailyTaskCompletion::STATUS_COMPLETED
                ? ($wasCompleted ? $completion->completed_at : now())
                : null,
        ])->save();

        $completion->performers()->sync($assigned->pluck('id')->all());

        foreach ($photos as $file) {
            $path = $file->store("daily-tasks/{$date}", 'local');

            $completion->photos()->create([
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize() ?: 0,
                'taken_at' => now(),
            ]);
        }

        return $completion->load('photos', 'performers');
    }

    /**
     * Who may carry out a task: the foreman, the crew, the competent person or the quality control person.
     *
     * @return Collection<int, array{uuid: string, employee: ?Employee, name: string, job_title: ?string, is_self: bool, tags: list<string>}>
     */
    public static function performers(User $user, DailyTask $task, ?EmployeeWorkSchedule $schedule): Collection
    {
        $own = Employee::query()->with('jobTitle')->where('user_id', $user->id)->first();
        $self = fn (): array => [
            'uuid' => $own?->uuid ?? 'self',
            'employee' => $own,
            'name' => $own?->fullName() ?: $user->name,
            'job_title' => $own?->jobTitle?->name ?? $own?->job_title,
            'is_self' => true,
            'tags' => ['Foreman'],
        ];
        $person = fn (Employee $employee, string $tag): array => [
            'uuid' => $employee->uuid,
            'employee' => $employee,
            'name' => $employee->fullName(),
            'job_title' => $employee->jobTitle?->name ?? $employee->job_title,
            'is_self' => $own !== null && $employee->id === $own->id,
            'tags' => [$tag],
        ];

        $competent = $schedule?->competentPerson;
        $quality = $schedule?->qualityControl;

        $list = match ($task->performed_by) {
            DailyTask::PERFORMER_FOREMAN => collect([$self()]),
            DailyTask::PERFORMER_COMPETENT => collect($competent ? [$person($competent, 'Competent person')] : []),
            DailyTask::PERFORMER_QUALITY_CONTROL => collect($quality ? [$person($quality, 'Quality control')] : []),
            default => collect([$self()])->merge(
                ($schedule?->employees ?? collect())
                    ->reject(fn (Employee $employee): bool => $own !== null && $employee->id === $own->id)
                    ->sortBy(fn (Employee $employee): string => $employee->fullName())
                    ->map(fn (Employee $employee): array => $person($employee, 'Crew')),
            ),
        };

        return $list->unique('uuid')->values();
    }

    /**
     * @param  Collection<int, string>  $uuids
     * @return Collection<int, Employee>
     */
    private static function resolvePerformers(User $user, DailyTask $task, ?EmployeeWorkSchedule $schedule, Collection $uuids): Collection
    {
        $options = self::performers($user, $task, $schedule);

        if ($options->isEmpty()) {
            throw ValidationException::withMessages([
                'performed_by_employee_uuids' => 'No '.strtolower(DailyTask::PERFORMERS[$task->performed_by] ?? 'person').' is set on this job yet.',
            ]);
        }

        $chosen = $uuids->isEmpty() ? collect([$options->first()]) : $uuids->map(fn (string $uuid) => $options->firstWhere('uuid', $uuid));

        if ($chosen->contains(null)) {
            throw ValidationException::withMessages([
                'performed_by_employee_uuids' => 'One of the selected people cannot perform this task.',
            ]);
        }

        return $chosen->pluck('employee')->filter()->values();
    }

    /**
     * @return array<string, mixed>
     */
    public static function payload(User $user, array $entry, string $photoRoute): array
    {
        /** @var DailyTask $task */
        $task = $entry['task'];
        /** @var ?EmployeeWorkSchedule $schedule */
        $schedule = $entry['schedule'];
        /** @var ?DailyTaskCompletion $completion */
        $completion = $entry['completion'];

        $crew = $schedule ? $schedule->employees : $task->employees;

        return [
            'task_uuid' => $task->uuid,
            'title' => $task->title,
            'description' => $task->description,
            'requires_photo' => $task->requires_photo,
            'requires_quality_control' => $task->requires_quality_control,
            'quality_control' => $schedule?->qualityControl?->fullName(),
            'performed_by' => $task->performed_by,
            'performed_by_label' => DailyTask::PERFORMERS[$task->performed_by] ?? DailyTask::PERFORMERS[DailyTask::PERFORMER_ANYONE],
            'performers' => self::performers($user, $task, $schedule)
                ->map(fn (array $item): array => [
                    'uuid' => $item['uuid'],
                    'name' => $item['name'],
                    'job_title' => $item['job_title'],
                    'is_self' => $item['is_self'],
                    'tags' => $item['tags'],
                ])
                ->all(),
            'performed_by_employee_uuids' => $completion && $completion->performers->isNotEmpty()
                ? $completion->performers->pluck('uuid')->all()
                : ($completion?->performedBy ? [$completion->performedBy->uuid] : []),
            'schedule_uuid' => $schedule?->uuid,
            'project' => $schedule?->project ? [
                'uuid' => $schedule->project->uuid,
                'name' => $schedule->project->name,
                'project_number' => $schedule->project->project_number,
            ] : null,
            'status' => $completion?->status ?? DailyTaskCompletion::STATUS_PENDING,
            'progress' => $completion?->progress ?? 0,
            'completed' => $completion?->status === DailyTaskCompletion::STATUS_COMPLETED,
            'completed_at' => $completion?->completed_at?->toIso8601String(),
            'notes' => $completion?->notes,
            'employee_names' => $crew
                ->map(fn ($employee): string => $employee->fullName())
                ->sort()
                ->values()
                ->all(),
            'photos' => ($completion?->photos ?? collect())
                ->map(fn (DailyTaskPhoto $photo): array => [
                    'uuid' => $photo->uuid,
                    'url' => route($photoRoute, $photo),
                    'taken_at' => $photo->taken_at?->toIso8601String(),
                ])
                ->values()
                ->all(),
        ];
    }

    private static function key(int $taskId, ?int $scheduleId): string
    {
        return $taskId.':'.($scheduleId ?? 0);
    }
}
