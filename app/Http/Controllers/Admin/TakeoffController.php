<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AuthorizesTakeoffs;
use App\Http\Controllers\Controller;
use App\Models\DoorConfiguration;
use App\Models\OpeningCategory;
use App\Models\Product;
use App\Models\Project;
use App\Models\Quotation;
use App\Models\Takeoff;
use App\Models\TakeoffAssemblyTemplate;
use App\Models\TakeoffOverview;
use App\Models\TakeoffOpening;
use App\Models\TakeoffOpeningType;
use App\Models\TaxState;
use App\Models\User;
use App\Support\ProjectAccess;
use App\Support\ProjectControlTakeoff;
use App\Support\TakeoffAccess;
use App\Support\TakeoffConversion;
use App\Support\TakeoffCsv;
use App\Support\TakeoffMoney;
use App\Support\TakeoffNamer;
use App\Support\TakeoffPdfScope;
use App\Support\TakeoffOverviewHydrator;
use App\Support\TakeoffPresenter;
use App\Support\TakeoffRelease;
use App\Support\TakeoffViews;
use App\Support\TakeoffScopeImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class TakeoffController extends Controller
{
    use AuthorizesTakeoffs;

    public function index(Request $request): InertiaResponse
    {
        $user = $this->takeoffUser($request);
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(config('takeoffs.statuses'))],
            'project_id' => ['nullable', 'integer'],
        ]);

        $takeoffs = Takeoff::query()
            ->with(['project:id,name,project_number', 'openings.costs', 'groups.costs', 'groups.openings'])
            ->when($filters['search'] ?? null, function ($query, string $search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('title', 'like', '%'.$search.'%')
                        ->orWhereHas('project', function ($query) use ($search): void {
                            $query->where('name', 'like', '%'.$search.'%')
                                ->orWhere('project_number', 'like', '%'.$search.'%');
                        });
                });
            })
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['project_id'] ?? null, fn ($query, int $projectId) => $query->where('project_id', $projectId))
            ->latest('updated_at')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/Takeoffs/Index', [
            'filters' => [
                'search' => $filters['search'] ?? '',
                'status' => $filters['status'] ?? '',
                'project_id' => $filters['project_id'] ?? '',
            ],
            'takeoffs' => $takeoffs->through(fn (Takeoff $takeoff): array => TakeoffPresenter::summary($takeoff, $user)),
            'projects' => Project::query()->orderBy('name')->get(['id', 'name', 'project_number']),
            'can' => $this->abilities($user),
        ]);
    }

    public function create(Request $request): InertiaResponse
    {
        abort_unless(TakeoffAccess::canCreate($this->takeoffUser($request)), 403);

        return Inertia::render('Admin/Takeoffs/Create', [
            'projects' => TakeoffViews::ready()
                ? TakeoffViews::projects()
                : Project::query()->orderBy('name')->get(['id', 'name', 'project_number']),
            'projectId' => $request->integer('project_id') ?: null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canCreate($user), 403);
        TakeoffPdfScope::assertUploaded($request->file('file'));

        if ($request->input('project_id') === '') {
            $request->merge(['project_id' => null]);
        }

        $data = $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'title' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:60000'],
            'file' => ['nullable', 'file', 'mimes:pdf', 'max:'.config('takeoffs.max_kilobytes')],
        ]);

        $file = $request->file('file');

        if ($file) {
            TakeoffPdfScope::assertPdf($file);
        }

        $createdProject = null;
        $projectInfo = [
            'name' => null,
            'address' => null,
            'city' => null,
            'state' => null,
            'postal_code' => null,
            'notes' => null,
        ];

        if ($file) {
            $projectInfo = TakeoffPdfScope::read($file->getPathname())['project'] ?? $projectInfo;
        }

        if (filled($data['project_id'] ?? null)) {
            $project = Project::query()->findOrFail($data['project_id']);
        } elseif ($file && ProjectAccess::canCreate($user)) {
            $name = trim((string) ($projectInfo['name'] ?? ''));

            if ($name === '') {
                $name = TakeoffNamer::projectNameFromFilename($file->getClientOriginalName());
            }

            $existingProject = Project::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->first();

            if ($existingProject) {
                $project = $existingProject;
            } else {
                $createdProject = Project::query()->create([
                    'name' => $name,
                    'priority' => 'normal',
                    'site_address_line_1' => $projectInfo['address'] ?? null,
                    'site_city' => $projectInfo['city'] ?? null,
                    'site_state' => $projectInfo['state'] ?? null,
                    'site_postal_code' => $projectInfo['postal_code'] ?? null,
                    'site_country' => filled($projectInfo['city'] ?? null) || filled($projectInfo['state'] ?? null)
                        ? 'United States'
                        : null,
                    'internal_notes' => $projectInfo['notes'] ?? null,
                    'created_by' => $user->id,
                ]);
                $project = $createdProject;
            }
        } else {
            throw ValidationException::withMessages([
                'project_id' => $file
                    ? 'Select a project.'
                    : 'Select a project, or upload a drawing and a project is created from the file name.',
            ]);
        }
        $existingTakeoff = Takeoff::query()
            ->where('project_id', $project->id)
            ->latest('id')
            ->first();

        if ($existingTakeoff) {
            return redirect()->route('admin.takeoffs.show', [
                'takeoff' => $existingTakeoff,
                'already' => 1,
            ]);
        }

        $providedTitle = trim((string) ($data['title'] ?? ''));
        $titleIsProjectName = $createdProject !== null && $providedTitle === '';
        $takeoff = Takeoff::query()->create([
            'project_id' => $project->id,
            'title' => $titleIsProjectName
                ? $project->name
                : ($providedTitle !== '' ? $providedTitle : TakeoffNamer::title($project)),
            'notes' => $data['notes'] ?? null,
            'status' => 'draft',
            'pricing_method' => 'markup',
            'markup_rate' => '0.000000',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $scope = ['openings' => [], 'notes' => []];
        $import = ['created' => [], 'skipped' => 0, 'markers_added' => 0];

        if ($file) {
            $path = $file->store('takeoffs/'.$takeoff->id, config('takeoffs.disk'));

            if (! is_string($path)) {
                $takeoff->delete();
                $createdProject?->delete();

                return back()->with('error', 'The drawing could not be stored.');
            }

            $document = $takeoff->documents()->create([
                'original_filename' => $file->getClientOriginalName(),
                'storage_path' => $path,
                'mime' => 'application/pdf',
                'size' => $file->getSize() ?: 0,
                'document_type' => 'drawing',
                'uploaded_by' => $user->id,
            ]);
            $attached = TakeoffScopeImporter::attach(
                $takeoff,
                $document,
                Storage::disk(config('takeoffs.disk'))->path($path),
            );
            $scope = $attached['scope'];
            $import = $attached['import'];

            if ($providedTitle === '' && ! $titleIsProjectName) {
                $takeoff->forceFill([
                    'title' => TakeoffNamer::title($project, $scope, $takeoff->id),
                ])->save();
            }
        }

        $takeoff->record(
            $user,
            'takeoff.created',
            $file ? 'Takeoff was created from '.$file->getClientOriginalName().'.' : 'Takeoff was created.',
            ['title' => $takeoff->title],
        );
        app(ProjectControlTakeoff::class)->connectTakeoff($takeoff);

        return redirect()
            ->route('admin.takeoffs.show', $takeoff)
            ->with('success', TakeoffScopeImporter::createdMessage($file !== null, $import, $scope));
    }

    public function show(Request $request, Takeoff $takeoff): InertiaResponse
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canView($user), 403);

        if (TakeoffViews::ready()) {
            $overview = TakeoffOverview::query()->find($takeoff->id);

            if ($overview) {
                app(TakeoffOverviewHydrator::class)->apply($takeoff, $overview);
            }
        }

        $quotations = TakeoffAccess::canConvert($user)
            ? (TakeoffViews::ready()
                ? collect(TakeoffViews::quotations((int) $takeoff->project_id))
                : Quotation::query()
                    ->where('project_id', $takeoff->project_id)
                    ->orderByDesc('id')
                    ->get(['id', 'uuid', 'quotation_number', 'title', 'status'])
                    ->map(fn (Quotation $quotation): array => [
                        'id' => $quotation->id,
                        'number' => $quotation->quotation_number,
                        'title' => $quotation->title,
                        'status' => $quotation->status,
                    ]))
            : collect();

        $takeoff->loadMissing('project');

        return Inertia::render('Admin/Takeoffs/Show', [
            'takeoff' => TakeoffPresenter::detail($takeoff, $user),
            'alreadyExistsMessage' => $request->boolean('already')
                ? 'A takeoff for “'.($takeoff->project?->name ?: 'this project').'” already exists.'
                : null,
            'templates' => TakeoffViews::ready()
                ? TakeoffViews::templates()
                : TakeoffAssemblyTemplate::query()->orderBy('name')->get()->map(fn (TakeoffAssemblyTemplate $template): array => [
                    'id' => $template->id,
                    'name' => $template->name,
                    'opening_type' => $template->opening_type,
                    'product_category' => $template->product_category,
                    'frame_type' => $template->frame_type,
                    'hardware_set' => $template->hardware_set,
                    'glazing' => $template->glazing,
                    'finish' => $template->finish,
                    'manufacturer' => $template->manufacturer,
                    'product_model' => $template->product_model,
                    'default_costs' => $template->default_costs ?? [],
                ])->values()->all(),
            'quotations' => $quotations->values()->all(),
            'can' => $this->abilities($user),
            'costProducts' => $this->costProducts(),
            'priceStates' => TaxState::query()->orderBy('name')->get(['id', 'name'])->map(fn (TaxState $state): array => [
                'id' => $state->id,
                'name' => $state->name,
                'abbreviation' => $state->abbreviation(),
            ])->values()->all(),
            'priceStateId' => $this->projectPriceStateId($takeoff),
            'doorTypes' => TakeoffViews::ready()
                ? TakeoffViews::doorTypes()
                : DoorConfiguration::query()
                    ->orderBy('name')
                    ->get(['id', 'name'])
                    ->map(fn (DoorConfiguration $type): array => [
                        'id' => $type->id,
                        'name' => $type->name,
                    ])
                    ->values()
                    ->all(),
            'openingCategories' => OpeningCategory::choices(),
            'openingTypes' => TakeoffOpeningType::choices(),
        ]);
    }

    public function update(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canUpdate($user), 403);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'revision_number' => ['sometimes', 'integer', 'min:1', 'max:9999'],
            'revision_label' => ['sometimes', 'nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:60000'],
            'status' => ['required', Rule::in(config('takeoffs.statuses'))],
            'pricing_method' => ['nullable', Rule::in(config('takeoffs.pricing_methods'))],
            'markup_percent' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'margin_percent' => ['nullable', 'numeric', 'min:0', 'max:99.99'],
            'install_pricing_method' => ['nullable', Rule::in(config('takeoffs.pricing_methods'))],
            'install_markup_percent' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'install_margin_percent' => ['nullable', 'numeric', 'min:0', 'max:99.99'],
            'transaction_fee_applicable' => ['nullable', 'boolean'],
        ]);

        if ($takeoff->status === 'archived' && $data['status'] !== 'draft') {
            abort(403, 'Reopen an archived takeoff as a draft before editing it.');
        }

        if ($request->filled('markup_percent') && $request->filled('margin_percent')) {
            throw ValidationException::withMessages([
                'pricing_method' => 'Use markup or target margin, not both.',
            ]);
        }

        if ($data['status'] === 'approved' && $takeoff->status !== 'approved') {
            abort_unless(TakeoffAccess::canApprove($user), 403);
        }

        $openingDrafts = app(TakeoffWorkspaceController::class)->validatedOpeningDrafts($takeoff, $user, $request->input('openings', []));

        if ($openingDrafts !== [] && $takeoff->status === 'approved' && $data['status'] === 'approved') {
            $data['status'] = 'in_review';
        }

        $changes = [
            'title' => $data['title'],
            'notes' => $data['notes'] ?? null,
            'status' => $data['status'],
        ];

        if (array_key_exists('revision_number', $data)) {
            $changes['revision_number'] = $data['revision_number'];
        }

        if (array_key_exists('revision_label', $data)) {
            $label = trim((string) ($data['revision_label'] ?? ''));
            $changes['revision_label'] = $label === '' ? null : $label;
        }

        if ($data['status'] === 'approved' && $takeoff->status !== 'approved') {
            $changes['approved_by'] = $user->id;
            $changes['approved_at'] = now();
        }

        if ($data['status'] !== 'approved') {
            $changes['approved_by'] = null;
            $changes['approved_at'] = null;
        }

        if (TakeoffAccess::canViewPricing($user) && isset($data['pricing_method'])) {
            $method = $data['pricing_method'];
            $changes['pricing_method'] = $method;

            if ($method === 'margin') {
                if (! $request->filled('margin_percent')) {
                    throw ValidationException::withMessages([
                        'margin_percent' => 'Enter a target margin below 100%.',
                    ]);
                }

                $changes['margin_rate'] = TakeoffMoney::rate($data['margin_percent']);
                $changes['markup_rate'] = null;
            } else {
                $changes['markup_rate'] = TakeoffMoney::rate($data['markup_percent'] ?? 0);
                $changes['margin_rate'] = null;
            }

            if ($request->filled('install_markup_percent') && $request->filled('install_margin_percent')) {
                throw ValidationException::withMessages([
                    'install_pricing_method' => 'Use an install markup or an install margin, not both.',
                ]);
            }

            $installMethod = $data['install_pricing_method'] ?? $takeoff->install_pricing_method ?? 'markup';
            $changes['install_pricing_method'] = $installMethod;
            $changes['transaction_fee_applicable'] = $request->boolean('transaction_fee_applicable');

            if ($installMethod === 'margin' && $request->filled('install_margin_percent')) {
                $changes['install_margin_rate'] = TakeoffMoney::rate($data['install_margin_percent']);
                $changes['install_markup_rate'] = null;
            } elseif ($request->filled('install_markup_percent')) {
                $changes['install_markup_rate'] = TakeoffMoney::rate($data['install_markup_percent']);
                $changes['install_margin_rate'] = null;
            } else {
                $changes['install_markup_rate'] = null;
                $changes['install_margin_rate'] = null;
            }
        }

        $savedOpenings = 0;

        DB::transaction(function () use ($takeoff, $changes, $openingDrafts, &$savedOpenings): void {
            $takeoff->fill($changes)->save();
            $savedOpenings = app(TakeoffWorkspaceController::class)->storeOpeningDrafts($takeoff, $openingDrafts);

            if ($takeoff->status === 'approved') {
                TakeoffRelease::assertReady($takeoff->fresh());
            }
        });
        $action = $data['status'] === 'approved' && $takeoff->wasChanged('approved_at')
            ? 'takeoff.approved'
            : 'takeoff.updated';
        $summary = $action === 'takeoff.approved'
            ? 'Takeoff was approved internally. Approval does not certify product compliance.'
            : ($savedOpenings > 0
                ? 'Takeoff saved, including '.$savedOpenings.' opening '.($savedOpenings === 1 ? 'change' : 'changes').'.'
                : 'Takeoff details were updated.');
        $takeoff->record($user, $action, $summary, ['status' => $takeoff->status]);

        return redirect()
            ->route('admin.takeoffs.index')
            ->with('success', $summary);
    }

    public function destroy(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canDelete($user), 403);

        if ($takeoff->quotationLines()->exists()) {
            return back()->with('error', 'This takeoff was transferred to a quotation. Archive it instead of deleting it.');
        }

        $takeoff->delete();

        return redirect()->route('admin.takeoffs.index')->with('success', 'Takeoff deleted.');
    }

    public function export(Request $request, Takeoff $takeoff): Response
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canExport($user), 403);

        $rows = $takeoff->openings()->orderBy('sort_order')->orderBy('id')->get()->map(function (TakeoffOpening $opening): array {
            return [
                'tag' => $opening->tag,
                'is_bulk' => $opening->is_bulk ? 'yes' : 'no',
                'opening_type' => $opening->opening_type,
                'location' => $opening->location,
                'quantity' => $opening->quantity,
                'product_category' => $opening->product_category,
                'width' => $opening->width,
                'height' => $opening->height,
                'depth' => $opening->depth,
                'dimension_unit' => $opening->dimension_unit,
                'frame_type' => $opening->frame_type,
                'handing' => $opening->handing,
                'hardware_set' => $opening->hardware_set,
                'glazing' => $opening->glazing,
                'finish' => $opening->finish,
                'manufacturer' => $opening->manufacturer,
                'product_model' => $opening->product_model,
                'scope' => $opening->scope,
                'notes' => $opening->notes,
                'exclusions' => $opening->exclusions,
                'assumptions' => $opening->assumptions,
                'acoustic_requirement' => $opening->acoustic_requirement,
                'rf_requirement' => $opening->rf_requirement,
                'fire_requirement' => $opening->fire_requirement,
                'ballistic_requirement' => $opening->ballistic_requirement,
                'other_requirements' => $opening->other_requirements,
                'requirement_page' => $opening->requirement_page,
                'requirement_section' => $opening->requirement_section,
            ];
        })->all();

        return response(TakeoffCsv::export($rows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="takeoff-'.$takeoff->uuid.'.csv"',
        ]);
    }

    public function importTemplate(): Response
    {
        return response(TakeoffCsv::template(), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="takeoff-import-template.csv"',
        ]);
    }

    public function importPreview(Request $request, Takeoff $takeoff): JsonResponse
    {
        $this->ensureEditable($request, $takeoff);
        $parsed = $this->parsedCsv($request);

        return response()->json($parsed + [
            'duplicates' => $this->duplicateMessages($takeoff, $parsed['rows']),
        ]);
    }

    public function import(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->ensureEditable($request, $takeoff);
        $mode = $request->validate([
            'duplicate_mode' => ['required', Rule::in(['reject', 'flag'])],
        ])['duplicate_mode'];
        $parsed = $this->parsedCsv($request);

        if ($parsed['errors'] !== []) {
            throw ValidationException::withMessages([
                'file' => 'Nothing was imported. Fix the rows listed in the preview.',
            ]);
        }

        $duplicates = $this->duplicateMessages($takeoff, $parsed['rows']);

        if ($duplicates !== [] && $mode === 'reject') {
            throw ValidationException::withMessages([
                'file' => 'Nothing was imported because duplicate opening tags were found.',
            ]);
        }

        $sort = (int) $takeoff->openings()->max('sort_order');

        foreach ($parsed['rows'] as $row) {
            $sort++;
            unset($row['row']);
            $takeoff->openings()->create($row + [
                'sort_order' => $sort,
                'disposition' => 'active',
                'verification_status' => 'recorded',
            ]);
        }

        $this->clearApproval($takeoff, $user);
        app(ProjectControlTakeoff::class)->connectTakeoff($takeoff);
        $takeoff->record($user, 'import.completed', count($parsed['rows']).' opening(s) imported from a spreadsheet.', [
            'duplicate_mode' => $mode,
            'duplicates' => $duplicates,
        ]);

        return back()->with('success', count($parsed['rows']).' opening(s) imported.');
    }

    public function storeDoorType(Request $request): RedirectResponse
    {
        abort_unless(TakeoffAccess::canUpdate($this->takeoffUser($request)), 403);

        $name = trim($request->validate([
            'name' => ['required', 'string', 'max:255'],
        ])['name']);

        $existing = DoorConfiguration::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if (! $existing) {
            DoorConfiguration::create(['name' => $name]);
        }

        return back();
    }

    public function storeOpeningCategory(Request $request): RedirectResponse
    {
        abort_unless(TakeoffAccess::canUpdate($this->takeoffUser($request)), 403);

        $name = trim($request->validate([
            'name' => ['required', 'string', 'max:255'],
        ])['name']);

        OpeningCategory::remember($name);

        return back();
    }

    public function storeOpeningType(Request $request): RedirectResponse
    {
        abort_unless(TakeoffAccess::canUpdate($this->takeoffUser($request)), 403);

        $name = trim($request->validate([
            'name' => ['required', 'string', 'max:80'],
        ])['name']);

        TakeoffOpeningType::remember($name);

        return back();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function costProducts(): array
    {
        return Product::query()
            ->with([
                'manufacturer:id,name',
                'statePrices:id,product_id,tax_state_id,price',
                'configurations:id,name',
                'handings:id,name',
                'glassType:id,name',
                'glazingType:id,name',
                'seal:id,name',
            ])
            ->orderBy('name')
            ->limit(400)
            ->get([
                'id',
                'name',
                'sku',
                'abbreviation',
                'manufacturer_id',
                'kind',
                'fire_label',
                'stc_rating',
                'rf_shielding',
                'thickness',
                'window_glass_type_id',
                'window_glazing_type_id',
                'window_seal_id',
            ])
            ->map(fn (Product $product): array => [
                'id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'abbreviation' => $product->abbreviation,
                'kind' => $product->kind,
                'supplier_name' => $product->manufacturer?->name,
                'fire_label' => $product->fire_label,
                'stc_rating' => $product->stc_rating,
                'rf_shielding' => $product->rf_shielding,
                'thickness' => $product->thickness !== null && $product->thickness !== '' ? (string) $product->thickness : null,
                'glass_type' => $product->glassType?->name,
                'glazing_type' => $product->glazingType?->name,
                'seal' => $product->seal?->name,
                'configurations' => $product->configurations->map(fn ($row): array => [
                    'id' => $row->id,
                    'name' => $row->name,
                ])->values()->all(),
                'handings' => $product->handings->map(fn ($row): array => [
                    'id' => $row->id,
                    'name' => $row->name,
                ])->values()->all(),
                'state_prices' => $product->statePrices->map(fn ($row): array => [
                    'tax_state_id' => (int) $row->tax_state_id,
                    'unit_price' => $row->price !== null && $row->price !== '' ? (string) $row->price : null,
                ])->values()->all(),
            ])
            ->values()
            ->all();
    }

    private function projectPriceStateId(Takeoff $takeoff): ?int
    {
        $takeoff->loadMissing('project:id,site_state');
        $siteState = strtoupper(trim((string) ($takeoff->project?->site_state ?? '')));

        if ($siteState === '') {
            return null;
        }

        $stateName = TaxState::ABBREVIATIONS[$siteState] ?? $takeoff->project?->site_state;
        $stateId = TaxState::query()->where('name', $stateName)->value('id');

        return $stateId ? (int) $stateId : null;
    }

    public function products(Request $request): JsonResponse
    {
        abort_unless(TakeoffAccess::canView($this->takeoffUser($request)), 403);
        $term = trim((string) $request->query('q', ''));

        $products = Product::query()
            ->with('manufacturer:id,name')
            ->when($term !== '', function ($query) use ($term): void {
                $query->where(function ($query) use ($term): void {
                    $query->where('name', 'like', '%'.$term.'%')
                        ->orWhere('abbreviation', 'like', '%'.$term.'%');
                });
            })
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'manufacturer_id', 'kind']);

        return response()->json($products->map(fn (Product $product): array => [
            'id' => $product->id,
            'name' => $product->name,
            'kind' => $product->kind,
            'manufacturer' => $product->manufacturer?->name,
        ])->values());
    }

    public function previewConversion(Request $request, Takeoff $takeoff): JsonResponse
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canConvert($user), 403);
        $quotationId = $request->validate([
            'quotation_id' => ['required', 'integer'],
        ])['quotation_id'];
        $quotation = Quotation::query()->find($quotationId);

        if (! $quotation || (int) $quotation->project_id !== (int) $takeoff->project_id) {
            throw ValidationException::withMessages([
                'quotation_id' => 'Choose a quotation for this project.',
            ]);
        }

        return response()->json([
            'lines' => TakeoffConversion::lines($takeoff, $quotation),
        ]);
    }

    public function convert(Request $request, Takeoff $takeoff): RedirectResponse
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canConvert($user), 403);
        $data = $request->validate([
            'quotation_id' => ['required', 'integer'],
            'keys' => ['required', 'array', 'min:1'],
            'keys.*' => ['string'],
            'replace' => ['required', 'boolean'],
        ]);
        $quotation = Quotation::query()->find($data['quotation_id']);

        if (! $quotation) {
            throw ValidationException::withMessages([
                'quotation_id' => 'Choose a quotation for this project.',
            ]);
        }

        $count = TakeoffConversion::transfer($takeoff, $quotation, $data['keys'], $request->boolean('replace'), $user);

        return back()->with('success', $count.' quotation line(s) updated from this takeoff. Internal costs were not copied.');
    }

    /**
     * @return array<string, bool>
     */
    private function abilities(User $user): array
    {
        return [
            'create' => TakeoffAccess::canCreate($user),
            'update' => TakeoffAccess::canUpdate($user),
            'delete' => TakeoffAccess::canDelete($user),
            'approve' => TakeoffAccess::canApprove($user),
            'pricing' => TakeoffAccess::canViewPricing($user),
            'export' => TakeoffAccess::canExport($user),
            'convert' => TakeoffAccess::canConvert($user),
        ];
    }

    /**
     * @return array{rows: list<array<string, mixed>>, errors: list<array{row: int, messages: list<string>}>}
     */
    private function parsedCsv(Request $request): array
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);
        $contents = file_get_contents($data['file']->getRealPath());

        if ($contents === false || $contents === '') {
            throw ValidationException::withMessages([
                'file' => 'The file is empty.',
            ]);
        }

        return TakeoffCsv::parse($contents);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<string>
     */
    private function duplicateMessages(Takeoff $takeoff, array $rows): array
    {
        $messages = [];
        $seen = [];
        $existing = $takeoff->openings()
            ->whereNotNull('tag')
            ->pluck('tag')
            ->map(fn ($tag): string => mb_strtolower(trim((string) $tag)))
            ->filter()
            ->countBy();

        foreach ($rows as $row) {
            $tag = mb_strtolower(trim((string) ($row['tag'] ?? '')));

            if ($tag === '') {
                continue;
            }

            $seen[$tag] = ($seen[$tag] ?? 0) + 1;

            if ($seen[$tag] === 2) {
                $messages[] = 'Row '.$row['row'].' repeats tag '.$row['tag'].' inside the file.';
            }

            if (($existing[$tag] ?? 0) > 0 && $seen[$tag] === 1) {
                $messages[] = 'Row '.$row['row'].' uses tag '.$row['tag'].', which is already on this takeoff.';
            }
        }

        return $messages;
    }
}
