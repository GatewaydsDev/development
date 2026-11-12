<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyTask;
use App\Models\DailyTaskCompletion;
use App\Models\Employee;
use App\Models\EmployeeWorkSchedule;
use App\Models\QualityControlReport;
use App\Models\User;
use App\Support\DailyTaskAccess;
use App\Support\EmployeeAccess;
use App\Support\JobProgressAccess;
use App\Support\JobProgressRealtime;
use App\Support\QualityControlAssignments;
use App\Support\ScheduleAttendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Field actions for foremen: record today's crew attendance and file quality control reports.
 */
class ForemanFieldController extends Controller
{
    public function attendance(Request $request): JsonResponse
    {
        $user = $this->foreman($request);
        $today = now()->toDateString();

        return response()->json([
            'date' => $today,
            'schedules' => ScheduleAttendance::forForeman($user, $today),
        ]);
    }

    public function recordAttendance(Request $request, EmployeeWorkSchedule $schedule): JsonResponse
    {
        $user = $this->foreman($request);
        abort_unless((int) $schedule->foreman_user_id === (int) $user->id, 403);

        $today = now();
        abort_unless(
            ! $today->isSunday()
                && $schedule->status === EmployeeWorkSchedule::STATUS_ACTIVE
                && $schedule->starts_on->lte($today)
                && $schedule->ends_on->gte($today->copy()->startOfDay()),
            422,
            'This job is not scheduled for today.',
        );

        $data = $request->validate([
            'entries' => ['required', 'array'],
            'entries.*.employee_uuid' => ['required', 'string'],
            'entries.*.present' => ['required', 'boolean'],
            'entries.*.hours' => ['nullable', 'numeric', 'min:0.01', 'max:24'],
        ]);

        $errors = ScheduleAttendance::record($schedule, $today->toDateString(), $data['entries']);

        if ($errors !== []) {
            throw ValidationException::withMessages(['entries' => array_values($errors)]);
        }

        return response()->json(ScheduleAttendance::payload($schedule->fresh(), $today->toDateString()));
    }

    public function qualityControl(Request $request): JsonResponse
    {
        $user = $this->qualityUser($request);
        $employeeId = Employee::query()->where('user_id', $user->id)->value('id');
        $today = now()->toDateString();
        $canSend = QualityControlAssignments::canSend($user, mobile: true);

        $schedules = $employeeId === null
            ? collect()
            : EmployeeWorkSchedule::query()
                ->where('quality_control_employee_id', $employeeId)
                ->where('status', EmployeeWorkSchedule::STATUS_ACTIVE)
                ->whereDate('ends_on', '>=', $today)
                ->with(['project:id,uuid,name,project_number,client_company_id', 'dailyTasks' => fn ($query) => $query->where('requires_quality_control', true)])
                ->orderBy('starts_on')
                ->get();

        $items = $schedules->flatMap(function (EmployeeWorkSchedule $schedule) use ($canSend): array {
            return $schedule->dailyTasks->map(function (DailyTask $task) use ($schedule, $canSend): array {
                $completion = DailyTaskCompletion::query()
                    ->where('employee_work_schedule_id', $schedule->id)
                    ->where('daily_task_id', $task->id)
                    ->latest('work_date')->latest('id')->first();
                $report = QualityControlReport::query()
                    ->where('employee_work_schedule_id', $schedule->id)
                    ->where('daily_task_id', $task->id)
                    ->latest('inspected_on')->latest('id')->first();

                return [
                    'schedule_uuid' => $schedule->uuid,
                    'task_uuid' => $task->uuid,
                    'title' => $task->title,
                    'project' => $schedule->project?->only(['name', 'project_number']),
                    'status' => $completion?->status ?? DailyTaskCompletion::STATUS_PENDING,
                    'progress' => (int) ($completion?->progress ?? 0),
                    'last_report' => $report ? [
                        'result' => $report->result,
                        'result_label' => QualityControlReport::RESULTS[$report->result] ?? $report->result,
                        'inspected_on' => $report->inspected_on?->toDateString(),
                        'notes' => $report->notes,
                        'corrective_action' => $report->corrective_action,
                    ] : null,
                    'recipients' => $canSend
                        ? QualityControlAssignments::recipientPayload($schedule)
                        : [],
                ];
            })->all();
        })->values();

        return response()->json([
            'checklist' => QualityControlReport::CHECKLIST,
            'results' => QualityControlReport::RESULTS,
            'can_send_reports' => $canSend,
            'data' => $items,
        ]);
    }

    public function storeReport(Request $request, EmployeeWorkSchedule $schedule, DailyTask $dailyTask): JsonResponse
    {
        $user = $this->qualityUser($request);
        abort_unless(JobProgressAccess::canInspect($user, $schedule), 403);
        abort_unless($schedule->dailyTasks()->whereKey($dailyTask->id)->exists(), 404);

        $keys = array_keys(QualityControlReport::CHECKLIST);
        $data = $request->validate([
            'result' => ['required', Rule::in(array_keys(QualityControlReport::RESULTS))],
            'checklist' => ['required', 'array'],
            'checklist.*' => ['required', Rule::in(QualityControlReport::ANSWERS)],
            'fail_reasons' => ['nullable', 'array'],
            'fail_reasons.*' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'corrective_action' => ['nullable', 'string', 'max:3000'],
            'assigned_to_user_uuid' => ['nullable', 'string'],
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

        $recipientUuid = $data['assigned_to_user_uuid'] ?? null;

        if (filled($recipientUuid)) {
            abort_unless(QualityControlAssignments::canSend($user, mobile: true), 403);
        }

        $recipient = QualityControlAssignments::resolveRecipient($schedule, $recipientUuid);

        $report = QualityControlReport::create([
            'employee_work_schedule_id' => $schedule->id,
            'daily_task_id' => $dailyTask->id,
            'daily_task_completion_id' => DailyTaskCompletion::query()
                ->where('employee_work_schedule_id', $schedule->id)
                ->where('daily_task_id', $dailyTask->id)
                ->latest('work_date')->latest('id')->value('id'),
            'inspector_user_id' => $user->id,
            'assigned_to_user_id' => $recipient?->id,
            'assigned_at' => $recipient ? now() : null,
            'inspected_on' => now()->toDateString(),
            'result' => $data['result'],
            'checklist' => $checklist,
            'fail_reasons' => $reasons ?: null,
            'notes' => $data['notes'] ?? null,
            'corrective_action' => $data['result'] === QualityControlReport::RESULT_PASSED ? null : $data['corrective_action'],
        ]);

        JobProgressRealtime::changed($schedule, 'quality_control');

        return response()->json([
            'uuid' => $report->uuid,
            'result' => $report->result,
            'assigned_to' => $recipient?->only(['uuid', 'name', 'email']),
        ], 201);
    }

    private function foreman(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && EmployeeAccess::isForeman($user) && DailyTaskAccess::mustComplete($user), 403);

        return $user;
    }

    private function qualityUser(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && JobProgressAccess::canOpen($user), 403);

        return $user;
    }
}
