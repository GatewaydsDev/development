<?php

namespace App\Support;

use App\Models\DailyTask;
use App\Models\DailyTaskCompletion;
use App\Models\DailyTaskPhoto;
use App\Models\EmployeeAttendanceDay;
use App\Models\EmployeeWorkSchedule;
use App\Models\QualityControlReport;
use Illuminate\Support\Collection;

/**
 * Brings a work schedule, its attendance, task progress, photos and quality control together.
 */
class JobProgress
{
    /**
     * @param  Collection<int, EmployeeWorkSchedule>  $schedules  with dailyTasks loaded
     * @return array<int, array<string, mixed>> summaries keyed by schedule id
     */
    public static function summaries(Collection $schedules): array
    {
        $ids = $schedules->pluck('id');
        $completions = self::completions($ids)->groupBy('employee_work_schedule_id');
        $reports = self::reports($ids)->groupBy('employee_work_schedule_id');
        $attendance = EmployeeAttendanceDay::query()
            ->whereIn('employee_work_schedule_id', $ids)
            ->where('worked', true)
            ->get(['employee_work_schedule_id', 'work_date', 'hours'])
            ->groupBy('employee_work_schedule_id');

        return $schedules->mapWithKeys(function (EmployeeWorkSchedule $schedule) use ($completions, $reports, $attendance): array {
            $tasks = self::taskStates(
                $schedule,
                $completions->get($schedule->id, collect()),
                $reports->get($schedule->id, collect()),
            );
            $days = $attendance->get($schedule->id, collect());
            $total = $tasks->count();

            return [$schedule->id => [
                'progress' => $total > 0 ? (int) round($tasks->avg('progress')) : 0,
                'tasks_total' => $total,
                'tasks_done' => $tasks->where('status', DailyTaskCompletion::STATUS_COMPLETED)->count(),
                'tasks_blocked' => $tasks->where('status', DailyTaskCompletion::STATUS_BLOCKED)->count(),
                'photos' => $tasks->sum('photo_count'),
                'photos_missing' => $tasks->filter(fn (array $task): bool => $task['requires_photo']
                    && $task['photo_count'] === 0
                    && $task['status'] !== DailyTaskCompletion::STATUS_PENDING)->count(),
                'qc_required' => $tasks->where('requires_quality_control', true)->count(),
                'qc_passed' => $tasks->where('quality_control.result', QualityControlReport::RESULT_PASSED)->count(),
                'qc_open' => $tasks->filter(fn (array $task): bool => $task['qc_open'])->count(),
                'days_worked' => $days->pluck('work_date')->map(fn ($date) => $date->toDateString())->unique()->count(),
                'hours' => round((float) $days->sum(fn ($day): float => (float) $day->hours), 2),
            ]];
        })->all();
    }

