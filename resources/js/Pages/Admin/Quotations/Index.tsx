import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ActionHint from '@/Components/ActionHint';
import DirectoryFieldLabel from '@/Components/DirectoryFieldLabel';
import PaginationNav from '@/Components/PaginationNav';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
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
    FileSpreadsheetIcon,
    FileTextIcon,
    FileTypeIcon,
    PlusIcon,
    PrinterIcon,
    SearchIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import {
    formatMoney,
    type QuotationOptions,
    type QuotationPayload,
    type QuotationsPaginator,
} from './types';

type IndexProps = {
    filters: {
        search?: string;
        highlight?: number | null;
    };
    options: QuotationOptions;
    quotations: QuotationsPaginator;
};

const statusBadgeClassName = (status?: string | null) => {
    const colors: Record<string, string> = {
        draft: 'border-border bg-muted text-muted-foreground',
        sent: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300',
        accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300',
        expired: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300',
        declined: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300',
    };

    return colors[status ?? ''] ?? 'border-border bg-muted text-muted-foreground';
};

export default function Index({ filters, options, quotations }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [pendingQuotation, setPendingQuotation] =
        useState<QuotationPayload | null>(null);
    const highlightedId = filters.highlight ?? null;

    useEffect(() => {
        if (!highlightedId) {
            return;
        }

        document
            .getElementById(`quotation-row-${highlightedId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlightedId]);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.quotations.index'),
            { search },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const convertToBid = (quotation: QuotationPayload) => {
        if (!quotation.project) {
            window.alert(
                'This quotation needs a project before it can become a bid. Open the quotation, choose a project, then try again.',
            );
            return;
        }

        setPendingQuotation(quotation);
    };

    const confirmConvertToBid = () => {
        if (!pendingQuotation) {
            return;
        }

        router.post(
            route('admin.quotations.convert-to-bid', pendingQuotation.id),
        );
        setPendingQuotation(null);
    };

    const rowGridClassName =
        'lg:grid-cols-[minmax(9.5rem,1fr)_minmax(11rem,1.2fr)_minmax(11rem,1.2fr)_7rem_7.5rem_minmax(12.5rem,auto)]';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">Quotations</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Quotations
                        </h2>
                    </div>

                    {options.can.create && (
                        <Button asChild>
                            <Link href={route('admin.quotations.create')}>
                                <PlusIcon className="size-4" />
                                Add quotation
                            </Link>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Quotations" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileSpreadsheetIcon className="size-4 text-muted-foreground" />
                                    Saved quotations
                                </CardTitle>
                                <CardDescription>
                                    Every contractor quote stays in this list.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {quotations.total}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Quotation directory</CardTitle>
                                <CardDescription>
                                    Search by contractor, project, or quotation
                                    number.
                                </CardDescription>
                            </div>
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
                                        placeholder="Search quotations"
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
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="min-w-full lg:min-w-[62rem]">
                                    <div
                                        className={cn(
                                            'hidden items-center gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid',
                                            rowGridClassName,
                                        )}
                                    >
                                        <div>Number</div>
                                        <div>Contractor</div>
                                        <div>Project</div>
                                        <div>Status</div>
                                        <div className="lg:text-right">Total</div>
                                        <div className="lg:text-right">Actions</div>
                                    </div>

                                    {quotations.data.length > 0 ? (
                                        quotations.data.map((quotation) => (
                                            <div
                                                id={`quotation-row-${quotation.id}`}
                                                key={quotation.id}
                                                className={cn(
                                                    'grid gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-muted/40 last:border-b-0 lg:items-center lg:gap-4',
                                                    rowGridClassName,
                                                    highlightedId === quotation.id &&
                                                        'bg-emerald-50 dark:bg-emerald-950/30',
                                                )}
                                            >
                                                <div className="min-w-0">
                                                    <DirectoryFieldLabel>Number</DirectoryFieldLabel>
                                                    <p className="font-semibold text-foreground">
                                                        {quotation.quotation_number}
                                                    </p>
                                                    {quotation.title ? (
                                                        <p
                                                            className="truncate text-xs text-muted-foreground"
                                                            title={quotation.title}
                                                        >
                                                            {quotation.title}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <div className="min-w-0">
                                                    <DirectoryFieldLabel>Contractor</DirectoryFieldLabel>
                                                    <p className="truncate font-medium text-foreground">
                                                        {quotation.contractor?.name || '—'}
                                                    </p>
                                                    {quotation.contractor?.contact_name ? (
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {quotation.contractor.contact_name}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <div className="min-w-0">
                                                    <DirectoryFieldLabel>Project</DirectoryFieldLabel>
                                                    {quotation.project ? (
                                                        <>
                                                            <p className="truncate font-medium text-foreground">
                                                                {quotation.project.name}
                                                            </p>
                                                            {quotation.project.project_number ? (
                                                                <p className="truncate text-xs text-muted-foreground">
                                                                    #{quotation.project.project_number}
                                                                </p>
                                                            ) : null}
                                                        </>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">
                                                            No project
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <DirectoryFieldLabel>Status</DirectoryFieldLabel>
                                                    <Badge
                                                        variant="outline"
                                                        className={statusBadgeClassName(
                                                            quotation.status,
                                                        )}
                                                    >
                                                        {quotation.status_label}
                                                    </Badge>
                                                </div>
                                                <div className="min-w-0 font-semibold tabular-nums text-foreground lg:text-right">
                                                    <DirectoryFieldLabel>Total</DirectoryFieldLabel>
                                                    {formatMoney(quotation.total)}
                                                </div>
                                                <div className="flex min-w-0 flex-col gap-1 lg:items-end">
                                                    <DirectoryFieldLabel>Actions</DirectoryFieldLabel>
                                                    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                                                        <ActionHint hint="Print this quotation">
                                                            <Button
                                                                variant="outline"
                                                                size="icon-xs"
                                                                asChild
                                                            >
                                                                <a
                                                                    href={route(
                                                                        'admin.quotations.print',
                                                                        quotation.id,
                                                                    )}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    aria-label="Print this quotation"
                                                                >
                                                                    <PrinterIcon className="size-3.5" />
                                                                </a>
                                                            </Button>
                                                        </ActionHint>
                                                        <ActionHint hint="Download as PDF">
                                                            <Button
                                                                variant="outline"
                                                                size="icon-xs"
                                                                asChild
                                                            >
                                                                <a
                                                                    href={route(
                                                                        'admin.quotations.export.pdf',
                                                                        quotation.id,
                                                                    )}
                                                                    aria-label="Download as PDF"
                                                                >
                                                                    <FileTextIcon className="size-3.5" />
                                                                </a>
                                                            </Button>
                                                        </ActionHint>
                                                        <ActionHint hint="Download as Word">
                                                            <Button
                                                                variant="outline"
                                                                size="icon-xs"
                                                                asChild
                                                            >
                                                                <a
                                                                    href={route(
                                                                        'admin.quotations.export.word',
                                                                        quotation.id,
                                                                    )}
                                                                    aria-label="Download as Word"
                                                                >
                                                                    <FileTypeIcon className="size-3.5" />
                                                                </a>
                                                            </Button>
                                                        </ActionHint>
                                                        <ActionHint hint="View quotation details">
                                                            <Button
                                                                variant="outline"
                                                                size="icon-xs"
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={route(
                                                                        'admin.quotations.show',
                                                                        quotation.id,
                                                                    )}
                                                                    aria-label="View quotation details"
                                                                >
                                                                    <EyeIcon className="size-3.5" />
                                                                </Link>
                                                            </Button>
                                                        </ActionHint>
                                                        {options.can.update && (
                                                            <ActionHint hint="Edit this quotation">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon-xs"
                                                                    asChild
                                                                >
                                                                    <Link
                                                                        href={route(
                                                                            'admin.quotations.edit',
                                                                            quotation.id,
                                                                        )}
                                                                        aria-label="Edit this quotation"
                                                                    >
                                                                        <EditIcon className="size-3.5" />
                                                                    </Link>
                                                                </Button>
                                                            </ActionHint>
                                                        )}
                                                        {quotation.converted_bid ? (
                                                            <ActionHint hint="Open converted bid">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon-xs"
                                                                    asChild
                                                                >
                                                                    <Link
                                                                        href={route(
                                                                            'admin.bids.show',
                                                                            quotation
                                                                                .converted_bid
                                                                                .id,
                                                                        )}
                                                                        aria-label="Open converted bid"
                                                                    >
                                                                        <ClipboardListIcon className="size-3.5" />
                                                                    </Link>
                                                                </Button>
                                                            </ActionHint>
                                                        ) : options.can
                                                              .convert_to_bid ? (
                                                            <ActionHint hint="Make this a bid">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon-xs"
                                                                    onClick={() =>
                                                                        convertToBid(
                                                                            quotation,
                                                                        )
                                                                    }
                                                                    aria-label="Make this a bid"
                                                                >
                                                                    <ClipboardListIcon className="size-3.5" />
                                                                </Button>
                                                            </ActionHint>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                            No quotations found.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <PaginationNav
                                paginator={quotations}
                                itemLabel="quotations"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            <AlertDialog
                open={pendingQuotation !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingQuotation(null);
                    }
                }}
            >
                <AlertDialogContent className="border-emerald-200 dark:border-emerald-900/70">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create this bid?</AlertDialogTitle>
                        <AlertDialogDescription>
                            “{pendingQuotation?.quotation_number}” is not a bid
                            yet. Create it from this quotation so it can be
                            reused later?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>No, go back</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmConvertToBid}>
                            Yes, create bid
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
