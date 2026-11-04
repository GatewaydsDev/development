<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmployeeWorkSchedule;
use App\Models\Project;
use App\Models\User;
use App\Support\EmployeeAccess;
use App\Support\ProjectProgress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Job progress for the projects a foreman is scheduled on.
 */
class ForemanJobProgressController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && EmployeeAccess::isForeman($user), 404);

        $projectIds = EmployeeWorkSchedule::query()
            ->where('foreman_user_id', $user->id)
            ->whereNotNull('project_id')
            ->pluck('project_id')
            ->unique();

        $projects = Project::query()
            ->whereIn('id', $projectIds)
            ->orderBy('name')
            ->get()
            ->map(function (Project $project): array {
                $progress = ProjectProgress::for($project);

                return [
                    'uuid' => $project->uuid,
                    'project_number' => $project->project_number,
                    'name' => $project->name,
                    'overall_progress' => $progress['overall_progress'],
                    'tasks_total' => $progress['tasks_total'],
                    'tasks_done' => $progress['tasks_done'],
                    'is_working_today' => $progress['is_working_today'],
                    'tasks' => $progress['tasks'],
                ];
            })
            ->sortByDesc('is_working_today')
            ->values();

        return response()->json(['data' => $projects]);
    }
}
