<?php

namespace App\Support;

use App\Models\Bid;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Quotation;
use App\Models\User;
use Illuminate\Support\Str;

class DashboardSnapshot
{
    /**
     * @return array{
     *     charts: array{
     *         byStatus: list<array{key: string, label: string, value: int}>,
     *         byPriority: list<array{key: string, label: string, value: int}>,
     *         quotations: list<array{key: string, label: string, value: float, display: string}>|null,
     *         bids: list<array{key: string, label: string, value: float, display: string}>|null
     *     },
     *     listVersion: string|null,
     *     bidListVersion: string|null,
     *     quotationListVersion: string|null,
     *     stats: array{totalProjects: int, activeProjects: int},
     *     summary: array{
     *         projects: string|null,
     *         activeProjects: string|null,
     *         bids: string|null,
     *         quotations: string|null,
     *         quotationStatuses: list<array{status: string, label: string, total: string}>
     *     }|null,
     *     counts: array{projects: int|null, activeProjects: int|null, bids: int|null, quotations: int|null}
     * }
     */
    public static function for(User $user): array
    {
        $canViewProjects = ProjectAccess::canView($user);
        $canViewBids = BidAccess::canView($user);
        $canViewQuotations = QuotationAccess::canView($user);
        $canViewBudgets = ProjectAccess::canViewSensitiveFields($user);

        $stats = [
            'totalProjects' => Project::query()->count(),
            'activeProjects' => Project::query()
                ->whereHas('status', fn ($query) => $query->whereNotIn('slug', ['completed', 'cancelled']))
                ->count(),
        ];

        $money = fn (float $amount): string => '$'.number_format($amount, 2);

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

        if ($canViewBids) {
            $bidTotal = Bid::query()
                ->with('scopes.products')
                ->get()
                ->sum(fn (Bid $bid): float => $bid->latestTotal());

            $summary['bids'] = $money(round((float) $bidTotal, 2));
        }

        if ($canViewQuotations) {
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

        return [
            'charts' => [
                'byStatus' => $canViewProjects ? self::projectStatusChart() : [],
                'byPriority' => $canViewProjects ? self::projectPriorityChart() : [],
                'quotations' => $canViewQuotations ? self::quotationChart() : null,
                'bids' => $canViewBids ? self::bidChart() : null,
            ],
            'listVersion' => $canViewProjects ? ProjectListVersion::current() : null,
            'bidListVersion' => $canViewBids ? BidListVersion::current() : null,
            'quotationListVersion' => $canViewQuotations ? QuotationListVersion::current() : null,
            'stats' => $stats,
            'summary' => $canViewProjects ? $summary : null,
            'counts' => [
                'projects' => $canViewProjects ? $stats['totalProjects'] : null,
                'activeProjects' => $canViewProjects ? $stats['activeProjects'] : null,
                'bids' => $canViewBids ? Bid::query()->count() : null,
                'quotations' => $canViewQuotations ? Quotation::query()->count() : null,
            ],
        ];
    }

    /**
     * @return list<array{key: string, label: string, value: int}>
     */
    private static function projectStatusChart(): array
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
    private static function projectPriorityChart(): array
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
    private static function quotationChart(): array
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
    private static function bidChart(): array
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
