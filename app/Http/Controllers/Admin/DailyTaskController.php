<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DailyTask;
use App\Models\DailyTaskTitle;
use App\Models\DailyTaskCompletion;
use App\Models\Employee;
use App\Models\User;
use App\Models\UserLevel;
use App\Models\DailyTaskPhoto;
use App\Models\EmployeeWorkSchedule;
use App\Support\DailyTaskAccess;
use App\Support\DailyTaskChecklist;
use App\Support\DailyTaskProgressRules;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DailyTaskController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->actor($request);
        abort_unless(DailyTaskAccess::canOpen($user), 403);

        $canManage = DailyTaskAccess::canManage($user);
        $today = now()->toDateString();
        $date = $canManage ? $this->dateQuery($request->query('date')) ?? $today : $today;

        $props = [
            'can' => [
                'manage' => $canManage,
                'complete' => DailyTaskAccess::mustComplete($user),
            ],
            'date' => $date,
            'today' => $today,
        ];

        if ($canManage) {
            $props['tasks'] = DailyTask::query()->withCount('schedules')->ordered()->get()
                ->map(fn (DailyTask $task): array => $this->taskPayload($task))
                ->all();
            $props['taskTitles'] = DailyTaskTitle::query()->orderBy('name')->get(['id', 'name'])->all();
            $props['compliance'] = $this->compliance($date);
        }

        if (DailyTaskAccess::mustComplete($user)) {
            $props['checklist'] = DailyTaskChecklist::entries($user, $today)
                ->map(fn (array $entry): array => DailyTaskChecklist::payload($user, $entry, 'admin.daily-task-photos.show'))
                ->all();
        }

        return Inertia::render('Admin/DailyTasks/Index', $props);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->manager($request);
        $data = $this->validated($request);
        $existing = $this->duplicateOf($data);

        if ($existing && $request->has('name') && ! $request->has('daily_task_title_id')) {
            return back()->with('success', 'That task already exists and can be reused.');
        }

        $this->rejectDuplicate($existing);

        $task = DailyTask::create([
            ...collect($data)->filter(fn ($value, $key) => $key !== 'title' || $value !== null)->all(),
            'sort_order' => (int) DailyTask::query()->max('sort_order') + 1,
            'created_by' => $user->id,
        ]);

        return back()->with('success', 'Daily task added.');
    }

    public function update(Request $request, DailyTask $dailyTask): RedirectResponse
    {
        $this->manager($request);

        $data = $this->validated($request);
        $this->rejectDuplicate($this->duplicateOf($data, $dailyTask));

        $dailyTask->update(collect($data)->filter(fn ($value, $key) => $key !== 'title' || $value !== null)->all());

        return back()->with('success', 'Daily task updated.');
    }

    public function destroy(Request $request, DailyTask $dailyTask): RedirectResponse
    {
        $this->manager($request);

        $dailyTask->delete();

        return back()->with('success', 'Daily task deleted.');
    }

    public function complete(Request $request, DailyTask $dailyTask): RedirectResponse
    {
        $user = $this->actor($request);
        abort_unless(DailyTaskAccess::mustComplete($user), 403);

        $data = $request->validate(['completed' => ['required', 'boolean']]);

        return $this->saveProgress($request, $user, $dailyTask, null, [
            'status' => $data['completed']
                ? DailyTaskCompletion::STATUS_COMPLETED
                : DailyTaskCompletion::STATUS_PENDING,
        ]);
    }

    public function progress(Request $request, DailyTask $dailyTask): RedirectResponse
    {
        $user = $this->actor($request);
        abort_unless(DailyTaskAccess::mustComplete($user), 403);

        $data = $request->validate(DailyTaskProgressRules::rules());
        $schedule = isset($data['schedule_uuid'])
            ? EmployeeWorkSchedule::query()->where('uuid', $data['schedule_uuid'])->first()
            : null;
        abort_if(isset($data['schedule_uuid']) && ! $schedule, 404);

        return $this->saveProgress($request, $user, $dailyTask, $schedule, $data);
    }

    public function photo(Request $request, DailyTaskPhoto $photo): StreamedResponse
    {
        return $this->photoResponse($this->actor($request), $photo);
    }

    public function destroyPhoto(Request $request, DailyTaskPhoto $photo): RedirectResponse
    {
        $user = $this->actor($request);
        abort_unless($photo->completion->user_id === $user->id || DailyTaskAccess::canManage($user), 403);

        $photo->delete();

        return back();
    }

    public function photoResponse(User $user, DailyTaskPhoto $photo): StreamedResponse
    {
        abort_unless($photo->completion->user_id === $user->id || DailyTaskAccess::canManage($user), 403);
        abort_unless(Storage::disk('local')->exists($photo->path), 404);

        return Storage::disk('local')->response($photo->path, $photo->original_name, [
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    private function saveProgress(
        Request $request,
        User $user,
        DailyTask $task,
        ?EmployeeWorkSchedule $schedule,
        array $data,
    ): RedirectResponse {
        $today = now()->toDateString();
        abort_unless(DailyTaskChecklist::find($user, $today, $task, $schedule) !== null, 403);

        DailyTaskChecklist::record($user, $today, $task, $schedule, $data, $request->file('photos', []));

        return back();
    }

    /**
     * @return array{id: int, name: string, completed: int, total: int, last_completed_at: ?string}[]
     */
    private function compliance(string $date): array
    {
        return User::query()
            ->whereHas('level', fn ($query) => $query->where('name', UserLevel::FOREMAN))
            ->orderBy('name')
            ->get()
            ->map(function (User $foreman) use ($date): array {
                $entries = DailyTaskChecklist::entries($foreman, $date);
                $done = $entries->filter(
                    fn (array $entry): bool => $entry['completion']?->status === DailyTaskCompletion::STATUS_COMPLETED,
                );

                return [
                    'id' => $foreman->id,
                    'name' => $foreman->name,
                    'completed' => $done->count(),
                    'in_progress' => $entries->filter(
                        fn (array $entry): bool => $entry['completion']?->status === DailyTaskCompletion::STATUS_IN_PROGRESS,
                    )->count(),
                    'blocked' => $entries->filter(
                        fn (array $entry): bool => $entry['completion']?->status === DailyTaskCompletion::STATUS_BLOCKED,
                    )->count(),
                    'photos' => $entries->sum(fn (array $entry): int => $entry['completion']?->photos->count() ?? 0),
                    'total' => $entries->count(),
                    'last_completed_at' => $done->map(fn (array $entry) => $entry['completion']->completed_at)->max()?->toIso8601String(),
                ];
            })
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * A task with the same title already exists (active or not), so it would repeat on the daily checklist.
     *
     * @param  array<string, mixed>  $data
     */
    private function duplicateOf(array $data, ?DailyTask $ignore = null): ?DailyTask
    {
        $titleId = $data['daily_task_title_id']
            ?? DailyTaskTitle::query()->whereRaw('lower(name) = ?', [mb_strtolower(trim((string) ($data['title'] ?? '')))])->value('id');

        if (! $titleId) {
            return null;
        }

        return DailyTask::query()
            ->where('daily_task_title_id', $titleId)
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))
            ->first();
    }

    private function rejectDuplicate(?DailyTask $existing): void
    {
        if ($existing) {
            throw ValidationException::withMessages([
                'daily_task_title_id' => 'This task already exists. Reuse it on the work schedule or edit it instead.',
            ]);
        }
    }

    private function taskPayload(DailyTask $task): array
    {
        return [
            'uuid' => $task->uuid,
            'title' => $task->title,
            'daily_task_title_id' => $task->daily_task_title_id,
            'description' => $task->description,
            'is_active' => $task->is_active,
            'requires_photo' => $task->requires_photo,
            'requires_quality_control' => $task->requires_quality_control,
            'performed_by' => $task->performed_by,
            'performed_by_label' => DailyTask::PERFORMERS[$task->performed_by] ?? DailyTask::PERFORMERS[DailyTask::PERFORMER_ANYONE],
            'foreman_user_id' => $task->foreman_user_id,
            'schedule_count' => $task->schedules_count ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $request->merge(['title' => $request->input('title') ?: $request->input('name')]);

        return $request->validate([
            'daily_task_title_id' => ['nullable', 'integer', Rule::exists(DailyTaskTitle::class, 'id')],
            'title' => ['required_without:daily_task_title_id', 'nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['required', 'boolean'],
            'requires_photo' => ['sometimes', 'boolean'],
            'requires_quality_control' => ['sometimes', 'boolean'],
            'performed_by' => ['sometimes', Rule::in(array_keys(DailyTask::PERFORMERS))],
        ]);
    }

    private function dateQuery(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1
            && strtotime($value) !== false
            ? $value
            : null;
    }

    private function actor(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        return $user;
    }

    private function manager(Request $request): User
    {
        $user = $this->actor($request);
        abort_unless(DailyTaskAccess::canManage($user), 403);

        return $user;
    }
}
