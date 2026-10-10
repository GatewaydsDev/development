<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Admin\BidController as AdminBidController;
use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\User;
use App\Support\BidListVersion;
use App\Support\UserPrivileges;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BidController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizeBid($request, 'view-bids');
        $perPage = min(100, max(1, $request->integer('per_page', 15)));

        $bids = $this->admin()->bidListingQuery($request)
            ->latest()
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (Bid $bid): array => $this->admin()->bidPayload($bid, summary: true));

        return response()->json([
            'data' => $bids->items(),
            'meta' => [
                'current_page' => $bids->currentPage(),
                'from' => $bids->firstItem(),
                'last_page' => $bids->lastPage(),
                'per_page' => $bids->perPage(),
                'to' => $bids->lastItem(),
                'total' => $bids->total(),
                'version' => BidListVersion::current(),
            ],
            'can' => $this->capabilities($user),
        ]);
    }

    public function version(Request $request): JsonResponse
    {
        $this->authorizeBid($request, 'view-bids');

        return response()->json([
            'version' => BidListVersion::current(),
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $user = $this->authorizeBid($request, 'view-bids');

        return response()->json([
            'options' => $this->admin()->options($user),
            'can' => $this->capabilities($user),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeBid($request, 'create-bids');
        $validated = $this->admin()->validatedBid($request);

        $bid = DB::transaction(function () use ($user, $validated): Bid {
            $bid = Bid::create([
                'project_id' => $validated['project_id'],
                'quotation_id' => $validated['quotation_id'] ?? null,
                'assigned_to' => $validated['assigned_to'] ?? null,
                'notes' => $this->admin()->shippingText($validated),
                'print_layout_version' => $validated['print_layout_version'] ?? null,
                'print_layout_id' => $validated['print_layout_id'] ?? null,
                'bid_shipping_text_template_id' => $validated['bid_shipping_text_template_id'] ?? null,
                'bid_scope_text_template_id' => $validated['bid_scope_text_template_id'] ?? null,
                'scope_of_work_text' => $this->admin()->scopeOfWorkText($validated),
                'created_by' => $user->id,
            ]);

            $this->admin()->syncBidRelations($bid, $validated, $user);

            return $bid;
        });

        return response()->json([
            'bid' => $this->bidPayload($bid),
            'can' => $this->capabilities($user),
        ], 201);
    }

    public function show(Request $request, Bid $bid): JsonResponse
    {
        $user = $this->authorizeBid($request, 'view-bids');

        return response()->json([
            'bid' => $this->bidPayload($bid),
            'can' => $this->capabilities($user),
        ]);
    }

    public function update(Request $request, Bid $bid): JsonResponse
    {
        $user = $this->authorizeBid($request, 'update-bids');
        $validated = $this->admin()->validatedBid($request, $bid);

        DB::transaction(function () use ($bid, $user, $validated): void {
            $bid->fill([
                'project_id' => $validated['project_id'],
                'quotation_id' => $validated['quotation_id'] ?? null,
                'assigned_to' => $validated['assigned_to'] ?? null,
                'notes' => $this->admin()->shippingText($validated, $bid),
                'print_layout_version' => $validated['print_layout_version'] ?? $bid->print_layout_version,
                'print_layout_id' => array_key_exists('print_layout_id', $validated) ? $validated['print_layout_id'] : $bid->print_layout_id,
                'bid_shipping_text_template_id' => $validated['bid_shipping_text_template_id'] ?? null,
                'bid_scope_text_template_id' => $validated['bid_scope_text_template_id'] ?? null,
                'scope_of_work_text' => $this->admin()->scopeOfWorkText($validated, $bid),
            ])->save();

            $this->admin()->syncBidRelations($bid, $validated, $user);
        });

        return response()->json([
            'bid' => $this->bidPayload($bid),
            'can' => $this->capabilities($user),
        ]);
    }

    private function authorizeBid(Request $request, string $permission): User
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
            'view' => UserPrivileges::allows($user, 'view-bids'),
            'create' => UserPrivileges::allows($user, 'create-bids'),
            'update' => UserPrivileges::allows($user, 'update-bids'),
            'delete' => UserPrivileges::allows($user, 'delete-bids'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function bidPayload(Bid $bid): array
    {
        $bid->load([
            'project:id,name,project_number,site_address_line_1,site_address_line_2,site_city,site_state,site_postal_code,site_country',
            'project.contractors.contacts',
            'quotation:id,quotation_number,title',
            'creator:id,name',
            'assignee:id,name',
            'stages.type',
            'scopes.title',
            'scopes.products.product',
            'scopes.products.service',
            'pricings.items.status',
            'revisions.user:id,name',
        ]);

        return $this->admin()->bidPayload($bid);
    }

    private function admin(): AdminBidController
    {
        return app(AdminBidController::class);
    }
}
