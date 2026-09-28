<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Admin\ProjectController;
use App\Models\Bid;
use App\Models\Project;
use App\Models\Quotation;
use App\Support\BidAccess;
use App\Support\ProjectAccess;
use App\Support\QuotationAccess;
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

        $money = fn (float $amount): string => '$'.number_format($amount, 2);

        $canViewBudgets = $user && ProjectAccess::canViewSensitiveFields($user);
        $summary = [
            'projects' => $canViewBudgets
                ? $money(round((float) Project::query()->sum('budget_amount'), 2))
                : null,
            'activeProjects' => $canViewBudgets
                ? $money(round((float) Project::query()
                    ->whereHas('status', fn ($query) => $query->whereNotIn('slug', ['completed', 'cancelled']))
                    ->sum('budget_amount'), 2))
                : null,
            'bids' => null,
            'quotations' => null,
            'quotationStatuses' => [],
        ];

        if ($user && BidAccess::canView($user)) {
            $bidTotal = Bid::query()
                ->with('scopes.products')
                ->get()
                ->sum(fn (Bid $bid): float => $bid->latestTotal());

            $summary['bids'] = $money(round((float) $bidTotal, 2));
        }

        if ($user && QuotationAccess::canView($user)) {
            $quotations = Quotation::query()->with('lineItems')->get();
            $quotationTotal = $quotations->sum(fn (Quotation $quotation): float => $quotation->total());
            $quotationsByStatus = $quotations->groupBy(
                fn (Quotation $quotation): string => $quotation->status ?: 'draft',
            );

            $summary['quotations'] = $money(round((float) $quotationTotal, 2));
            $summary['quotationStatuses'] = collect(Quotation::STATUSES)
                ->map(function (string $status) use ($money, $quotationsByStatus): array {
                    $statusTotal = $quotationsByStatus
                        ->get($status, collect())
                        ->sum(fn (Quotation $quotation): float => $quotation->total());

                    return [
                        'status' => $status,
                        'label' => Quotation::statusLabel($status),
                        'total' => $money(round((float) $statusTotal, 2)),
                    ];
                })
                ->values()
                ->all();
        }

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
            'summary' => $canViewProjects ? $summary : null,
        ]);
    }
}
