<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyTaskPhoto;
use App\Models\Project;
use App\Models\User;
use App\Support\ClientPortalAccess;
use App\Support\ProjectProgress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Read-only, client-safe project data for the mobile app.
 */
class ClientPortalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->client($request);

        $projects = ClientPortalAccess::projects($user)
            ->with('status:id,name,slug')
            ->orderBy('name')
            ->get()
            ->map(function (Project $project): array {
                $progress = ProjectProgress::for($project);

                return [
                    ...$this->summary($project),
                    'overall_progress' => $progress['overall_progress'],
                    'is_working_today' => $progress['is_working_today'],
                ];
            })
            ->values();

        $company = ClientPortalAccess::company($user);

        return response()->json([
            'company' => $company ? ['uuid' => $company->uuid, 'name' => $company->name] : null,
            'data' => $projects,
        ]);
    }

    public function show(Request $request, Project $project): JsonResponse
    {
        $user = $this->client($request);
        abort_unless(ClientPortalAccess::canViewProject($user, $project), 404);

        $project->load('status:id,name,slug');
        $progress = ProjectProgress::for($project);

        return response()->json([
            'project' => [
                ...$this->summary($project),
                'estimated_start_date' => $project->estimated_start_date?->toDateString(),
                'estimated_end_date' => $project->estimated_end_date?->toDateString(),
                'public_notes' => $project->public_notes,
            ],
            'progress' => $progress,
        ]);
    }

    public function photo(Request $request, DailyTaskPhoto $photo): StreamedResponse
    {
        $user = $this->client($request);
        $project = $photo->completion?->schedule?->project;

        abort_unless($project && ClientPortalAccess::canViewProject($user, $project), 404);
        abort_unless(Storage::disk('local')->exists($photo->path), 404);

        return Storage::disk('local')->response($photo->path, $photo->original_name, [
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    private function client(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && ClientPortalAccess::canOpen($user), 403);

        return $user;
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Project $project): array
    {
        return [
            'uuid' => $project->uuid,
            'project_number' => $project->project_number,
            'name' => $project->name,
            'status' => $project->status?->name,
            'address' => collect([
                $project->site_address_line_1,
                $project->site_city,
                $project->site_state,
            ])->filter()->implode(', ') ?: null,
        ];
    }
}
