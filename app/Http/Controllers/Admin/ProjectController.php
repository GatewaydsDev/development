<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Project;
use App\Models\User;
use App\Support\ProjectAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorizeProjectView($request);

        $search = (string) $request->query('search', '');
        $status = (string) $request->query('status', '');
        $user = $request->user();

        return Inertia::render('Admin/Projects/Index', [
            'filters' => [
                'search' => $search,
                'status' => $status,
            ],
            'options' => $this->options($user),
            'projects' => Project::query()
                ->with([
                    'customer.contacts' => fn ($query) => $query->orderByDesc('is_primary')->orderBy('name'),
                    'assignee:id,name',
                ])
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('project_number', 'like', "%{$search}%")
                            ->orWhereHas('customer', function ($query) use ($search): void {
                                $query
                                    ->where('name', 'like', "%{$search}%")
                                    ->orWhere('company_name', 'like', "%{$search}%");
                            });
                    });
                })
                ->when(in_array($status, Project::STATUSES, true), fn ($query) => $query->where('status', $status))
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Project $project): array => $this->projectPayload($project, $user, summary: true)),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless(ProjectAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Projects/Create', [
            'options' => $this->options($request->user()),
            'can' => $this->capabilities($request->user()),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(ProjectAccess::canCreate($request->user()), 403);

        $validated = $this->validatedProject($request);

        Project::create([
            ...$this->projectAttributes($request, $validated),
            'created_by' => $request->user()->id,
        ]);

        return redirect()
            ->route('admin.projects.index')
            ->with('success', 'Project created successfully.');
    }

    public function show(Request $request, Project $project): Response
    {
        $this->authorizeProjectView($request);

        $project->load([
            'customer.contacts' => fn ($query) => $query->orderByDesc('is_primary')->orderBy('name'),
            'assignee:id,name',
            'creator:id,name',
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
            'customer.contacts' => fn ($query) => $query->orderByDesc('is_primary')->orderBy('name'),
            'assignee:id,name',
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

        $project->fill($this->projectAttributes($request, $validated));
        $project->save();

        return redirect()
            ->route('admin.projects.index')
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

    private function authorizeProjectView(Request $request): void
    {
        abort_unless(ProjectAccess::canView($request->user()), 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedProject(Request $request, ?Project $project = null): array
    {
        $user = $request->user();
        $isProjectManager = $user->hasUserLevel(\App\Models\UserLevel::PROJECT_MANAGER);

        $rules = [
            'status' => ['required', 'string', Rule::in(Project::STATUSES)],
            'priority' => ['required', 'string', Rule::in(Project::PRIORITIES)],
            'estimated_start_date' => ['nullable', 'date'],
            'estimated_end_date' => ['nullable', 'date', 'after_or_equal:estimated_start_date'],
            'completed_at' => ['nullable', 'date'],
            'public_notes' => ['nullable', 'string', 'max:5000'],
        ];

        if (! $isProjectManager) {
            $rules = [
                ...$rules,
                'name' => ['required', 'string', 'max:255'],
                'project_number' => ['nullable', 'string', 'max:255', Rule::unique(Project::class)->ignore($project?->id)],
                'customer_id' => [
                    'required',
                    'integer',
                    Rule::exists(Customer::class, 'id'),
                    Rule::unique(Project::class, 'customer_id')->ignore($project?->id),
                ],
                'assigned_to' => ['nullable', 'integer', Rule::exists(User::class, 'id')],
                'service_type' => ['nullable', 'string', Rule::in(Project::SERVICE_TYPES)],
                'site_address_line_1' => ['nullable', 'string', 'max:255'],
                'site_address_line_2' => ['nullable', 'string', 'max:255'],
                'site_city' => ['nullable', 'string', 'max:255'],
                'site_state' => ['nullable', 'string', 'max:255'],
                'site_postal_code' => ['nullable', 'string', 'max:50'],
                'site_country' => ['nullable', 'string', 'max:255'],
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

    /**
     * @param array<string, mixed> $validated
     * @return array<string, mixed>
     */
    private function projectAttributes(Request $request, array $validated): array
    {
        $user = $request->user();
        $attributes = [
            'status' => $validated['status'],
            'priority' => $validated['priority'],
            'estimated_start_date' => $validated['estimated_start_date'] ?? null,
            'estimated_end_date' => $validated['estimated_end_date'] ?? null,
            'completed_at' => $validated['completed_at'] ?? null,
            'public_notes' => $validated['public_notes'] ?? null,
        ];

        if (! $user->hasUserLevel(\App\Models\UserLevel::PROJECT_MANAGER)) {
            $attributes = [
                ...$attributes,
                'name' => $validated['name'],
                'project_number' => $validated['project_number'] ?? null,
                'customer_id' => $validated['customer_id'],
                'assigned_to' => $validated['assigned_to'] ?? null,
                'service_type' => $validated['service_type'] ?? null,
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
            'status' => $project->status,
            'priority' => $project->priority,
            'estimated_start_date' => $project->estimated_start_date?->toDateString(),
            'estimated_end_date' => $project->estimated_end_date?->toDateString(),
            'completed_at' => $project->completed_at?->toDateString(),
            'public_notes' => $summary ? null : $project->public_notes,
            'customer' => [
                'id' => $project->customer?->id,
                'name' => $project->customer?->name,
                'company_name' => $project->customer?->company_name,
            ],
            'assignee' => $project->assignee
                ? [
                    'id' => $project->assignee->id,
                    'name' => $project->assignee->name,
                ]
                : null,
            'created_at' => $project->created_at?->toFormattedDateString(),
            'updated_at' => $project->updated_at?->toFormattedDateString(),
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
                'customer' => [
                    ...$payload['customer'],
                    'address_line_1' => $project->customer?->address_line_1,
                    'address_line_2' => $project->customer?->address_line_2,
                    'city' => $project->customer?->city,
                    'state' => $project->customer?->state,
                    'postal_code' => $project->customer?->postal_code,
                    'country' => $project->customer?->country,
                ],
                'creator' => $project->creator
                    ? [
                        'id' => $project->creator->id,
                        'name' => $project->creator->name,
                    ]
                    : null,
            ];
        }

        if (ProjectAccess::canViewCustomerContactFields($user)) {
            $primaryContact = $project->customer?->contacts?->firstWhere('is_primary', true)
                ?? $project->customer?->contacts?->first();

            $payload['customer'] = [
                ...$payload['customer'],
                'email' => $primaryContact?->email ?? $project->customer?->email,
                'phone_number' => $primaryContact?->phone_number ?? $project->customer?->phone_number,
                'contacts' => $project->customer?->contacts
                    ? $project->customer->contacts
                        ->map(fn ($contact): array => [
                            'id' => $contact->id,
                            'name' => $contact->name,
                            'title' => $contact->title,
                            'email' => $contact->email,
                            'phone_number' => $contact->phone_number,
                            'is_primary' => $contact->is_primary,
                        ])
                        ->values()
                    : [],
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
     * @return array<string, mixed>
     */
    private function options(User $user, ?Project $project = null): array
    {
        return [
            'statuses' => Project::STATUSES,
            'priorities' => Project::PRIORITIES,
            'serviceTypes' => Project::SERVICE_TYPES,
            'assignees' => User::query()
                ->whereHas('level', fn ($query) => $query->whereIn('name', [
                    \App\Models\UserLevel::SUPER_ADMIN,
                    \App\Models\UserLevel::ADMINISTRATOR,
                    \App\Models\UserLevel::ADMIN,
                    \App\Models\UserLevel::PROJECT_MANAGER,
                ]))
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (User $assignee): array => [
                    'id' => $assignee->id,
                    'name' => $assignee->name,
                ])
                ->all(),
            'customers' => Customer::query()
                ->with(['contacts' => fn ($query) => $query->orderByDesc('is_primary')->orderBy('name')])
                ->where(function ($query) use ($project): void {
                    $query
                        ->whereDoesntHave('project')
                        ->when(
                            $project?->customer_id,
                            fn ($query, int $customerId) => $query->orWhere('id', $customerId),
                        );
                })
                ->orderBy('name')
                ->get()
                ->map(fn (Customer $customer): array => [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'company_name' => $customer->company_name,
                    'email' => $customer->email,
                    'phone_number' => $customer->phone_number,
                    'address_line_1' => $customer->address_line_1,
                    'address_line_2' => $customer->address_line_2,
                    'city' => $customer->city,
                    'state' => $customer->state,
                    'postal_code' => $customer->postal_code,
                    'country' => $customer->country,
                    'contacts' => $customer->contacts
                        ->map(fn ($contact): array => [
                            'id' => $contact->id,
                            'name' => $contact->name,
                            'title' => $contact->title,
                            'email' => $contact->email,
                            'phone_number' => $contact->phone_number,
                            'is_primary' => $contact->is_primary,
                        ])
                        ->values(),
                ])
                ->all(),
            'can' => $this->capabilities($user),
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
            'viewCustomerContactFields' => ProjectAccess::canViewCustomerContactFields($user),
        ];
    }
}

