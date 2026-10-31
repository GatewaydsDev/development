<?php

namespace App\Support;

use App\Models\Bid;
use App\Models\ProjectControl;
use App\Models\Quotation;
use App\Models\Takeoff;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ProjectControlReport
{
    /** @var Collection<int|string, Bid> */
    private Collection $latestBids;

    /** @var Collection<int|string, Quotation> */
    private Collection $latestQuotations;

    /** @var Collection<int|string, Takeoff> */
    private Collection $latestTakeoffs;

    public function __construct()
    {
        $this->latestBids = collect();
        $this->latestQuotations = collect();
        $this->latestTakeoffs = collect();
    }

    /**
     * @return array{
     *     summary: array<string, int|string|null>,
     *     jobs: list<array<string, mixed>>,
     *     calls: list<array<string, mixed>>,
     *     unordered: list<array<string, mixed>>,
     *     deposits: list<array<string, mixed>>,
     *     payments: list<array<string, mixed>>
     * }
     */
    public function for(string $report, array $filters = []): array
    {
        $jobs = $this->jobs($filters);

        $active = $jobs->filter(fn (ProjectControl $job): bool => $job->isActive())->values();
        $weekEnd = now()->endOfWeek(Carbon::SUNDAY);
        $calls = $active
            ->filter(fn (ProjectControl $job): bool => $job->next_follow_up_date instanceof CarbonInterface
                && $job->next_follow_up_date->lte($weekEnd))
            ->sortBy(fn (ProjectControl $job): string => $job->next_follow_up_date?->toDateString() ?? '')
            ->values();

        $selected = match ($report) {
            'hold' => $jobs->filter(fn (ProjectControl $job): bool => in_array($job->pipeline_status, ['on_hold', 'lost'], true))->values(),
            'queue' => $active->sortBy(fn (ProjectControl $job): string => $job->next_follow_up_date?->toDateString() ?? '9999-12-31')->values(),
            'cash' => $active->sortByDesc(fn (ProjectControl $job): float => $job->currentValue())->values(),
            default => $active,
        };

        return [
            'summary' => $this->summary($jobs, $active, $calls),
            'jobs' => $selected->map(fn (ProjectControl $job): array => $this->job($job))->all(),
            'calls' => $report === 'queue' ? $calls->map(fn (ProjectControl $job): array => $this->job($job))->all() : [],
            'unordered' => $report === 'pipeline' ? $this->unordered($active) : [],
            'deposits' => $report === 'cash' ? $this->deposits($active) : [],
            'payments' => $report === 'cash' ? $this->payments($active) : [],
        ];
    }

    /**
     * @return array<string, list<list<string|int|float|null>>>
     */
    public function workbook(array $filters = []): array
    {
        $jobs = $this->jobs($filters);

        $pipeline = [['Job', 'Project', 'Bid', 'Quotation', 'Takeoff', 'Customer', 'Location', 'Current value', 'Direct cost', 'Profit', 'Margin %', 'Deposit due', 'Follow-up', 'Next step', 'Demonstrated']];
        $hold = [['Job', 'Project', 'Bid', 'Quotation', 'Takeoff', 'Customer', 'Status', 'Current value', 'Award', 'Status note', 'Next step']];
        $queue = [['Follow-up', 'Job', 'Project', 'Bid', 'Quotation', 'Takeoff', 'Customer', 'Current value', 'Next step', 'Cash flag']];
        $cash = [['Job', 'Project', 'Bid', 'Quotation', 'Takeoff', 'Current value', 'Material', 'Freight', 'Labor', 'Other', 'Direct cost', 'Profit', 'Margin %', 'Deposit due', 'Material payment', 'Customer payment']];
        $openings = [['Job', 'Project', 'Category', 'Description', 'Mark', 'Size', 'Qty', 'Requirement', 'Procurement status', 'Supplier', 'Unit sell', 'Notes']];
        $procurements = [['Job', 'Project', 'Assembly', 'Qty', 'Manufacturer', 'Quote', 'Quote date', 'Supplier cost', 'Order status', 'PO', 'Lead time', 'Next action']];

        foreach ($jobs as $job) {
            $row = $this->job($job);
            $connected = [
                $row['records']['bid'] ? 'Yes' : 'No',
                $row['records']['quotation'] ? 'Yes' : 'No',
                $row['records']['takeoff'] ? 'Yes' : 'No',
            ];

            if ($job->isActive()) {
                $pipeline[] = [$row['job_code'], $row['name'], ...$connected, $row['customer'], $row['location'], $this->number($row['current_value']), $this->number($row['direct_cost']), $this->number($row['profit']), $this->number($row['margin']), $this->number($row['deposit_due']), $row['next_follow_up_date'], $row['next_step'], $job->counts_in_demonstrated ? 'Yes' : ''];
                $queue[] = [$row['next_follow_up_date'], $row['job_code'], $row['name'], ...$connected, $row['customer'], $this->number($row['current_value']), $row['next_step'], $row['cash_flag']];
                $cash[] = [$row['job_code'], $row['name'], ...$connected, $this->number($row['current_value']), $this->number($row['material_cost']), $this->number($row['freight_cost']), $this->number($row['labor_cost']), $this->number($row['other_cost']), $this->number($row['direct_cost']), $this->number($row['profit']), $this->number($row['margin']), $this->number($row['deposit_due']), $row['material_payment_date'], $row['customer_payment_date']];
            } else {
                $hold[] = [$row['job_code'], $row['name'], ...$connected, $row['customer'], ProjectControl::STATUSES[$job->pipeline_status] ?? $job->pipeline_status, $this->number($row['current_value']), $row['award_status'], $row['status_note'], $row['next_step']];
            }

            foreach ($job->openings as $opening) {
                $openings[] = [$job->job_code, $job->name, $opening->category, $opening->description, $opening->mark, $opening->size, $this->number($opening->quantity), $opening->requirement, $opening->procurement_status, $opening->supplier, $this->number($opening->unit_sell), $opening->notes];
            }

            foreach ($job->procurements as $procurement) {
                $procurements[] = [$job->job_code, $job->name, $procurement->assembly, $this->number($procurement->quantity), $procurement->manufacturer, $procurement->quote_number, $procurement->quoted_on?->toDateString(), $this->number($procurement->supplier_cost), $procurement->order_status, $procurement->po_number, $procurement->lead_time, $procurement->next_action];
            }
        }

        return [
            'Pipeline' => $pipeline,
            'Lost and on hold' => $hold,
            'Action queue' => $queue,
            'Cash' => $cash,
            'Openings' => $openings,
            'Procurement' => $procurements,
        ];
    }

    /**
     * @param  array{search?: string, start?: string, end?: string}  $filters
     * @return Collection<int, ProjectControl>
     */
    private function jobs(array $filters): Collection
    {
        $jobs = ProjectControl::query()
            ->with(['openings.takeoffOpening.takeoff', 'procurements', 'project'])
            ->get()
            ->sortBy(fn (ProjectControl $job): string => $job->job_code, SORT_NATURAL)
            ->values();

        $this->rememberRecords($jobs);

        $search = mb_strtolower(trim((string) ($filters['search'] ?? '')));
        $start = (string) ($filters['start'] ?? '');
        $end = (string) ($filters['end'] ?? '');

        return $jobs
            ->filter(function (ProjectControl $job) use ($search, $start, $end): bool {
                if ($search !== '') {
                    $haystack = mb_strtolower(implode(' ', array_filter([
                        $job->job_code,
                        $job->name,
                        $job->customer,
                        $job->location,
                        $job->next_step,
                    ])));

                    if (! str_contains($haystack, $search)) {
                        return false;
                    }
                }

                if ($start === '' && $end === '') {
                    return true;
                }

                $date = $job->next_follow_up_date?->toDateString();

                if ($date === null) {
                    return false;
                }

                if ($start !== '' && $date < $start) {
                    return false;
                }

                return $end === '' || $date <= $end;
            })
            ->values();
    }

    /**
     * @param  Collection<int, ProjectControl>  $jobs
     * @param  Collection<int, ProjectControl>  $active
     * @param  Collection<int, ProjectControl>  $calls
     * @return array<string, int|string|null>
     */
    private function summary(Collection $jobs, Collection $active, Collection $calls): array
    {
        $known = $active->filter(fn (ProjectControl $job): bool => $job->directCost() !== null);
        $knownValue = round((float) $known->sum(fn (ProjectControl $job): float => $job->currentValue()), 2);
        $knownCost = round((float) $known->sum(fn (ProjectControl $job): float => (float) $job->directCost()), 2);
        $demonstrated = $jobs->filter(fn (ProjectControl $job): bool => $job->counts_in_demonstrated);

        return [
            'pipeline_value' => $this->money((float) $active->sum(fn (ProjectControl $job): float => $job->currentValue())),
            'demonstrated_value' => $this->money((float) $demonstrated->sum(fn (ProjectControl $job): float => $job->currentValue())),
            'known_cost' => $this->money($knownCost),
            'known_profit' => $this->money(round($knownValue - $knownCost, 2)),
            'known_margin' => $knownValue > 0 ? number_format(($knownValue - $knownCost) / $knownValue * 100, 2, '.', '') : null,
            'deposits_due' => $this->money(round((float) $active->sum(fn (ProjectControl $job): float => (float) ($job->depositDue() ?? 0)), 2)),
            'unordered_openings' => $this->unorderedCount($active),
            'calls_this_week' => $calls->count(),
            'active_count' => $active->count(),
            'hold_count' => $jobs->where('pipeline_status', 'on_hold')->count(),
            'lost_count' => $jobs->where('pipeline_status', 'lost')->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function job(ProjectControl $job): array
    {
        return [
            'uuid' => $job->uuid,
            'job_code' => $job->job_code,
            'name' => $job->name,
            'customer' => $job->customer,
            'location' => $job->location,
            'pipeline_status' => $job->pipeline_status,
            'status_note' => $this->plain($job->status_note),
            'award_status' => $job->award_status,
            'current_value' => $job->current_value === null || $job->current_value === ''
                ? null
                : $this->money($job->currentValue()),
            'material_cost' => $this->nullableMoney($job->material_cost),
            'freight_cost' => $this->nullableMoney($job->freight_cost),
            'labor_cost' => $this->nullableMoney($job->labor_cost),
            'other_cost' => $this->nullableMoney($job->other_cost),
            'direct_cost' => $this->nullableMoney($job->directCost()),
            'profit' => $this->nullableMoney($job->grossProfit()),
            'margin' => $job->marginPercent() === null ? null : number_format((float) $job->marginPercent(), 2, '.', ''),
            'deposit_due' => $this->nullableMoney($job->depositDue()),
            'next_follow_up_date' => $job->next_follow_up_date?->toDateString(),
            'next_step' => $this->plain($job->next_step),
            'cash_flag' => $job->cash_flag,
            'material_payment_date' => $job->material_payment_date?->toDateString(),
            'customer_payment_date' => $job->customer_payment_date?->toDateString(),
            'counts_in_demonstrated' => $job->counts_in_demonstrated,
            'project' => $job->project ? route('admin.projects.show', $job->project) : null,
            'project_edit' => $job->project ? route('admin.projects.edit', $job->project) : null,
            'records' => $this->records($job),
        ];
    }

    /**
     * @param  Collection<int, ProjectControl>  $active
     * @return list<array<string, mixed>>
     */
    private function unordered(Collection $active): array
    {
        $rows = [];

        foreach ($active as $job) {
            foreach ($job->openings as $opening) {
                if (! $opening->countsAsUnordered()) {
                    continue;
                }

                $rows[] = [
                    'uuid' => $job->uuid,
                    'job_code' => $job->job_code,
                    'name' => $job->name,
                    'item' => $opening->description,
                    'status' => $opening->procurement_status ?: 'Not ordered',
                    'kind' => 'Opening',
                ];
            }

            foreach ($job->procurements as $procurement) {
                if (! $procurement->countsAsUnordered()) {
                    continue;
                }

                $rows[] = [
                    'uuid' => $job->uuid,
                    'job_code' => $job->job_code,
                    'name' => $job->name,
                    'item' => $procurement->assembly,
                    'status' => $procurement->order_status ?: 'Not ordered',
                    'kind' => 'Procurement',
                ];
            }
        }

        return $rows;
    }

    /**
     * @param  Collection<int, ProjectControl>  $active
     */
    private function unorderedCount(Collection $active): int
    {
        return count($this->unordered($active));
    }

    /**
     * @param  Collection<int, ProjectControl>  $active
     * @return list<array<string, mixed>>
     */
    private function deposits(Collection $active): array
    {
        return $active
            ->filter(fn (ProjectControl $job): bool => $job->depositDue() !== null)
            ->map(fn (ProjectControl $job): array => [
                'uuid' => $job->uuid,
                'job_code' => $job->job_code,
                'name' => $job->name,
                'customer' => $job->customer,
                'amount' => $this->money((float) $job->depositDue()),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, ProjectControl>  $active
     * @return list<array<string, mixed>>
     */
    private function payments(Collection $active): array
    {
        $rows = [];

        foreach ($active as $job) {
            if ($job->material_payment_date !== null) {
                $rows[] = [
                    'uuid' => $job->uuid,
                    'date' => $job->material_payment_date->toDateString(),
                    'kind' => 'Material',
                    'job_code' => $job->job_code,
                    'name' => $job->name,
                    'customer' => $job->customer,
                    'amount' => $this->nullableMoney($job->material_cost),
                ];
            }

            if ($job->customer_payment_date !== null) {
                $rows[] = [
                    'uuid' => $job->uuid,
                    'date' => $job->customer_payment_date->toDateString(),
                    'kind' => 'Customer',
                    'job_code' => $job->job_code,
                    'name' => $job->name,
                    'customer' => $job->customer,
                    'amount' => $this->money($job->currentValue()),
                ];
            }
        }

        usort($rows, fn (array $left, array $right): int => $left['date'] <=> $right['date']);

        return $rows;
    }

    /**
     * @param  Collection<int, ProjectControl>  $jobs
     */
    private function rememberRecords(Collection $jobs): void
    {
        $projectIds = $jobs->pluck('project_id')->filter()->unique()->values()->all();
        $this->latestBids = $this->latest(Bid::class, $projectIds);
        $this->latestQuotations = $this->latest(Quotation::class, $projectIds);
        $this->latestTakeoffs = $this->latest(Takeoff::class, $projectIds);
    }

    /**
     * @param  class-string<Bid|Quotation|Takeoff>  $model
     * @param  list<int>  $projectIds
     * @return Collection<int|string, Bid|Quotation|Takeoff>
     */
    private function latest(string $model, array $projectIds): Collection
    {
        if ($projectIds === []) {
            return collect();
        }

        return $model::query()
            ->whereIn('project_id', $projectIds)
            ->orderByDesc('id')
            ->get()
            ->unique('project_id')
            ->keyBy('project_id');
    }

    /**
     * @return array{bid: ?string, quotation: ?string, takeoff: ?string}
     */
    private function records(ProjectControl $job): array
    {
        $projectId = $job->project_id;
        $bid = $projectId ? $this->latestBids->get($projectId) : null;
        $quotation = $projectId ? $this->latestQuotations->get($projectId) : null;
        $takeoff = $projectId ? $this->latestTakeoffs->get($projectId) : null;

        if (! $takeoff instanceof Takeoff) {
            $takeoff = $job->openings
                ->map(fn ($opening) => $opening->takeoffOpening?->takeoff)
                ->filter(fn ($linked) => $linked instanceof Takeoff)
                ->sortByDesc('id')
                ->first();
        }

        return [
            'bid' => $bid instanceof Bid ? route('admin.bids.show', $bid) : null,
            'quotation' => $quotation instanceof Quotation ? route('admin.quotations.show', $quotation) : null,
            'takeoff' => $takeoff instanceof Takeoff ? route('admin.takeoffs.show', $takeoff) : null,
        ];
    }

    private function plain(?string $value): ?string
    {
        $text = trim(html_entity_decode(strip_tags((string) $value)));

        return $text === '' ? null : $text;
    }

    private function money(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }

    private function nullableMoney(mixed $amount): ?string
    {
        if ($amount === null || $amount === '') {
            return null;
        }

        return number_format((float) $amount, 2, '.', '');
    }

    private function number(mixed $amount): string|float|null
    {
        if ($amount === null || $amount === '') {
            return null;
        }

        return (float) $amount;
    }
}
