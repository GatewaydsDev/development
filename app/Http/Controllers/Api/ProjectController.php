<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Admin\ProjectController as AdminProjectController;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\User;
use App\Support\ProjectAccess;
use App\Support\ProjectDocument;
use App\Support\ProjectListVersion;
use App\Support\UserPrivileges;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizeProject($request, 'view-projects');
        $perPage = min(100, max(1, $request->integer('per_page', 15)));

        $projects = $this->admin()->projectListingQuery($request)
            ->latest()
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (Project $project): array => $this->admin()->projectPayload($project, $user, summary: true));

        return response()->json([
            'data' => $projects->items(),
            'meta' => [
                'current_page' => $projects->currentPage(),
                'from' => $projects->firstItem(),
                'last_page' => $projects->lastPage(),
                'per_page' => $projects->perPage(),
                'to' => $projects->lastItem(),
                'total' => $projects->total(),
                'version' => ProjectListVersion::current(),
            ],
            'can' => $this->capabilities($user),
        ]);
    }

    public function version(Request $request): JsonResponse
    {
        $this->authorizeProject($request, 'view-projects');

        return response()->json([
            'version' => ProjectListVersion::current(),
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $user = $this->authorizeProject($request, 'view-projects');

        return response()->json([
            'options' => $this->admin()->options($user),
            'can' => $this->capabilities($user),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeProject($request, 'create-projects');
        $validated = $this->admin()->validatedProject($request);

        $project = DB::transaction(function () use ($request, $user, $validated): Project {
            $project = Project::create([
                ...$this->admin()->projectAttributes($request, $validated),
                'created_by' => $user->id,
            ]);

            $this->admin()->syncProjectRelations($request, $project, $validated);

            return $project;
        });

        return response()->json([
            'project' => $this->projectPayload($project, $user),
            'can' => $this->capabilities($user),
        ], 201);
    }

    public function show(Request $request, string $project): JsonResponse
    {
        $project = $this->findProject($project);
        $user = $this->authorizeProject($request, 'view-projects');

        return response()->json([
            'project' => $this->projectPayload($project, $user),
            'can' => $this->capabilities($user),
        ]);
    }

    public function exportPdf(Request $request, string $project): Response
    {
        $project = $this->findProject($project);
        $user = $this->authorizeProject($request, 'view-projects');

        return ProjectDocument::for($project, $user)->pdfResponse();
    }

    public function exportWord(Request $request, string $project): BinaryFileResponse
    {
        $project = $this->findProject($project);
        $user = $this->authorizeProject($request, 'view-projects');

        return ProjectDocument::for($project, $user)->wordResponse();
    }

    public function update(Request $request, string $project): JsonResponse
    {
        $project = $this->findProject($project);
        $user = $this->authorizeProject($request, 'update-projects');
        $validated = $this->admin()->validatedProject($request, $project);

        DB::transaction(function () use ($request, $project, $validated): void {
            $project->fill($this->admin()->projectAttributes($request, $validated));
            $project->save();

            $this->admin()->syncProjectRelations($request, $project, $validated);
        });

        $project->refresh();

        return response()->json([
            'project' => $this->projectPayload($project, $user),
            'can' => $this->capabilities($user),
        ]);
    }

    public function destroy(Request $request, string $project): JsonResponse
    {
        $project = $this->findProject($project);
        $this->authorizeProject($request, 'delete-projects');

        $project->delete();

        return response()->json([
            'message' => 'Project removed.',
        ]);
    }

    private function findProject(string $value): Project
    {
        $project = Str::isUuid($value)
            ? Project::query()->where('uuid', $value)->first()
            : (ctype_digit($value) ? Project::query()->find($value) : null);

        abort_unless($project instanceof Project, 404);

        return $project;
    }

    private function authorizeProject(Request $request, string $permission): User
    {
        $user = $request->user();

        abort_unless($user instanceof User && UserPrivileges::allows($user, $permission), 403);

        return $user;
    }

    /**
     * @return array<string, bool>
     */
    private function capabilities(User $user): array
    {
        return [
            'view' => UserPrivileges::allows($user, 'view-projects'),
            'create' => UserPrivileges::allows($user, 'create-projects'),
            'update' => UserPrivileges::allows($user, 'update-projects'),
            'delete' => UserPrivileges::allows($user, 'delete-projects'),
            'viewSensitiveFields' => ProjectAccess::canViewSensitiveFields($user),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function projectPayload(Project $project, User $user): array
    {
        $project->load([
            'assignee:id,name',
            'creator:id,name',
            'contractors.contacts',
            'scopes.product',
            'scopes.service',
            'revisions.user:id,name',
            'status',
        ]);

        return $this->admin()->projectPayload($project, $user);
    }

    private function admin(): AdminProjectController
    {
        return app(AdminProjectController::class);
    }
}
