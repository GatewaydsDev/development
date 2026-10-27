<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AuthorizesTakeoffs;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Project;
use App\Models\Quotation;
use App\Models\Takeoff;
use App\Models\TakeoffAssemblyTemplate;
use App\Models\TakeoffOpening;
use App\Models\User;
use App\Support\TakeoffAccess;
use App\Support\TakeoffConversion;
use App\Support\TakeoffCsv;
use App\Support\TakeoffMoney;
use App\Support\TakeoffNamer;
use App\Support\TakeoffPdfScope;
use App\Support\TakeoffPresenter;
use App\Support\TakeoffScopeImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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
            'projects' => Project::query()->orderBy('name')->get(['id', 'name', 'project_number']),
            'projectId' => $request->integer('project_id') ?: null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canCreate($user), 403);
        TakeoffPdfScope::assertUploaded($request->file('file'));

        $data = $request->validate([
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'title' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'file' => ['nullable', 'file', 'mimes:pdf', 'max:'.config('takeoffs.max_kilobytes')],
        ]);

        $file = $request->file('file');

        if ($file) {
            TakeoffPdfScope::assertPdf($file);
        }

        $project = Project::query()->findOrFail($data['project_id']);
        $providedTitle = trim((string) ($data['title'] ?? ''));
        $takeoff = Takeoff::query()->create([
            'project_id' => $project->id,
            'title' => $providedTitle !== '' ? $providedTitle : TakeoffNamer::title($project),
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

            if ($providedTitle === '') {
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

        return redirect()
            ->route('admin.takeoffs.show', $takeoff)
            ->with('success', TakeoffScopeImporter::createdMessage($file !== null, $import, $scope));
    }

    public function show(Request $request, Takeoff $takeoff): InertiaResponse
    {
        $user = $this->takeoffUser($request);
        abort_unless(TakeoffAccess::canView($user), 403);

        $quotations = TakeoffAccess::canConvert($user)
            ? Quotation::query()
                ->where('project_id', $takeoff->project_id)
                ->orderByDesc('id')
                ->get(['id', 'uuid', 'quotation_number', 'title', 'status'])
            : collect();

        return Inertia::render('Admin/Takeoffs/Show', [
            'takeoff' => TakeoffPresenter::detail($takeoff, $user),
            'templates' => TakeoffAssemblyTemplate::query()->orderBy('name')->get()->map(fn (TakeoffAssemblyTemplate $template): array => [
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
            'quotations' => $quotations->map(fn (Quotation $quotation): array => [
                'id' => $quotation->id,
                'number' => $quotation->quotation_number,
                'title' => $quotation->title,
                'status' => $quotation->status,
            ])->values()->all(),
            'can' => $this->abilities($user),
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
            'notes' => ['nullable', 'string', 'max:5000'],
            'status' => ['required', Rule::in(config('takeoffs.statuses'))],
            'pricing_method' => ['nullable', Rule::in(config('takeoffs.pricing_methods'))],
            'markup_percent' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'margin_percent' => ['nullable', 'numeric', 'min:0', 'max:99.99'],
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
        }

        $takeoff->fill($changes)->save();
        $action = $data['status'] === 'approved' && $takeoff->wasChanged('approved_at')
            ? 'takeoff.approved'
            : 'takeoff.updated';
        $summary = $action === 'takeoff.approved'
            ? 'Takeoff was approved internally. Approval does not certify product compliance.'
            : 'Takeoff details were updated.';
        $takeoff->record($user, $action, $summary, ['status' => $takeoff->status]);

        return back()->with('success', $summary);
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
        $takeoff->record($user, 'import.completed', count($parsed['rows']).' opening(s) imported from a spreadsheet.', [
            'duplicate_mode' => $mode,
            'duplicates' => $duplicates,
        ]);

        return back()->with('success', count($parsed['rows']).' opening(s) imported.');
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