    /**
     * @return array<string, mixed>
     */
    public static function detail(EmployeeWorkSchedule $schedule, string $date, string $photoRoute): array
    {
        $schedule->loadMissing(['dailyTasks' => fn ($query) => $query->ordered()]);

        $completions = self::completions(collect([$schedule->id]));
        $reports = self::reports(collect([$schedule->id]));
        $tasks = self::taskStates($schedule, $completions, $reports);
        $summary = self::summaries(collect([$schedule]))[$schedule->id];

        $dayCompletions = $completions->filter(fn (DailyTaskCompletion $completion): bool => $completion->work_date->toDateString() === $date);

        return [
            'summary' => $summary,
            'tasks' => $tasks->map(function (array $state) use ($completions, $reports, $photoRoute): array {
                /** @var DailyTask $task */
                $task = $state['task'];
                $history = $completions->where('daily_task_id', $task->id);

                return [
                    ...collect($state)->except(['task', 'latest', 'report'])->all(),
                    'uuid' => $task->uuid,
                    'title' => $task->title,
                    'description' => $task->description,
                    'performers' => $state['latest']?->performers->map(fn ($employee): string => $employee->fullName())->values()->all() ?? [],
                    'notes' => $state['latest']?->notes,
                    'updated_on' => $state['latest']?->work_date?->toDateString(),
                    'last_changed_at' => $state['latest']?->updated_at?->toIso8601String(),
                    'photos' => $history->flatMap(fn (DailyTaskCompletion $completion) => $completion->photos
                        ->map(fn (DailyTaskPhoto $photo): array => [
                            'uuid' => $photo->uuid,
                            'url' => route($photoRoute, $photo),
                            'taken_at' => $photo->taken_at?->toIso8601String(),
                            'work_date' => $completion->work_date->toDateString(),
                        ]))->values()->all(),
                    'reports' => $reports->where('daily_task_id', $task->id)
                        ->sortByDesc(fn (QualityControlReport $report): string => $report->inspected_on->toDateString().str_pad((string) $report->id, 10, '0', STR_PAD_LEFT))
                        ->map(fn (QualityControlReport $report): array => self::reportSummary($report))
                        ->values()->all(),
                ];
            })->values()->all(),
            'attendance' => ScheduleAttendance::payload($schedule, $date),
            'payroll' => ScheduleAttendance::summary($schedule),
            'day' => [
                'date' => $date,
                'updates' => $dayCompletions->map(fn (DailyTaskCompletion $completion): array => [
                    'task' => $completion->task?->title,
                    'status' => $completion->status,
                    'progress' => $completion->progress,
                    'photos' => $completion->photos->count(),
                    'notes' => $completion->notes,
                ])->values()->all(),
            ],
            'timeline' => self::timeline($schedule, $completions),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function reportSummary(QualityControlReport $report): array
    {
        return [
            'uuid' => $report->uuid,
            'inspected_on' => $report->inspected_on->toDateString(),
            'result' => $report->result,
            'result_label' => QualityControlReport::RESULTS[$report->result] ?? $report->result,
            'inspector' => $report->inspector?->name,
            'failed_checks' => collect($report->checklist)
                ->filter(fn (string $answer): bool => $answer === QualityControlReport::ANSWER_FAIL)
                ->count(),
        ];
    }

    /**
     * Dates with activity (attendance or task updates), newest first.
     *
     * @param  Collection<int, DailyTaskCompletion>  $completions
     * @return list<array{date: string, present: int, hours: float, tasks: int, photos: int}>
     */
    private static function timeline(EmployeeWorkSchedule $schedule, Collection $completions): array
    {
        $attendance = EmployeeAttendanceDay::query()
            ->where('employee_work_schedule_id', $schedule->id)
            ->where('worked', true)
            ->get(['work_date', 'hours'])
            ->groupBy(fn ($day): string => $day->work_date->toDateString());
        $updates = $completions->groupBy(fn (DailyTaskCompletion $completion): string => $completion->work_date->toDateString());

        return $attendance->keys()->merge($updates->keys())->unique()->sortDesc()->values()
            ->map(fn (string $date): array => [
                'date' => $date,
                'present' => $attendance->get($date, collect())->count(),
                'hours' => round((float) $attendance->get($date, collect())->sum(fn ($day): float => (float) $day->hours), 2),
                'tasks' => $updates->get($date, collect())->count(),
                'photos' => $updates->get($date, collect())->sum(fn (DailyTaskCompletion $completion): int => $completion->photos->count()),
            ])
            ->all();
    }

    /**
     * @param  Collection<int, DailyTaskCompletion>  $completions
     * @param  Collection<int, QualityControlReport>  $reports
     * @return Collection<int, array<string, mixed>>
     */
    private static function taskStates(EmployeeWorkSchedule $schedule, Collection $completions, Collection $reports): Collection
    {
        return $schedule->dailyTasks->where('is_active', true)->map(function (DailyTask $task) use ($completions, $reports): array {
            $history = $completions->where('daily_task_id', $task->id);
            $latest = $history->last();
            $report = $reports->where('daily_task_id', $task->id)->last();
            $status = $latest?->status ?? DailyTaskCompletion::STATUS_PENDING;
            $passed = $report?->result === QualityControlReport::RESULT_PASSED;

            return [
                'task' => $task,
                'latest' => $latest,
                'report' => $report,
                'status' => $status,
                'status_label' => DailyTaskCompletion::STATUSES[$status] ?? $status,
                'progress' => (int) ($latest?->progress ?? 0),
                'requires_photo' => (bool) $task->requires_photo,
                'requires_quality_control' => (bool) $task->requires_quality_control,
                'photo_count' => (int) $history->sum(fn (DailyTaskCompletion $completion): int => $completion->photos->count()),
                'quality_control' => $report ? self::reportSummary($report) : null,
                'qc_open' => $task->requires_quality_control
                    && $status === DailyTaskCompletion::STATUS_COMPLETED
                    && ! $passed,
            ];
        })->values();
    }

    /**
     * @param  Collection<int, int>  $scheduleIds
     * @return Collection<int, DailyTaskCompletion>
     */
    private static function completions(Collection $scheduleIds): Collection
    {
        return DailyTaskCompletion::query()
            ->with(['photos', 'performers', 'task:id,title'])
            ->whereIn('employee_work_schedule_id', $scheduleIds)
            ->orderBy('work_date')
            ->orderBy('id')
            ->get();
    }

    /**
     * @param  Collection<int, int>  $scheduleIds
     * @return Collection<int, QualityControlReport>
     */
    private static function reports(Collection $scheduleIds): Collection
    {
        return QualityControlReport::query()
            ->with('inspector:id,name')
            ->whereIn('employee_work_schedule_id', $scheduleIds)
            ->orderBy('inspected_on')
            ->orderBy('id')
            ->get();
    }
}
