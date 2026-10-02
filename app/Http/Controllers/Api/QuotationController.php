<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Admin\QuotationController as AdminQuotationController;
use App\Http\Controllers\Controller;
use App\Models\Quotation;
use App\Models\User;
use App\Support\QuotationListVersion;
use App\Support\UserPrivileges;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QuotationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizeQuotation($request, 'view-quotations');
        $perPage = min(100, max(1, $request->integer('per_page', 15)));

        $quotations = $this->admin()->listingQuery((string) $request->query('search', ''))
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (Quotation $quotation): array => $this->admin()->quotationPayload($quotation, summary: true));

        return response()->json([
            'data' => $quotations->items(),
            'meta' => [
                'current_page' => $quotations->currentPage(),
                'from' => $quotations->firstItem(),
                'last_page' => $quotations->lastPage(),
                'per_page' => $quotations->perPage(),
                'to' => $quotations->lastItem(),
                'total' => $quotations->total(),
                'version' => QuotationListVersion::current(),
            ],
            'can' => $this->capabilities($user),
        ]);
    }

    public function version(Request $request): JsonResponse
    {
        $this->authorizeQuotation($request, 'view-quotations');

        return response()->json([
            'version' => QuotationListVersion::current(),
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $user = $this->authorizeQuotation($request, 'view-quotations');

        return response()->json([
            'options' => $this->admin()->options($user),
            'can' => $this->capabilities($user),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeQuotation($request, 'create-quotations');
        $validated = $this->admin()->validatedQuotation($request);

        $quotation = DB::transaction(function () use ($user, $validated): Quotation {
            $quotation = Quotation::create([
                'contractor_id' => $validated['contractor_id'],
                'project_id' => $validated['project_id'] ?? null,
                'title' => $validated['title'],
                'status' => $validated['status'],
                'quoted_at' => $validated['quoted_at'] ?? null,
                'valid_until' => $validated['valid_until'] ?? null,
                'notes' => $validated['notes'] ?? null,
                ...$this->admin()->proposalTitleAttributes($validated),
                'pricing_conditions' => $validated['pricing_conditions'] ?? null,
                'pricing_basis' => $validated['pricing_basis'] ?? null,
                ...$this->admin()->authorizationAttributes($validated),
                'created_by' => $user->id,
            ]);

            $this->admin()->syncLineItems($quotation, $validated['line_items'] ?? []);
            $this->admin()->syncContacts($quotation, $validated['contact_ids'] ?? []);
            $this->admin()->syncRevisions($quotation, $validated['revisions'] ?? [], $user);
            $this->admin()->syncFieldTables($quotation, $validated['field_tables'] ?? []);

            return $quotation;
        });

        return response()->json([
            'quotation' => $this->quotationPayload($quotation),
            'can' => $this->capabilities($user),
        ], 201);
    }

    public function show(Request $request, Quotation $quotation): JsonResponse
    {
        $user = $this->authorizeQuotation($request, 'view-quotations');

        return response()->json([
            'quotation' => $this->quotationPayload($quotation),
            'can' => $this->capabilities($user),
        ]);
    }

    public function update(Request $request, Quotation $quotation): JsonResponse
    {
        $user = $this->authorizeQuotation($request, 'update-quotations');
        $validated = $this->admin()->validatedQuotation($request, $quotation);

        DB::transaction(function () use ($quotation, $user, $validated): void {
            $quotation->update([
                'contractor_id' => $validated['contractor_id'],
                'project_id' => $validated['project_id'] ?? null,
                'title' => $validated['title'],
                'status' => $validated['status'],
                'quoted_at' => $validated['quoted_at'] ?? null,
                'valid_until' => $validated['valid_until'] ?? null,
                'notes' => $validated['notes'] ?? null,
                ...$this->admin()->proposalTitleAttributes($validated),
                'pricing_conditions' => $validated['pricing_conditions'] ?? null,
                'pricing_basis' => $validated['pricing_basis'] ?? null,
                ...$this->admin()->authorizationAttributes($validated, $quotation),
            ]);

            $this->admin()->syncLineItems($quotation, $validated['line_items'] ?? []);
            $this->admin()->syncContacts($quotation, $validated['contact_ids'] ?? []);
            $this->admin()->syncRevisions($quotation, $validated['revisions'] ?? [], $user);
            $this->admin()->syncFieldTables($quotation, $validated['field_tables'] ?? []);
        });

        return response()->json([
            'quotation' => $this->quotationPayload($quotation->refresh()),
            'can' => $this->capabilities($user),
        ]);
    }

    private function authorizeQuotation(Request $request, string $permission): User
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
            'view' => UserPrivileges::allows($user, 'view-quotations'),
            'create' => UserPrivileges::allows($user, 'create-quotations'),
            'update' => UserPrivileges::allows($user, 'update-quotations'),
            'delete' => UserPrivileges::allows($user, 'delete-quotations'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function quotationPayload(Quotation $quotation): array
    {
        $quotation->load([
            'contractor.contacts',
            'contacts',
            'project',
            'lineItems',
            'convertedBid',
            'creator:id,name,signature_path',
            'revisions.user:id,name',
            'tables.fields.field',
            'tables.fields.product',
        ]);

        return $this->admin()->quotationPayload($quotation);
    }

    private function admin(): AdminQuotationController
    {
        return app(AdminQuotationController::class);
    }
}
