<?php

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Quotation;
use App\Support\BidAccess;
use App\Support\ProjectAccess;
use App\Support\ProjectListVersion;
use App\Support\QuotationAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $canViewProjects = $user && ProjectAccess::canView($user);
        $canViewBids = $user && BidAccess::canView($user);
        $canViewQuotations = $user && QuotationAccess::canView($user);

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

        return Inertia::render('Dashboard', [
            'charts' => [
                'byStatus' => $canViewProjects ? $this->projectStatusChart() : [],
                'byPriority' => $canViewProjects ? $this->projectPriorityChart() : [],
                'quotations' => $canViewQuotations ? $this->quotationChart() : null,
                'bids' => $canViewBids ? $this->bidChart() : null,
            ],
            'listVersion' => $canViewProjects ? ProjectListVersion::current() : null,
            'stats' => $stats,
            'summary' => $canViewProjects ? $summary : null,
        ]);
    }

    /**
     * @return list<array{key: string, label: string, value: int}>
     */
    private function projectStatusChart(): array
    {
        $statusCounts = Project::query()
            ->selectRaw('project_status_id, COUNT(*) as project_count')
            ->groupBy('project_status_id')
            ->pluck('project_count', 'project_status_id');

        return ProjectStatus::query()
            ->orderBy('id')
            ->get()
            ->map(fn (ProjectStatus $status): array => [
                'key' => $status->slug,
                'label' => $status->name,
                'value' => (int) ($statusCounts[$status->id] ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{key: string, label: string, value: int}>
     */
    private function projectPriorityChart(): array
    {
        $priorityCounts = Project::query()
            ->selectRaw('priority, COUNT(*) as project_count')
            ->groupBy('priority')
            ->pluck('project_count', 'priority');

        $priorityLabels = [
            'low' => 'Low',
            'normal' => 'Normal',
            'high' => 'High',
            'urgent' => 'Urgent',
        ];

        return collect(Project::PRIORITIES)
            ->map(fn (string $priority): array => [
                'key' => $priority,
                'label' => $priorityLabels[$priority] ?? ucfirst($priority),
                'value' => (int) ($priorityCounts[$priority] ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{key: string, label: string, value: float, display: string}>
     */
    private function quotationChart(): array
    {
        $quotations = Quotation::query()->with('lineItems')->get();
        $grouped = $quotations->groupBy(
            fn (Quotation $quotation): string => $quotation->status ?: 'draft',
        );

        return collect(Quotation::STATUSES)
            ->map(function (string $status) use ($grouped): array {
                $rows = $grouped->get($status, collect());
                $amount = round((float) $rows->sum(fn (Quotation $quotation): float => $quotation->total()), 2);
                $count = $rows->count();

                return [
                    'key' => $status,
                    'label' => Quotation::statusLabel($status).' ('.$count.')',
                    'value' => $amount,
                    'display' => '$'.number_format($amount, 2),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<array{key: string, label: string, value: float, display: string}>
     */
    private function bidChart(): array
    {
        $bids = Bid::query()->with(['stages.type', 'scopes.products'])->get();
        $grouped = $bids->groupBy(
            fn (Bid $bid): string => $bid->stages->last()?->type?->name ?: 'No stage',
        );

        $stageNames = $grouped->keys()->sort(function (string $left, string $right): int {
            if ($left === 'No stage') {
                return 1;
            }

            if ($right === 'No stage') {
                return -1;
            }

            return strnatcasecmp($left, $right);
        });

        return $stageNames
            ->map(function (string $stageName) use ($grouped): array {
                $rows = $grouped->get($stageName, collect());
                $amount = round((float) $rows->sum(fn (Bid $bid): float => $bid->latestTotal()), 2);

                return [
                    'key' => Str::slug($stageName, '_') ?: 'stage',
                    'label' => $stageName.' ('.$rows->count().')',
                    'value' => $amount,
                    'display' => '$'.number_format($amount, 2),
                ];
            })
            ->values()
            ->all();
    }
}
