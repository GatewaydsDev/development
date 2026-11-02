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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ForemanDailyTaskController extends Controller
{
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

        $photo->delete();

        return response()->json(['message' => 'Photo removed.']);
    }

    private function foreman(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && DailyTaskAccess::mustComplete($user), 403);

        return $user;
    }
}
