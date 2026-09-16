<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\Company;
use App\Models\Contractor;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectRevision;
use App\Models\ProjectScope;
use App\Models\ProjectScopeType;
use App\Models\ProjectStatus;
use App\Models\Service;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\BidAccess;
use App\Support\BidApplicationText;
use App\Support\PostalCode;
use App\Support\ProjectAccess;
use App\Support\ProjectDocument;
use App\Support\ProjectListDocument;
use App\Support\StateInitials;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProjectController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorizeProjectView($request);

        $search = (string) $request->query('search', '');
        $status = (int) $request->query('status', 0);
        $highlight = (int) $request->query('highlight', 0);
        $user = $request->user();

        return Inertia::render('Admin/Projects/Index', [
            'filters' => [
                'search' => $search,
                'status' => $status > 0 ? (string) $status : '',
                'highlight' => $highlight > 0 ? $highlight : null,
            ],
            'options' => $this->options($user),
            'projects' => $this->projectListingQuery($request)
                ->when($highlight > 0, function ($query) use ($highlight): void {
                    $query->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$highlight]);
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Project $project): array => $this->projectPayload($project, $user, summary: true)),
        ]);
    }

    public function print(Request $request): View
    {
        $this->authorizeProjectView($request);

        return view('admin.projects.list', $this->listDocument($request)->viewData(mode: 'print'));
    }

    public function exportPdf(Request $request): HttpResponse
    {
        $this->authorizeProjectView($request);

        return $this->listDocument($request)->pdfResponse();
    }

    public function exportWord(Request $request): BinaryFileResponse
    {
        $this->authorizeProjectView($request);

        return $this->listDocument($request)->wordResponse();
    }

    public function printProject(Request $request, Project $project): View
    {
        $this->authorizeProjectView($request);

        return view('admin.projects.document', ProjectDocument::for($project, $request->user())->viewData(mode: 'print'));
    }

    public function exportProjectPdf(Request $request, Project $project): HttpResponse
    {
        $this->authorizeProjectView($request);

        return ProjectDocument::for($project, $request->user())->pdfResponse();
    }

    public function exportProjectWord(Request $request, Project $project): BinaryFileResponse
    {
        $this->authorizeProjectView($request);

        return ProjectDocument::for($project, $request->user())->wordResponse();
    }

    public function create(Request $request): Response
    {
        abort_unless(ProjectAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Projects/Create', [
            'options' => $this->options($request->user()),
            'can' => $this->capabilities($request->user()),
        ]);
    }

    public function nameAvailability(Request $request): JsonResponse
    {
        abort_unless(
            ProjectAccess::canCreate($request->user()) || ProjectAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'project_id' => ['nullable', 'integer', Rule::exists(Project::class, 'id')],
        ]);

        $name = trim((string) ($validated['name'] ?? ''));

        if ($name === '') {
            return response()->json(['available' => true]);
        }

        return response()->json([
            'available' => ! $this->projectNameExists($name, $validated['project_id'] ?? null),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(ProjectAccess::canCreate($request->user()), 403);

        $validated = $this->validatedProject($request);

        $project = DB::transaction(function () use ($request, $validated): Project {
            $project = Project::create([
                ...$this->projectAttributes($request, $validated),
                'created_by' => $request->user()->id,
            ]);

            $this->syncProjectRelations($request, $project, $validated);

            return $project;
        });

        return redirect()
            ->route('admin.projects.index', ['highlight' => $project->id])
            ->with('success', 'Project created successfully.');
    }

    public function show(Request $request, Project $project): Response
    {
        $this->authorizeProjectView($request);

        $project->load([
            'assignee:id,name',
            'creator:id,name',
            'contractors.contacts',
            'scopes.product',
            'scopes.service',
            'revisions.user:id,name',
            'status',
        ]);

        return Inertia::render('Admin/Projects/Show', [
            'project' => $this->projectPayload($project, $request->user()),
            'options' => $this->options($request->user(), $project),
            'can' => $this->capabilities($request->user()),
        ]);
    }

    public function edit(Request $request, Project $project): Response
    {
        abort_unless(ProjectAccess::canUpdate($request->user()), 403);

        $project->load([
            'assignee:id,name',
            'contractors.contacts',
            'scopes.product',
            'scopes.service',
            'revisions.user:id,name',
            'status',
        ]);

        return Inertia::render('Admin/Projects/Edit', [
            'project' => $this->projectPayload($project, $request->user()),
            'options' => $this->options($request->user(), $project),
            'can' => $this->capabilities($request->user()),
        ]);
    }

    public function update(Request $request, Project $project): RedirectResponse
    {
        abort_unless(ProjectAccess::canUpdate($request->user()), 403);

        $validated = $this->validatedProject($request, $project);

        DB::transaction(function () use ($request, $project, $validated): void {
            $project->fill($this->projectAttributes($request, $validated));
            $project->save();

            $this->syncProjectRelations($request, $project, $validated);
        });

        return redirect()
            ->route('admin.projects.index', ['highlight' => $project->id])
            ->with('success', 'Project updated successfully.');
    }

    public function destroy(Request $request, Project $project): RedirectResponse
    {
        abort_unless(ProjectAccess::canDelete($request->user()), 403);

        $project->delete();

        return redirect()
            ->route('admin.projects.index')
            ->with('success', 'Project removed successfully.');
    }

    public function storeStatus(Request $request): RedirectResponse
    {
        abort_unless(
            ProjectAccess::canCreate($request->user()) || ProjectAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = ProjectStatus::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Status already exists.');
        }

        ProjectStatus::create(['name' => $name]);

        return back()->with('success', 'Status added successfully.');
    }

    public function storeScopeType(Request $request): RedirectResponse
    {
        abort_unless(
            ProjectAccess::canCreate($request->user())
                || ProjectAccess::canUpdate($request->user())
                || BidAccess::canCreate($request->user())
                || BidAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = ProjectScopeType::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Scope type already exists.');
        }

        ProjectScopeType::create(['name' => $name]);

        return back()->with('success', 'Scope type added successfully.');
    }

    private function authorizeProjectView(Request $request): void
    {
        abort_unless(ProjectAccess::canView($request->user()), 403);
    }

    private function projectListingQuery(Request $request): Builder
    {
        $search = (string) $request->query('search', '');
        $status = (int) $request->query('status', 0);

        return Project::query()
            ->with([
                'assignee:id,name',
                'contractors.contacts',
                'scopes.product',
                'scopes.service',
                'revisions',
                'status',
                'bids' => fn ($query) => $query
                    ->latest('id')
                    ->with(['scopes.title']),
            ])
            ->select('projects.*')
            ->withCount('bids')
            ->addSelect([
                'latest_bid_id' => Bid::query()
                    ->select('id')
                    ->whereColumn('project_id', 'projects.id')
                    ->latest('id')
                    ->limit(1),
            ])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('project_number', 'like', "%{$search}%")
                        ->orWhereHas('contractors', function ($query) use ($search): void {
                            $query
                                ->where('name', 'like', "%{$search}%")
                                ->orWhereHas('contacts', function ($query) use ($search): void {
                                    $query
                                        ->where('name', 'like', "%{$search}%")
                                        ->orWhere('email', 'like', "%{$search}%")
                                        ->orWhere('phone_number', 'like', "%{$search}%");
                                });
                        });
                });
            })
            ->when($status > 0, fn ($query) => $query->where('project_status_id', $status));
    }

    private function listDocument(Request $request): ProjectListDocument
    {
        $statusId = (int) $request->query('status', 0);
        $status = $statusId > 0 ? ProjectStatus::query()->find($statusId) : null;

        return new ProjectListDocument(
            projects: $this->projectListingQuery($request)->latest()->get(),
            company: Company::query()->where('is_active', true)->latest()->first(),
            user: $request->user(),
            search: (string) $request->query('search', ''),
            statusId: $statusId > 0 ? $statusId : null,
            statusName: $status?->name,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedProject(Request $request, ?Project $project = null): array
    {
        $user = $request->user();
        $isProjectManager = $user->hasUserLevel(UserLevel::PROJECT_MANAGER);

        StateInitials::prepare($request, 'site_state');
        PostalCode::prepare($request, 'site_postal_code');

        $rules = [
            'status_id' => ['required', 'integer', Rule::exists(ProjectStatus::class, 'id')],
            'priority' => ['required', 'string', Rule::in(Project::PRIORITIES)],
            'estimated_start_date' => ['nullable', 'date'],
            'estimated_end_date' => ['nullable', 'date', 'after_or_equal:estimated_start_date'],
            'completed_at' => ['nullable', 'date'],
            'public_notes' => ['nullable', 'string', 'max:5000'],
        ];

        if (! $isProjectManager) {
            $rules = [
                ...$rules,
                'name' => ['required', 'string', 'max:255', $this->uniqueProjectNameRule($project)],
                'assigned_to' => ['nullable', 'integer', Rule::exists(User::class, 'id')],
                'site_address_line_1' => ['nullable', 'string', 'max:255'],
                'site_address_line_2' => ['nullable', 'string', 'max:255'],
                'site_city' => ['nullable', 'string', 'max:255'],
                'site_state' => StateInitials::optionalRules(),
                'site_postal_code' => PostalCode::optionalRules(),
                'site_country' => ['nullable', 'string', 'max:255'],
                'contractors' => ['array'],
                'contractors.*.contractor_id' => [
                    'nullable',
                    'integer',
                    'distinct',
                    Rule::exists(Contractor::class, 'id'),
                ],
                'contractors.*.company_name' => ['nullable', 'string', 'max:255'],
                'contractors.*.contact_name' => ['nullable', 'string', 'max:255'],
                'contractors.*.email' => ['nullable', 'email', 'max:255'],
                'contractors.*.phone_number' => ['nullable', 'string', 'max:50'],
                'scopes' => ['array'],
                'scopes.*.type' => [
                    'required',
                    'string',
                    'distinct',
                    Rule::exists(ProjectScopeType::class, 'slug'),
                ],
                'scopes.*.product_id' => [
                    'nullable',
                    'integer',
                    Rule::exists(Product::class, 'id'),
                ],
                'scopes.*.service_id' => [
                    'nullable',
                    'integer',
                    Rule::exists(Service::class, 'id'),
                ],
                'scopes.*.notes' => ['nullable', 'string', 'max:250000'],
                'revisions' => ['array'],
                'revisions.*.id' => [
                    'nullable',
                    'integer',
                    Rule::exists(ProjectRevision::class, 'id')->where(
                        fn ($query) => $project
                            ? $query->where('project_id', $project->id)
                            : $query->whereRaw('0 = 1'),
                    ),
                ],
                'revisions.*.number' => ['required', 'string', 'max:50', 'distinct'],
                'revisions.*.revision_date' => ['nullable', 'date'],
                'revisions.*.notes' => ['nullable', 'string', 'max:2000'],
            ];
        }

        if (ProjectAccess::canViewSensitiveFields($user)) {
            $rules = [
                ...$rules,
                'budget_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
                'internal_notes' => ['nullable', 'string', 'max:5000'],
            ];
        }

        return $request->validate($rules);
    }

    private function uniqueProjectNameRule(?Project $project = null): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($project): void {
            $name = trim((string) $value);

            if ($name === '') {
                return;
            }

            if ($this->projectNameExists($name, $project?->id)) {
                $fail('A project with this name already exists.');
            }
        };
    }

    private function projectNameExists(string $name, ?int $ignoreProjectId = null): bool
    {
        return Project::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->when(
                $ignoreProjectId,
                fn ($query, int $projectId) => $query->whereKeyNot($projectId),
            )
            ->exists();
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function projectAttributes(Request $request, array $validated): array
    {
        $user = $request->user();
        $attributes = [
            'project_status_id' => $validated['status_id'],
            'priority' => $validated['priority'],
            'estimated_start_date' => $validated['estimated_start_date'] ?? null,
            'estimated_end_date' => $validated['estimated_end_date'] ?? null,
            'completed_at' => $validated['completed_at'] ?? null,
            'public_notes' => $validated['public_notes'] ?? null,
        ];

        if (! $user->hasUserLevel(UserLevel::PROJECT_MANAGER)) {
            $primaryScope = collect($validated['scopes'] ?? [])
                ->first(fn (array $scope): bool => filled($scope['type'] ?? null));

            $attributes = [
                ...$attributes,
                'name' => $validated['name'],
                'assigned_to' => $validated['assigned_to'] ?? null,
                'service_type' => $primaryScope['type'] ?? null,
                'site_address_line_1' => $validated['site_address_line_1'] ?? null,
                'site_address_line_2' => $validated['site_address_line_2'] ?? null,
                'site_city' => $validated['site_city'] ?? null,
                'site_state' => $validated['site_state'] ?? null,
                'site_postal_code' => $validated['site_postal_code'] ?? null,
                'site_country' => $validated['site_country'] ?? null,
            ];
        }

        if (ProjectAccess::canViewSensitiveFields($user)) {
            $attributes = [
                ...$attributes,
                'budget_amount' => $validated['budget_amount'] ?? null,
                'internal_notes' => $validated['internal_notes'] ?? null,
            ];
        }

        return $attributes;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function syncProjectRelations(Request $request, Project $project, array $validated): void
    {
        if ($request->user()->hasUserLevel(UserLevel::PROJECT_MANAGER)) {
            return;
        }

        $this->syncContractors($project, $validated['contractors'] ?? []);
        $this->syncScopes($project, $validated['scopes'] ?? []);
        $this->syncRevisions($project, $validated['revisions'] ?? [], $request->user());
    }

    /**
     * @param  array<int, array<string, mixed>>  $contractors
     */
    private function syncContractors(Project $project, array $contractors): void
    {
        $contractorIds = collect($contractors)
            ->map(fn (array $contractor): ?int => $this->resolveContractor($contractor))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $project->contractors()->sync($contractorIds);
    }

    /**
     * @param  array<string, mixed>  $contractor
     */
    private function resolveContractor(array $contractor): ?int
    {
        $contractorId = $contractor['contractor_id'] ?? null;
        $companyName = trim((string) ($contractor['company_name'] ?? ''));
        $contactName = trim((string) ($contractor['contact_name'] ?? ''));
        $email = trim((string) ($contractor['email'] ?? ''));
        $phoneNumber = trim((string) ($contractor['phone_number'] ?? ''));
        $hasContactFields = array_key_exists('contact_name', $contractor)
            || array_key_exists('email', $contractor)
            || array_key_exists('phone_number', $contractor);

        if (! $contractorId && $companyName === '') {
            return null;
        }

        $record = $contractorId
            ? Contractor::query()->with('contacts')->find($contractorId)
            : null;

        if (! $record && $companyName !== '') {
            $record = Contractor::query()
                ->with('contacts')
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($companyName)])
                ->first();
        }

        if (! $record && $companyName !== '') {
            $record = Contractor::create([
                'name' => $companyName,
            ]);
            $record->setRelation('contacts', collect());
        }

        if (! $record) {
            return null;
        }

        if ($companyName !== '' && strcasecmp($record->name, $companyName) !== 0) {
            $nameTaken = Contractor::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($companyName)])
                ->whereKeyNot($record->id)
                ->exists();

            if (! $nameTaken) {
                $record->update(['name' => $companyName]);
            }
        }

        if ($hasContactFields) {
            $this->syncContractorPrimaryContact(
                $record,
                $contactName,
                $email,
                $phoneNumber,
                $companyName,
            );
        }

        return $record->id;
    }

    private function syncContractorPrimaryContact(
        Contractor $contractor,
        string $contactName,
        string $email,
        string $phoneNumber,
        string $companyName,
    ): void {
        $contractor->loadMissing('contacts');

        $contact = $contractor->contacts->firstWhere('is_primary', true)
            ?? $contractor->contacts->first();

        if ($contactName === '' && $email === '' && $phoneNumber === '' && ! $contact) {
            return;
        }

        $attributes = [
            'name' => $contactName !== ''
                ? $contactName
                : ($contact?->name ?: ($companyName !== '' ? $companyName : $contractor->name)),
            'email' => $email !== '' ? $email : null,
            'phone_number' => $phoneNumber !== '' ? $phoneNumber : null,
        ];

        if ($contact) {
            $contact->update($attributes);

            return;
        }

        $contractor->contacts()->create([
            ...$attributes,
            'is_primary' => true,
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $scopes
     */
    private function syncScopes(Project $project, array $scopes): void
    {
        $scopes = collect($scopes)
            ->filter(fn (array $scope): bool => filled($scope['type'] ?? null))
            ->unique(fn (array $scope): string => (string) $scope['type'])
            ->values()
            ->map(fn (array $scope): array => [
                'scope_type' => $scope['type'],
                'product_id' => $scope['product_id'] ?? null,
                'service_id' => $scope['service_id'] ?? null,
                'notes' => BidApplicationText::sanitize($scope['notes'] ?? null),
            ]);

        $project->scopes()->delete();
        $project->scopes()->createMany($scopes->all());
    }

    /**
     * @param  array<int, array<string, mixed>>  $revisions
     */
    private function syncRevisions(Project $project, array $revisions, User $user): void
    {
        $revisions = collect($revisions)
            ->filter(fn (array $revision): bool => filled($revision['number'] ?? null))
            ->unique(fn (array $revision): string => strtolower(trim((string) $revision['number'])))
            ->values();

        $keptIds = [];

        foreach ($revisions as $revision) {
            $revisionId = (int) ($revision['id'] ?? 0);
            $existing = $revisionId > 0
                ? $project->revisions()->whereKey($revisionId)->first()
                : null;

            $attributes = [
                'number' => trim((string) $revision['number']),
                'revision_date' => $revision['revision_date'] ?: null,
                'notes' => $revision['notes'] ?? null,
            ];

            if ($existing) {
                $existingDate = $existing->revision_date?->toDateString();
                $changed = $existing->number !== $attributes['number']
                    || $existingDate !== $attributes['revision_date']
                    || trim((string) ($existing->notes ?? '')) !== trim((string) ($attributes['notes'] ?? ''));

                if ($changed) {
                    $attributes['user_id'] = $user->id;
                }

                $existing->update($attributes);
                $keptIds[] = $existing->id;

                continue;
            }

            $created = $project->revisions()->create([
                ...$attributes,
                'user_id' => $user->id,
            ]);
            $keptIds[] = $created->id;
        }

        $project->revisions()
            ->when(
                $keptIds !== [],
                fn ($query) => $query->whereKeyNot($keptIds),
                fn ($query) => $query,
            )
            ->delete();
    }

    /**
     * @return array<string, mixed>
     */
    private function projectPayload(Project $project, User $user, bool $summary = false): array
    {
        $payload = [
            'id' => $project->id,
            'uuid' => $project->uuid,
            'project_number' => $project->project_number,
            'name' => $project->name,
            'service_type' => $project->service_type,
            'status_id' => $project->project_status_id,
            'status' => $project->status?->name,
            'status_slug' => $project->status?->slug,
            'priority' => $project->priority,
            'estimated_start_date' => $project->estimated_start_date?->toDateString(),
            'estimated_end_date' => $project->estimated_end_date?->toDateString(),
            'completed_at' => $project->completed_at?->toDateString(),
            'public_notes' => $summary ? null : $project->public_notes,
            'contractors' => $project->contractors
                ->map(fn (Contractor $contractor): array => [
                    'id' => $contractor->id,
                    'name' => $contractor->name,
                    'contact_name' => $contractor->contact_name,
                    'email' => $contractor->email,
                    'phone_number' => $contractor->phone_number,
                    'contacts' => $summary
                        ? []
                        : $contractor->contacts
                            ->map(fn ($contact): array => [
                                'id' => $contact->id,
                                'name' => $contact->name,
                                'title' => $contact->title,
                                'email' => $contact->email,
                                'phone_number' => $contact->phone_number,
                                'phone_type' => $contact->phone_type,
                                'is_primary' => $contact->is_primary,
                            ])
                            ->values()
                            ->all(),
                ])
                ->values()
                ->all(),
            'scopes' => $project->scopes
                ->map(fn (ProjectScope $scope): array => [
                    'id' => $scope->id,
                    'type' => $scope->scope_type,
                    'product_id' => $scope->product_id,
                    'product_name' => $scope->product?->name,
                    'product_abbreviation' => $scope->product?->abbreviation,
                    'service_id' => $scope->service_id,
                    'service_name' => $scope->service?->name,
                    'notes' => $summary ? null : $scope->notes,
                ])
                ->values()
                ->all(),
            'revisions' => $summary
                ? []
                : $project->revisions
                    ->map(fn (ProjectRevision $revision): array => [
                        'id' => $revision->id,
                        'number' => $revision->number,
                        'revision_date' => $revision->revision_date?->toDateString(),
                        'notes' => $revision->notes,
                        'user_id' => $revision->user_id,
                        'user' => $revision->user
                            ? [
                                'id' => $revision->user->id,
                                'name' => $revision->user->name,
                            ]
                            : null,
                    ])
                    ->values()
                    ->all(),
            'assignee' => $project->assignee
                ? [
                    'id' => $project->assignee->id,
                    'name' => $project->assignee->name,
                ]
                : null,
            'created_at' => $project->created_at?->toFormattedDateString(),
            'updated_at' => $project->updated_at?->toFormattedDateString(),
            'bids_count' => (int) ($project->bids_count ?? $project->bids()->count()),
            'latest_bid_id' => $project->latest_bid_id
                ? (int) $project->latest_bid_id
                : ($project->relationLoaded('bids')
                    ? $project->bids->sortByDesc('id')->first()?->id
                    : null),
            'bid_scopes' => $this->bidScopePayload($project),
        ];

        if (! $summary) {
            $payload = [
                ...$payload,
                'site_address_line_1' => $project->site_address_line_1,
                'site_address_line_2' => $project->site_address_line_2,
                'site_city' => $project->site_city,
                'site_state' => $project->site_state,
                'site_postal_code' => $project->site_postal_code,
                'site_country' => $project->site_country,
                'creator' => $project->creator
                    ? [
                        'id' => $project->creator->id,
                        'name' => $project->creator->name,
                    ]
                    : null,
            ];
        }

        if (ProjectAccess::canViewSensitiveFields($user)) {
            $payload = [
                ...$payload,
                'budget_amount' => $project->budget_amount,
                'internal_notes' => $summary ? null : $project->internal_notes,
            ];
        }

        return $payload;
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    private function bidScopePayload(Project $project): array
    {
        $latestBid = $project->relationLoaded('bids')
            ? $project->bids->sortByDesc('id')->first()
            : $project->bids()->with('scopes.title')->latest('id')->first();

        if (! $latestBid) {
            return [];
        }

        $latestBid->loadMissing('scopes.title');

        return $latestBid->scopes
            ->map(fn ($scope): ?array => filled($scope->title?->name)
                ? [
                    'id' => $scope->id,
                    'name' => (string) $scope->title->name,
                ]
                : null)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function options(User $user, ?Project $project = null): array
    {
        return [
            'statuses' => ProjectStatus::query()
                ->orderBy('name')
                ->get(['id', 'name', 'slug'])
                ->map(fn (ProjectStatus $status): array => [
                    'id' => $status->id,
                    'name' => $status->name,
                    'slug' => $status->slug,
                ])
                ->all(),
            'priorities' => Project::PRIORITIES,
            'serviceTypes' => Project::SERVICE_TYPES,
            'scopeTypes' => ProjectScopeType::query()
                ->orderBy('name')
                ->get(['id', 'name', 'slug'])
                ->map(fn (ProjectScopeType $type): array => [
                    'id' => $type->id,
                    'name' => $type->name,
                    'slug' => $type->slug,
                ])
                ->all(),
            'products' => Product::query()
                ->whereIn('kind', Product::KINDS)
                ->orderBy('kind')
                ->orderBy('name')
                ->get(['id', 'name', 'abbreviation', 'kind'])
                ->map(fn (Product $product): array => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'abbreviation' => $product->abbreviation,
                    'kind' => $product->kind,
                ])
                ->all(),
            'services' => Service::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Service $service): array => [
                    'id' => $service->id,
                    'name' => $service->name,
                ])
                ->all(),
            'contractors' => Contractor::query()
                ->with([
                    'contacts' => fn ($query) => $query->orderByDesc('is_primary')->orderBy('name'),
                ])
                ->orderBy('name')
                ->get()
                ->map(fn (Contractor $contractor): array => [
                    'id' => $contractor->id,
                    'name' => $contractor->name,
                    'contact_name' => $contractor->contact_name,
                    'email' => $contractor->email,
                    'phone_number' => $contractor->phone_number,
                ])
                ->all(),
            'assignees' => User::query()
                ->whereHas('level', fn ($query) => $query->whereIn('name', [
                    UserLevel::SUPER_ADMIN,
                    UserLevel::ADMINISTRATOR,
                    UserLevel::ADMIN,
                    UserLevel::PROJECT_MANAGER,
                ]))
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (User $assignee): array => [
                    'id' => $assignee->id,
                    'name' => $assignee->name,
                ])
                ->all(),
            'can' => $this->capabilities($user),
            'nextProjectNumber' => Project::nextNumber(),
        ];
    }

    /**
     * @return array<string, bool>
     */
    private function capabilities(User $user): array
    {
        return [
            'create' => ProjectAccess::canCreate($user),
            'update' => ProjectAccess::canUpdate($user),
            'delete' => ProjectAccess::canDelete($user),
            'viewSensitiveFields' => ProjectAccess::canViewSensitiveFields($user),
        ];
    }
}
