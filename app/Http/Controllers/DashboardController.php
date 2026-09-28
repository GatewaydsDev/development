<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Admin\ProjectController;
use App\Models\Project;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, ProjectController $projectController): Response
    {
        $user = $request->user();
        $canViewProjects = $user && ProjectAccess::canView($user);

        $search = (string) $request->query('search', '');
        $status = (int) $request->query('status', 0);
        $highlight = (int) $request->query('highlight', 0);

        $projects = null;
        $options = null;
        $stats = [
            'totalProjects' => Project::query()->count(),
            'activeProjects' => Project::query()
                ->whereHas('status', fn ($q) => $q->whereNotIn('slug', ['completed', 'cancelled']))
                ->count(),
        ];

        if ($canViewProjects) {
            $options = $projectController->options($user);
            $projects = $projectController->projectListingQuery($request)
                ->when($highlight > 0, function ($query) use ($highlight): void {
                    $query->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$highlight]);
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Project $project): array => $projectController->projectPayload($project, $user, summary: true));
        }

        return Inertia::render('Dashboard', [
            'filters' => [
                'search' => $search,
                'status' => $status > 0 ? (string) $status : '',
                'highlight' => $highlight > 0 ? $highlight : null,
            ],
            'options' => $options,
            'projects' => $projects,
            'stats' => $stats,
        ]);
    }
}
