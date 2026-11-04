<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DailyTask;
use App\Models\DailyTaskCompletion;
use App\Models\DailyTaskPhoto;
use App\Models\Employee;
use App\Models\EmployeePayRate;
use App\Models\EmployeeWorkSchedule;
use App\Models\QualityControlReport;
use App\Models\User;
use App\Support\CrewAssignments;
use App\Support\JobProgress;
use App\Support\JobProgressAccess;
use App\Support\ScheduleAttendance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class JobProgressController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->actor($request);
        $status = $request->query('status', EmployeeWorkSchedule::STATUS_ACTIVE);
        $status = $status === 'all' || array_key_exists($status, EmployeeWorkSchedule::STATUSES)
            ? $status
            : EmployeeWorkSchedule::STATUS_ACTIVE;

        $schedules = JobProgressAccess::visibleTo($user, EmployeeWorkSchedule::query())
            ->with([
                'project:id,uuid,name,project_number',
                'foreman:id,name',
                'dailyTasks' => fn ($query) => $query->active()->ordered(),
            ])
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            ->orderByDesc('starts_on')
            ->orderByDesc('id')
            ->get();

        $summaries = JobProgress::summaries($schedules);

        return Inertia::render('Admin/JobProgress/Index', [
            'status' => $status,
            'statuses' => EmployeeWorkSchedule::STATUSES,
            'jobs' => $schedules->map(fn (EmployeeWorkSchedule $schedule): array => [
                ...$this->schedulePayload($schedule),
                'summary' => $summaries[$schedule->id],
            ])->all(),
        ]);
    }

    public function show(Request $request, EmployeeWorkSchedule $schedule): Response
    {
        $user = $this->actor($request);
        abort_unless(JobProgressAccess::canView($user, $schedule), 403);

        $schedule->load([
            'project:id,uuid,name,project_number',
            'foreman:id,name',
            'competentPerson:id,first_name,last_name',
            'qualityControl:id,first_name,last_name',
        ]);

        $queried = $request->query('date');
        $date = is_string($queried) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $queried) === 1 && strtotime($queried) !== false
            ? $queried
            : now()->toDateString();

        $progress = JobProgress::detail($schedule, $date, 'admin.daily-task-photos.show');

        if (! JobProgressAccess::canViewAll($user)) {
            $progress['payroll'] = ScheduleAttendance::withoutPay($progress['payroll']);
        }

        return Inertia::render('Admin/JobProgress/Show', [
            'job' => [
                ...$this->schedulePayload($schedule),
                'competent_person' => $schedule->competentPerson?->fullName(),
                'quality_control' => $schedule->qualityControl?->fullName(),
                'notes' => $schedule->notes,
            ],
            'date' => $date,
            'today' => now()->toDateString(),
            'progress' => $progress,
            'canSeePay' => JobProgressAccess::canViewAll($user),
            'can' => [
                'inspect' => JobProgressAccess::canInspect($user, $schedule),
                'update' => JobProgressAccess::canUpdateProgress($user, $schedule),
            ],
            'statuses' => DailyTaskCompletion::STATUSES,
            'checklist' => QualityControlReport::CHECKLIST,
            'results' => QualityControlReport::RESULTS,
        ]);
    }

    public function storeReport(Request $request, EmployeeWorkSchedule $schedule, DailyTask $dailyTask): RedirectResponse
    {
        $user = $this->actor($request);
        abort_unless(JobProgressAccess::canInspect($user, $schedule), 403);
        abort_unless($schedule->dailyTasks()->whereKey($dailyTask->id)->exists(), 404);

        $keys = array_keys(QualityControlReport::CHECKLIST);
        $data = $request->validate([
            'result' => ['required', Rule::in(array_keys(QualityControlReport::RESULTS))],
            'inspected_on' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'checklist' => ['required', 'array'],
            'checklist.*' => ['required', Rule::in(QualityControlReport::ANSWERS)],
            'fail_reasons' => ['nullable', 'array'],
            'fail_reasons.*' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'corrective_action' => ['nullable', 'string', 'max:3000'],
        ]);

        $checklist = collect($keys)->mapWithKeys(fn (string $key): array => [$key => $data['checklist'][$key] ?? QualityControlReport::ANSWER_NA])->all();

        $reasons = [];

        foreach ($checklist as $key => $answer) {
            if ($answer !== QualityControlReport::ANSWER_FAIL) {
                continue;
            }

            $reason = trim((string) ($data['fail_reasons'][$key] ?? ''));

            if ($reason === '') {
                throw ValidationException::withMessages(["fail_reasons.{$key}" => 'Add the reason this check failed.']);
            }

            $reasons[$key] = $reason;
        }

        if ($data['result'] === QualityControlReport::RESULT_PASSED && in_array(QualityControlReport::ANSWER_FAIL, $checklist, true)) {
            throw ValidationException::withMessages(['result' => 'A report with failed checks cannot be marked as passed.']);
        }

        if ($data['result'] !== QualityControlReport::RESULT_PASSED && trim((string) ($data['corrective_action'] ?? '')) === '') {
            throw ValidationException::withMessages(['corrective_action' => 'Describe the corrective action needed.']);
        }

        $inspectedOn = $data['inspected_on'] ?? now()->toDateString();

        QualityControlReport::create([
            'employee_work_schedule_id' => $schedule->id,
            'daily_task_id' => $dailyTask->id,
            'daily_task_completion_id' => DailyTaskCompletion::query()
                ->where('employee_work_schedule_id', $schedule->id)
                ->where('daily_task_id', $dailyTask->id)
                ->latest('work_date')->latest('id')->value('id'),
            'inspector_user_id' => $user->id,
            'inspected_on' => $inspectedOn,
            'result' => $data['result'],
            'checklist' => $checklist,
            'fail_reasons' => $reasons ?: null,
            'notes' => $data['notes'] ?? null,
            'corrective_action' => $data['result'] === QualityControlReport::RESULT_PASSED ? null : $data['corrective_action'],
        ]);

        return back()->with('success', 'Quality control report saved.');
    }

    public function setAttendance(Request $request, EmployeeWorkSchedule $schedule): RedirectResponse
    {
        $user = $this->actor($request);
        abort_unless(JobProgressAccess::canUpdateProgress($user, $schedule), 403);

        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'employee_uuid' => ['required', 'string'],
            'present' => ['required', 'boolean'],
            'hours' => ['nullable', 'numeric', 'min:0.01', 'max:24'],
        ]);

        if ($data['date'] < $schedule->starts_on->toDateString() || $data['date'] > $schedule->ends_on->toDateString()) {
            throw ValidationException::withMessages(['date' => 'Choose a day inside this schedule.']);
        }

        $errors = ScheduleAttendance::record($schedule, $data['date'], [[
            'employee_uuid' => $data['employee_uuid'],
            'present' => (bool) $data['present'],
            'hours' => $data['hours'] ?? null,
        ]]);

        if ($errors !== []) {
            throw ValidationException::withMessages(['hours' => reset($errors)]);
        }

        return back()->with('success', 'Attendance saved.');
    }

    public function updateCrew(Request $request, EmployeeWorkSchedule $schedule, Employee $employee): RedirectResponse
    {
        $user = $this->actor($request);
        abort_unless(JobProgressAccess::canUpdateProgress($user, $schedule), 403);
        abort_unless(ScheduleAttendance::members($schedule)->contains('id', $employee->id), 404);

        $data = $request->validate([
            'skill_id' => ['nullable', 'integer'],
            'employee_pay_rate_id' => ['nullable', 'integer'],
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $assignment = CrewAssignments::resolve($employee, $data['skill_id'] ?? null, $data['employee_pay_rate_id'] ?? null);

        if ($assignment === null) {
            throw ValidationException::withMessages(['employee_pay_rate_id' => 'Choose a skill and rate that belong to this employee.']);
        }

        $schedule->employees()->syncWithoutDetaching([$employee->id => $assignment]);

        $rate = $assignment['employee_pay_rate_id'] ? EmployeePayRate::query()->find($assignment['employee_pay_rate_id']) : null;
        $day = $rate ? \App\Models\EmployeeAttendanceDay::query()
            ->where('employee_work_schedule_id', $schedule->id)
            ->whereDate('work_date', $data['date'] ?? now()->toDateString())
            ->whereHas('week', fn ($query) => $query->where('employee_id', $employee->id))
            ->first() : null;

        $day?->update([
            'skill_id' => $rate->skill_id,
            'profession_id' => $rate->profession_id,
            'employee_pay_rate_id' => $rate->id,
            'rate_type' => $rate->rate_type,
            'custom_rate_type' => $rate->rate_type === EmployeePayRate::RATE_CUSTOM ? $rate->custom_rate_type : null,
            'amount' => $rate->amount,
            'hours' => $day->hours ?? ScheduleAttendance::DEFAULT_HOURS,
        ]);

        return back()->with('success', 'Crew rate updated.');
    }

    public function updateTask(Request $request, EmployeeWorkSchedule $schedule, DailyTask $dailyTask): RedirectResponse
    {
        $user = $this->actor($request);
        abort_unless(JobProgressAccess::canUpdateProgress($user, $schedule), 403);
        abort_unless($schedule->dailyTasks()->whereKey($dailyTask->id)->exists(), 404);

        $data = $request->validate([
            'status' => ['required', Rule::in(array_keys(DailyTaskCompletion::STATUSES))],
            'progress' => ['nullable', 'integer', 'between:0,100'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'photos' => ['nullable', 'array', 'max:10'],
            'photos.*' => ['image', 'max:15360'],
        ]);

        $today = now()->toDateString();
        $photos = $request->file('photos', []);
        $completion = DailyTaskCompletion::query()
            ->where('daily_task_id', $dailyTask->id)
            ->where('employee_work_schedule_id', $schedule->id)
            ->whereDate('work_date', $today)
            ->latest('id')
            ->first();

        if ($data['status'] === DailyTaskCompletion::STATUS_COMPLETED && $dailyTask->requires_photo) {
            $hasPhoto = DailyTaskPhoto::query()->whereHas('completion', fn ($query) => $query
                ->where('daily_task_id', $dailyTask->id)
                ->where('employee_work_schedule_id', $schedule->id))->exists();

            if (! $hasPhoto && $photos === []) {
                throw ValidationException::withMessages(['photos' => 'This task needs at least one photo before it can be completed.']);
            }
        }

        $progress = match ($data['status']) {
            DailyTaskCompletion::STATUS_COMPLETED => 100,
            DailyTaskCompletion::STATUS_PENDING => 0,
            default => (int) ($data['progress'] ?? $completion?->progress ?? 0),
        };

        $completion ??= new DailyTaskCompletion([
            'daily_task_id' => $dailyTask->id,
            'employee_work_schedule_id' => $schedule->id,
            'user_id' => $user->id,
            'work_date' => $today,
        ]);

        $wasCompleted = $completion->status === DailyTaskCompletion::STATUS_COMPLETED && $completion->completed_at;

        $completion->fill([
            'status' => $data['status'],
            'progress' => $progress,
            'notes' => array_key_exists('notes', $data) ? ($data['notes'] ?: null) : $completion->notes,
            'completed_at' => $data['status'] === DailyTaskCompletion::STATUS_COMPLETED
                ? ($wasCompleted ? $completion->completed_at : now())
                : null,
        ])->save();

        foreach ($photos as $file) {
            $completion->photos()->create([
                'path' => $file->store("daily-tasks/{$today}", 'local'),
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize() ?: 0,
                'taken_at' => now(),
            ]);
        }

        return back()->with('success', 'Task progress updated.');
    }

    public function report(Request $request, QualityControlReport $report): Response
    {
        $user = $this->actor($request);
        $schedule = $report->schedule()->with([
            'project:id,uuid,name,project_number',
            'foreman:id,name',
            'qualityControl:id,first_name,last_name',
        ])->firstOrFail();
        abort_unless(JobProgressAccess::canView($user, $schedule), 403);

        return Inertia::render('Admin/JobProgress/Report', [
            'job' => $this->schedulePayload($schedule),
            'report' => [
                ...JobProgress::reportSummary($report->load('inspector:id,name')),
                'task' => $report->task?->title,
                'notes' => $report->notes,
                'corrective_action' => $report->corrective_action,
                'quality_control' => $schedule->qualityControl?->fullName(),
                'checklist' => collect(QualityControlReport::CHECKLIST)
                    ->map(fn (string $label, string $key): array => [
                        'label' => $label,
                        'answer' => $report->checklist[$key] ?? QualityControlReport::ANSWER_NA,
                        'reason' => $report->fail_reasons[$key] ?? null,
                    ])->values()->all(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function schedulePayload(EmployeeWorkSchedule $schedule): array
    {
        return [
            'uuid' => $schedule->uuid,
            'status' => $schedule->status,
            'status_label' => EmployeeWorkSchedule::STATUSES[$schedule->status] ?? $schedule->status,
            'starts_on' => $schedule->starts_on?->toDateString(),
            'ends_on' => $schedule->ends_on?->toDateString(),
            'project' => $schedule->project ? [
                'uuid' => $schedule->project->uuid,
                'name' => $schedule->project->name,
                'project_number' => $schedule->project->project_number,
            ] : null,
            'foreman' => $schedule->foreman?->name,
        ];
    }

    private function actor(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && JobProgressAccess::canOpen($user), 403);

        return $user;
    }
}
