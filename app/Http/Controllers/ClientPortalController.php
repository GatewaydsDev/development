<?php

namespace App\Http\Controllers;

use App\Models\DailyTaskPhoto;
use App\Models\Project;
use App\Models\QualityControlReport;
use App\Models\User;
use App\Support\ClientPortalAccess;
use App\Support\ProjectProgress;
use App\Support\QualityControlAssignments;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClientPortalController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->client($request);

        $projects = ClientPortalAccess::projects($user)
            ->with('status:id,name,slug')
            ->orderBy('name')
            ->get()
            ->map(function (Project $project): array {
                $progress = ProjectProgress::for($project);

                return [
                    'uuid' => $project->uuid,
                    ...$this->summary($project),
                    'overall_progress' => $progress['overall_progress'],
                    'is_working_today' => $progress['is_working_today'],
                    'photos_count' => count($progress['photos']),
                ];
            })
            ->values()
            ->all();

        return Inertia::render('Portal/Index', [
            'company' => ClientPortalAccess::company($user)?->name,
            'canManageTeam' => ClientPortalAccess::canManageTeam($user),
            'projects' => $projects,
            'qualityReports' => QualityControlAssignments::assignedTo($user)
                ->map(fn (QualityControlReport $report): array => QualityControlAssignments::reportPayload($report))
                ->all(),
        ]);
    }

    public function show(Request $request, Project $project): Response
    {
        $user = $this->client($request);
        abort_unless(ClientPortalAccess::canViewProject($user, $project), 404);

        $project->load('status:id,name,slug');

        return Inertia::render('Portal/Show', [
            'project' => [
                'uuid' => $project->uuid,
                ...$this->summary($project),
                'estimated_start_date' => $project->estimated_start_date?->toDateString(),
                'estimated_end_date' => $project->estimated_end_date?->toDateString(),
                'public_notes' => $project->public_notes,
            ],
            'progress' => ProjectProgress::for($project),
            'canManageTeam' => ClientPortalAccess::canManageTeam($user),
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

    public function qualityReport(Request $request, QualityControlReport $report): Response
    {
        $user = $this->client($request);
        abort_unless((int) $report->assigned_to_user_id === (int) $user->id, 404);

        return Inertia::render('Portal/QualityReport', [
            'report' => QualityControlAssignments::reportPayload($report),
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
            'project_number' => $project->project_number,
            'name' => $project->name,
            'status' => $project->status?->name,
            'status_slug' => $project->status?->slug,
            'address' => collect([
                $project->site_address_line_1,
                $project->site_city,
                $project->site_state,
            ])->filter()->implode(', ') ?: null,
        ];
    }
}
