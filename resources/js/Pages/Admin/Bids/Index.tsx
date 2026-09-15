import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
    EditIcon,
    EyeIcon,
    FileTextIcon,
    PlusIcon,
    PrinterIcon,
    SearchIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import {
    formatMoney,
    type BidOptions,
    type BidsPaginator,
} from './types';

type IndexProps = {
    filters: {
        search?: string;
        highlight?: number | null;
    };
    options: BidOptions;
    bids: BidsPaginator;
};

export default function Index({ filters, options, bids }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const highlightedBidId = filters.highlight ?? null;

    useEffect(() => {
        if (!highlightedBidId) {
            return;
        }

        document
            .getElementById(`bid-row-${highlightedBidId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    const bidRowGridClassName =
        'lg:grid-cols-[minmax(12rem,1.2fr)_minmax(8rem,0.8fr)_minmax(10rem,1fr)_7rem_auto]';

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
                                <div className={cn('hidden items-center gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid', bidRowGridClassName)}>
                                    <div>Project</div>
                                    <div>Stage</div>
                                    <div>Scope</div>
                                    <div>Pricing</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {bids.data.length > 0 ? (
                                    bids.data.map((bid) => (
                                        <div
                                            id={`bid-row-${bid.id}`}
                                            key={bid.id}
                                            className={cn(
                                                'grid gap-3 border-b border-border px-4 py-4 last:border-b-0 lg:min-h-20 lg:items-center lg:gap-4',
                                                bidRowGridClassName,
                                                highlightedBidId === bid.id &&
                                                    'bg-emerald-50 dark:bg-emerald-950/30',
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-foreground">
                                                    {bid.project?.name ||
                                                        'Untitled project'}
                                                </p>
                                                <p className="truncate text-sm text-muted-foreground">
                                                    {bid.project
                                                        ?.project_number ||
                                                        'No project number'}
                                                </p>
                                            </div>
                                            <div>
                                                {bid.current_stage ? (
                                                    <Badge variant="outline">
                                                        {bid.current_stage}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        No stage
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {bid.scopes?.length > 0 ? (
                                                    bid.scopes
                                                        .slice(0, 2)
                                                        .map((scope) => (
                                                            <Badge
                                                                key={scope.id}
                                                                variant="outline"
                                                            >
                                                                {scope.name}
                                                            </Badge>
                                                        ))
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        None
                                                    </span>
                                                )}
                                                {bid.scopes?.length > 2 && (
                                                    <Badge variant="outline">
                                                        +{bid.scopes.length - 2}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="font-medium text-foreground">
                                                {formatMoney(bid.latest_total)}
                                            </div>
                                            <div className="flex flex-nowrap gap-2 md:justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <a
                                                        href={route(
                                                            'admin.bids.print',
                                                            bid.id,
                                                        )}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        <PrinterIcon className="size-4" />
                                                        Print
                                                    </a>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <a
                                                        href={route(
                                                            'admin.bids.export.pdf',
                                                            bid.id,
                                                        )}
                                                    >
                                                        <FileTextIcon className="size-4" />
                                                        PDF
                                                    </a>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <a
                                                        href={route(
                                                            'admin.bids.export.word',
                                                            bid.id,
                                                        )}
                                                    >
                                                        <FileTextIcon className="size-4" />
                                                        Word 2026
                                                    </a>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link
                                                        href={route(
                                                            'admin.bids.show',
                                                            bid.id,
                                                        )}
                                                    >
                                                        <EyeIcon className="size-4" />
                                                        View
                                                    </Link>
                                                </Button>
                                                {options.can.update && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={route(
                                                                'admin.bids.edit',
                                                                bid.id,
                                                            )}
                                                        >
                                                            <EditIcon className="size-4" />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))
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
