import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ActionHint from '@/Components/ActionHint';
import DirectoryFieldLabel from '@/Components/DirectoryFieldLabel';
import PaginationNav from '@/Components/PaginationNav';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Head, Link, router } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import {
    ClipboardListIcon,
    DollarSignIcon,
    EditIcon,
    EyeIcon,
    FileTextIcon,
    FileTypeIcon,
    PlusIcon,
    PrinterIcon,
    SearchIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import {
    formatMoney,
    type BidListSummary,
    type BidOptions,
    type BidPayload,
    type BidScopePayload,
    type BidsPaginator,
} from './types';

type IndexProps = {
    filters: {
        search?: string;
        highlight?: number | null;
    };
    options: BidOptions;
    summary?: BidListSummary;
    bids: BidsPaginator;
};

export default function Index({ filters, options, summary, bids }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const highlightedBidId = filters.highlight ?? null;

    useEffect(() => {
        if (!highlightedBidId) {
            return;
        }

        const rows = document.querySelectorAll<HTMLElement>(
            `[data-bid-row="${highlightedBidId}"]`,
        );
        const visibleRow =
            Array.from(rows).find((row) => row.offsetParent !== null) ??
            rows[0];

        visibleRow?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlightedBidId]);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.bids.index'),
            { search },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const exportQuery = {
        search: search || undefined,
    };

    const bidDirectoryColumns = 'grid-cols-5';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">Bids</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Bids
                        </h2>
                    </div>

                    {options.can.create && (
                        <Button asChild>
                            <Link href={route('admin.bids.create')}>
                                <PlusIcon className="size-4" />
                                Add bid
                            </Link>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Bids" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ClipboardListIcon className="size-4 text-muted-foreground" />
                                    Total bids
                                </CardTitle>
                                <CardDescription>
                                    Current records in the system.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {bids.total}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <DollarSignIcon className="size-4 text-muted-foreground" />
                                    Total bid value
                                </CardTitle>
                                <CardDescription>
                                    Combined value of matching bids.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold text-emerald-700 dark:text-emerald-300">
                                    {summary?.formatted_total_amount ?? formatMoney(0)}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Bid directory</CardTitle>
                                <CardDescription>
                                    Search by project, stage, or scope of work.
                                </CardDescription>
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:w-auto">
                                <form
                                    onSubmit={submit}
                                    className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
                                >
                                    <div className="relative">
                                        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            value={search}
                                            onChange={(event) =>
                                                setSearch(event.target.value)
                                            }
                                            placeholder="Search bids"
                                            className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground sm:w-64"
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        className="h-11 min-w-[8.5rem] bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                                    >
                                        Search
                                    </Button>
                                </form>
                                <div className="flex flex-wrap gap-2 sm:justify-end">
                                    <Button variant="outline" asChild>
                                        <a
                                            href={route(
                                                'admin.bids.list.print',
                                                exportQuery,
                                            )}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <PrinterIcon className="size-4" />
                                            Print
                                        </a>
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <a
                                            href={route(
                                                'admin.bids.list.export.pdf',
                                                exportQuery,
                                            )}
                                        >
                                            <FileTextIcon className="size-4" />
                                            PDF
                                        </a>
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <a
                                            href={route(
                                                'admin.bids.list.export.word',
                                                exportQuery,
                                            )}
                                        >
                                            <FileTextIcon className="size-4" />
                                            Word 2026
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                {bids.data.length > 0 ? (
                                    <>
                                        <div className="lg:hidden">
                                            {bids.data.map((bid) => (
                                                <div
                                                    data-bid-row={bid.id}
                                                    key={bid.id}
                                                    className={cn(
                                                        'grid gap-3 border-b border-border px-4 py-4 last:border-b-0',
                                                        highlightedBidId ===
                                                            bid.id &&
                                                            'bg-emerald-50 dark:bg-emerald-950/30',
                                                    )}
                                                >
                                                    <BidProjectCell bid={bid} />
                                                    <div className="min-w-0">
                                                        <DirectoryFieldLabel>
                                                            Stage
                                                        </DirectoryFieldLabel>
                                                        <BidStageCell
                                                            stage={
                                                                bid.current_stage
                                                            }
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <DirectoryFieldLabel>
                                                            Scope
                                                        </DirectoryFieldLabel>
                                                        <BidScopeCell
                                                            scopes={bid.scopes}
                                                        />
                                                    </div>
                                                    <div className="font-medium tabular-nums text-foreground">
                                                        <DirectoryFieldLabel>
                                                            Pricing
                                                        </DirectoryFieldLabel>
                                                        {formatMoney(
                                                            bid.latest_total,
                                                        )}
                                                    </div>
                                                    <div className="flex min-w-0 flex-col gap-1">
                                                        <DirectoryFieldLabel>
                                                            Actions
                                                        </DirectoryFieldLabel>
                                                        <BidDirectoryActions
                                                            bidId={bid.id}
                                                            canUpdate={
                                                                options.can
                                                                    .update
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            ))}

                                            {summary && summary.stages.length > 0 && (
                                                <div className="border-t-2 border-border bg-muted/30 p-4">
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                            Summary by Bid Stage
                                                        </h4>
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            {summary.total_count}{' '}
                                                            {summary.total_count === 1 ? 'bid' : 'bids'}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {summary.stages.map((stage) => (
                                                            <div
                                                                key={stage.stage}
                                                                className="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2 text-sm"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-xs font-medium"
                                                                    >
                                                                        {stage.stage}
                                                                    </Badge>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        ({stage.count}{' '}
                                                                        {stage.count === 1 ? 'bid' : 'bids'})
                                                                    </span>
                                                                </div>
                                                                <span className="font-semibold tabular-nums text-foreground">
                                                                    {stage.formatted_total}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 font-bold">
                                                            <span className="text-foreground">Total</span>
                                                            <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                                                {summary.formatted_total_amount}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            className={cn(
                                                'hidden w-full lg:grid',
                                                bidDirectoryColumns,
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    'col-span-5 grid grid-cols-subgrid items-center gap-x-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                                                )}
                                            >
                                                <div>Project</div>
                                                <div>Stage</div>
                                                <div>Scope</div>
                                                <div>Pricing</div>
                                                <div>Actions</div>
                                            </div>
                                            {bids.data.map((bid) => (
                                                <div
                                                    data-bid-row={bid.id}
                                                    key={bid.id}
                                                    className={cn(
                                                        'col-span-5 grid grid-cols-subgrid items-center gap-x-4 border-b border-border px-4 py-4 last:border-b-0',
                                                        highlightedBidId ===
                                                            bid.id &&
                                                            'bg-emerald-50 dark:bg-emerald-950/30',
                                                    )}
                                                >
                                                    <div className="min-w-0">
                                                        <BidProjectCell
                                                            bid={bid}
                                                            hideLabel
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <BidStageCell
                                                            stage={
                                                                bid.current_stage
                                                            }
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <BidScopeCell
                                                            scopes={bid.scopes}
                                                        />
                                                    </div>
                                                    <div className="min-w-0 font-medium tabular-nums text-foreground">
                                                        {formatMoney(
                                                            bid.latest_total,
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <BidDirectoryActions
                                                            bidId={bid.id}
                                                            canUpdate={
                                                                options.can
                                                                    .update
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            ))}

                                            {summary && summary.stages.length > 0 && (
                                                <>
                                                    <div className="col-span-5 flex items-center justify-between border-t-2 border-border bg-muted/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                        <span>Summary by Bid Stage</span>
                                                        <span>
                                                            {summary.total_count}{' '}
                                                            {summary.total_count === 1 ? 'bid' : 'bids'}{' '}
                                                            across {summary.stages.length}{' '}
                                                            {summary.stages.length === 1 ? 'stage' : 'stages'}
                                                        </span>
                                                    </div>
                                                    {summary.stages.map((stage) => (
                                                        <div
                                                            key={stage.stage}
                                                            className="col-span-5 grid grid-cols-subgrid items-center gap-x-4 border-b border-border/50 bg-muted/20 px-4 py-2.5 text-sm"
                                                        >
                                                            <div className="col-span-2 flex items-center gap-2">
                                                                <Badge
                                                                    variant="outline"
                                                                    className="font-medium"
                                                                >
                                                                    {stage.stage}
                                                                </Badge>
                                                            </div>
                                                            <div className="min-w-0 text-right text-sm text-muted-foreground">
                                                                {stage.count}{' '}
                                                                {stage.count === 1 ? 'bid' : 'bids'}
                                                            </div>
                                                            <div className="col-span-2 min-w-0 text-right font-semibold tabular-nums text-foreground">
                                                                {stage.formatted_total}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="col-span-5 grid grid-cols-subgrid items-center gap-x-4 bg-muted/50 px-4 py-3 font-semibold">
                                                        <div className="col-span-2 font-bold text-foreground">
                                                            Total
                                                        </div>
                                                        <div className="min-w-0 text-right text-sm font-semibold text-muted-foreground">
                                                            {summary.total_count}{' '}
                                                            {summary.total_count === 1 ? 'bid' : 'bids'}
                                                        </div>
                                                        <div className="col-span-2 min-w-0 text-right text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                                            {summary.formatted_total_amount}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                        No bids found.
                                    </div>
                                )}
                            </div>

                            <PaginationNav paginator={bids} itemLabel="bids" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function BidProjectCell({
    bid,
    hideLabel = false,
}: {
    bid: BidPayload;
    hideLabel?: boolean;
}) {
    const contractors = bid.project?.contractors ?? [];

    return (
        <div className="min-w-0">
            {hideLabel ? null : (
                <DirectoryFieldLabel>Project</DirectoryFieldLabel>
            )}
            <p className="truncate font-medium text-foreground">
                {bid.project?.name || 'Untitled project'}
            </p>
            <p className="truncate text-sm text-muted-foreground">
                {bid.project?.project_number || 'No project number'}
            </p>
            {contractors.length > 0 && (
                <p className="truncate text-sm text-muted-foreground">
                    Contractor{contractors.length > 1 ? 's' : ''}:{' '}
                    {contractors
                        .map((contractor) => contractor.name)
                        .join(', ')}
                </p>
            )}
        </div>
    );
}

function BidStageCell({ stage }: { stage?: string | null }) {
    if (!stage) {
        return (
            <span className="text-sm text-muted-foreground">No stage</span>
        );
    }

    return (
        <Badge
            variant="outline"
            className="h-auto min-h-5 max-w-full min-w-0 shrink whitespace-normal break-words text-left"
        >
            {stage}
        </Badge>
    );
}

function BidScopeCell({ scopes = [] }: { scopes?: BidScopePayload[] }) {
    if (scopes.length === 0) {
        return <span className="text-sm text-muted-foreground">None</span>;
    }

    return (
        <div className="flex min-w-0 flex-wrap gap-1">
            {scopes.slice(0, 2).map((scope) => (
                <Badge
                    key={scope.id}
                    variant="outline"
                    className="h-auto min-h-5 max-w-full min-w-0 shrink whitespace-normal break-words"
                >
                    {scope.name}
                </Badge>
            ))}
            {scopes.length > 2 && (
                <Badge variant="outline">+{scopes.length - 2}</Badge>
            )}
        </div>
    );
}

function BidDirectoryActions({
    bidId,
    canUpdate,
}: {
    bidId: number;
    canUpdate: boolean;
}) {
    return (
        <div className="flex flex-nowrap gap-1.5">
            <ActionHint hint="Print this bid">
                <Button
                    variant="outline"
                    size="icon-sm"
                    className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:border-sky-800/60 dark:text-sky-400 dark:hover:bg-sky-950/40"
                    asChild
                >
                    <a
                        href={route('admin.bids.print', bidId)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Print this bid"
                    >
                        <PrinterIcon className="size-4" />
                    </a>
                </Button>
            </ActionHint>
            <ActionHint hint="Download as PDF">
                <Button
                    variant="outline"
                    size="icon-sm"
                    className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-800/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    asChild
                >
                    <a
                        href={route('admin.bids.export.pdf', bidId)}
                        aria-label="Download as PDF"
                    >
                        <FileTextIcon className="size-4" />
                    </a>
                </Button>
            </ActionHint>
            <ActionHint hint="Download as Word">
                <Button
                    variant="outline"
                    size="icon-sm"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800/60 dark:text-blue-400 dark:hover:bg-blue-950/40"
                    asChild
                >
                    <a
                        href={route('admin.bids.export.word', bidId)}
                        aria-label="Download as Word"
                    >
                        <FileTypeIcon className="size-4" />
                    </a>
                </Button>
            </ActionHint>
            <ActionHint hint="View bid details">
                <Button
                    variant="outline"
                    size="icon-sm"
                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-800/60 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                    asChild
                >
                    <Link
                        href={route('admin.bids.show', bidId)}
                        aria-label="View bid details"
                    >
                        <EyeIcon className="size-4" />
                    </Link>
                </Button>
            </ActionHint>
            {canUpdate && (
                <ActionHint hint="Edit this bid">
                    <Button
                        variant="outline"
                        size="icon-sm"
                        className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        asChild
                    >
                        <Link
                            href={route('admin.bids.edit', bidId)}
                            aria-label="Edit this bid"
                        >
                            <EditIcon className="size-4" />
                        </Link>
                    </Button>
                </ActionHint>
            )}
        </div>
    );
}
