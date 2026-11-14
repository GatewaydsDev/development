<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Admin\DailyTaskController as AdminDailyTaskController;
use App\Http\Controllers\Controller;
use App\Models\DailyTask;
use App\Models\DailyTaskPhoto;
use App\Models\EmployeeWorkSchedule;
use App\Models\User;
use App\Support\DailyTaskAccess;
use App\Support\DailyTaskChecklist;
use App\Support\DailyTaskProgressRules;
use App\Support\JobProgressRealtime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ForemanDailyTaskController extends Controller
{
    public function store(Request $request, EmployeeWorkSchedule $schedule): JsonResponse
    {
        $user = $this->foreman($request);
        abort_unless(DailyTaskAccess::canCreateForSchedule($user, $schedule, mobile: true), 403);

        $data = $this->definitionData($request);
        $this->ensureUniqueOnSchedule($schedule, $data['title']);

        $task = DailyTask::create([
            ...$data,
            'is_active' => true,
            'foreman_user_id' => $user->id,
            'sort_order' => (int) DailyTask::query()->max('sort_order') + 1,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);
        $schedule->dailyTasks()->attach($task->id);

        JobProgressRealtime::changed($schedule, 'task');

        return response()->json(['task' => $this->definitionPayload($task)], 201);
    }

    public function updateDefinition(
        Request $request,
        EmployeeWorkSchedule $schedule,
        DailyTask $dailyTask,
    ): JsonResponse {
        $user = $this->foreman($request);
        abort_unless(
            DailyTaskAccess::canUpdateForSchedule($user, $schedule, $dailyTask, mobile: true),
            403,
        );

        $data = $this->definitionData($request);
        $this->ensureUniqueOnSchedule($schedule, $data['title'], $dailyTask);
        $dailyTask->update([...$data, 'updated_by' => $user->id]);

        JobProgressRealtime::changed($schedule, 'task');

        return response()->json(['task' => $this->definitionPayload($dailyTask->fresh())]);
    }

    public function destroyDefinition(
        Request $request,
        EmployeeWorkSchedule $schedule,
        DailyTask $dailyTask,
    ): JsonResponse {
        $user = $this->foreman($request);
        abort_unless(
            DailyTaskAccess::canDeleteForSchedule($user, $schedule, $dailyTask, mobile: true),
            403,
        );

        $dailyTask->forceFill([
            'updated_by' => $user->id,
            'is_active' => $dailyTask->schedules()->count() > 1,
        ])->save();
        $schedule->dailyTasks()->detach($dailyTask->id);

        JobProgressRealtime::changed($schedule, 'task');

        return response()->json(['message' => 'Task removed from the work schedule.']);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->foreman($request);
        $today = now()->toDateString();

        $tasks = DailyTaskChecklist::entries($user, $today)
            ->map(fn (array $entry): array => DailyTaskChecklist::payload($user, $entry, 'api.daily-task-photos.show'))
            ->all();

        return response()->json([
            'date' => $today,
            'pending' => collect($tasks)->where('completed', false)->count(),
            'tasks' => $tasks,
        ]);
    }

    public function progress(Request $request, DailyTask $dailyTask): JsonResponse
    {
        $user = $this->foreman($request);
        $data = $request->validate(DailyTaskProgressRules::rules());
        $today = now()->toDateString();

        $schedule = isset($data['schedule_uuid'])
            ? EmployeeWorkSchedule::query()->where('uuid', $data['schedule_uuid'])->firstOrFail()
            : null;

        $entry = DailyTaskChecklist::find($user, $today, $dailyTask, $schedule);
        abort_if($entry === null, 403, 'This task is not on your checklist today.');

        $completion = DailyTaskChecklist::record($user, $today, $dailyTask, $schedule, $data, $request->file('photos', []));
        $entry['completion'] = $completion;

        return response()->json([
            'task' => DailyTaskChecklist::payload($user, $entry, 'api.daily-task-photos.show'),
            'pending' => DailyTaskChecklist::pendingCount($user, $today),
        ]);
    }

    public function photo(Request $request, DailyTaskPhoto $photo): StreamedResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        return app(AdminDailyTaskController::class)->photoResponse($user, $photo);
    }

    public function destroyPhoto(Request $request, DailyTaskPhoto $photo): JsonResponse
    {
        $user = $this->foreman($request);
        abort_unless($photo->completion->user_id === $user->id, 403);

        $schedule = $photo->completion->schedule;
        $photo->delete();

        if ($schedule !== null) {
            JobProgressRealtime::changed($schedule, 'task');
        }

        return response()->json(['message' => 'Photo removed.']);
    }

    private function foreman(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && DailyTaskAccess::mustComplete($user), 403);

        return $user;
    }

    /**
     * @return array{title: string, description: ?string, performed_by: string, requires_photo: bool, requires_quality_control: bool}
     */
    private function definitionData(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'performed_by' => ['required', Rule::in(array_keys(DailyTask::PERFORMERS))],
            'requires_photo' => ['required', 'boolean'],
            'requires_quality_control' => ['required', 'boolean'],
        ]);
    }

    private function ensureUniqueOnSchedule(
        EmployeeWorkSchedule $schedule,
        string $title,
        ?DailyTask $except = null,
    ): void {
        $duplicate = $schedule->dailyTasks()
            ->when($except, fn ($query) => $query->where('daily_tasks.id', '!=', $except->id))
            ->whereRaw('LOWER(title) = ?', [mb_strtolower(trim($title))])
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'title' => 'This work schedule already has a task with that title.',
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function definitionPayload(DailyTask $task): array
    {
        $task->loadMissing(['creator:id,name', 'updater:id,name']);

        return [
            'uuid' => $task->uuid,
            'title' => $task->title,
            'description' => $task->description,
            'performed_by' => $task->performed_by,
            'performed_by_label' => DailyTask::PERFORMERS[$task->performed_by] ?? $task->performed_by,
            'requires_photo' => (bool) $task->requires_photo,
            'requires_quality_control' => (bool) $task->requires_quality_control,
            'created_by' => $task->creator?->only(['id', 'name']),
            'updated_by' => $task->updater?->only(['id', 'name']),
            'created_at' => $task->created_at?->toIso8601String(),
            'updated_at' => $task->updated_at?->toIso8601String(),
        ];
    }
}
