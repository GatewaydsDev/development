import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DirectoryFieldLabel from '@/Components/DirectoryFieldLabel';
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
import {
    ClipboardListIcon,
    EditIcon,
    FileTextIcon,
    HammerIcon,
    HistoryIcon,
    PrinterIcon,
    TrashIcon,
} from 'lucide-react';
import {
    combinedPriceAmountFromBid,
    formatMoney,
    lineCombinedPrice,
    lineExtendedAmount,
    scopeProductDescription,
    type BidOptions,
    type BidPayload,
} from './types';

type ShowProps = {
    bid: BidPayload;
    options: BidOptions;
};

function DetailItem({
    label,
    value,
}: {
    label: string;
    value?: string | number | null;
}) {
    return (
        <div className="rounded-lg border border-border bg-background p-4">
            <dt className="text-sm font-medium text-muted-foreground">
                {label}
            </dt>
            <dd className="mt-1 text-base font-medium text-foreground">
                {value || 'Not added yet'}
            </dd>
        </div>
    );
}

export default function Show({ bid, options }: ShowProps) {
    const combinedPrice = combinedPriceAmountFromBid(bid);
    const removeBid = () => {
        if (!window.confirm('Remove this bid? This cannot be undone.')) {
            return;
        }

        router.delete(route('admin.bids.destroy', bid.id));
    };

    return (
        <AuthenticatedLayout
            stickyTitle={
                bid.project?.name
                    ? `Bid details — ${bid.project.name}`
                    : 'Bid details'
            }
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav
                            aria-label="Breadcrumb"
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                        >
                            <span>Administration</span>
                            <span>/</span>
                            <Link
                                href={route('admin.bids.index')}
                                className="transition hover:text-foreground"
                            >
                                Bids
                            </Link>
                            <span>/</span>
                            <span className="text-foreground">
                                {bid.project?.name}
                            </span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Bid details
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" asChild>
                            <a
                                href={route('admin.bids.print', bid.id)}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <PrinterIcon className="size-4" />
                                Print
                            </a>
                        </Button>
                        <Button variant="outline" asChild>
                            <a href={route('admin.bids.export.pdf', bid.id)}>
                                <FileTextIcon className="size-4" />
                                PDF
                            </a>
                        </Button>
                        <Button variant="outline" asChild>
                            <a href={route('admin.bids.export.word', bid.id)}>
                                <FileTextIcon className="size-4" />
                                Word 2026
                            </a>
                        </Button>
                        {options.can.update && (
                            <Button asChild>
                                <Link href={route('admin.bids.edit', bid.id)}>
                                    <EditIcon className="size-4" />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        {bid.quotation ? (
                            <Button variant="outline" asChild>
                                <Link
                                    href={route(
                                        'admin.quotations.show',
                                        bid.quotation.id,
                                    )}
                                >
                                    <ClipboardListIcon className="size-4" />
                                    Open quotation
                                </Link>
                            </Button>
                        ) : null}
                        {options.can.delete && (
                            <Button variant="outline" onClick={removeBid}>
                                <TrashIcon className="size-4" />
                                Remove
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <Head title={`Bid: ${bid.project?.name ?? 'Details'}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardListIcon className="size-4 text-muted-foreground" />
                                Project
                            </CardTitle>
                            <CardDescription>
                                The project this bid belongs to.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 md:grid-cols-3">
                                <DetailItem
                                    label="Project name"
                                    value={bid.project?.name}
                                />
                                <DetailItem
                                    label="Authorized representative"
                                    value={bid.assignee?.name}
                                />
                                <DetailItem
                                    label="Project number"
                                    value={bid.project?.project_number}
                                />
                                <DetailItem
                                    label="Project address"
                                    value={bid.project?.site_address}
                                />
                                <DetailItem
                                    label="Source quotation"
                                    value={
                                        bid.quotation
                                            ? `${bid.quotation.quotation_number} — ${bid.quotation.title}`
                                            : null
                                    }
                                />
                                <DetailItem
                                    label="Current stage"
                                    value={bid.current_stage}
                                />
                                <DetailItem
                                    label="Latest total"
                                    value={formatMoney(bid.latest_total)}
                                />
                                <DetailItem
                                    label="Combined price"
                                    value={
                                        combinedPrice
                                            ? formatMoney(combinedPrice)
                                            : null
                                    }
                                />
                            </dl>
                            <div className="mt-6 flex flex-col gap-3">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <HistoryIcon className="size-4 text-muted-foreground" />
                                    Bid revisions
                                </h3>
                                {bid.revisions && bid.revisions.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {bid.revisions.map((revision) => (
                                            <div
                                                key={
                                                    revision.id ??
                                                    revision.number
                                                }
                                                className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-[8rem_10rem_minmax(10rem,0.9fr)_minmax(0,1fr)] sm:items-start"
                                            >
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        Revision
                                                    </p>
                                                    <p className="mt-1 font-medium text-foreground">
                                                        {revision.number}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        Date
                                                    </p>
                                                    <p className="mt-1 text-sm text-foreground">
                                                        {revision.revision_date ||
                                                            'Not set'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        Updated by
                                                    </p>
                                                    <p className="mt-1 text-sm text-foreground">
                                                        {revision.user?.name ||
                                                            'Not set'}
                                                    </p>
                                                </div>
                                                {revision.notes ? (
                                                    <div>
                                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            Notes
                                                        </p>
                                                        <p className="mt-1 text-sm text-foreground">
                                                            {revision.notes}
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No revisions added yet.
                                    </p>
                                )}
                            </div>
                                <p className="mt-4 text-sm font-medium text-foreground">
                                    Shipping & handling, basis & qualification
                                    and more
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Customized notes for shipping, handling,
                                    basis & qualification, exclusions,
                                    adjustments, and any other terms that do
                                    not belong on a product line.
                                </p>
                            {bid.notes ? (
                                <div
                                    className="rich-text-content mt-2 rounded-lg border border-border bg-background p-4"
                                    dangerouslySetInnerHTML={{
                                        __html: bid.notes,
                                    }}
                                />
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    No shipping & handling notes yet.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HammerIcon className="size-4 text-muted-foreground" />
                                Contractors
                            </CardTitle>
                            <CardDescription>
                                Contractors on this job.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-6">
                            {(bid.project?.contractors?.length ?? 0) > 0 ? (
                                bid.project?.contractors?.map((contractor) => (
                                    <dl
                                        key={contractor.id}
                                        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                                    >
                                        <DetailItem
                                            label="Company name"
                                            value={contractor.name}
                                        />
                                        <DetailItem
                                            label="Contact name"
                                            value={contractor.contact_name}
                                        />
                                        <DetailItem
                                            label="Phone number"
                                            value={contractor.phone_number}
                                        />
                                        <DetailItem
                                            label="Email address"
                                            value={contractor.email}
                                        />
                                    </dl>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No contractors added to this
                                    project yet.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Stages</CardTitle>
                            <CardDescription>
                                One-to-many bid stages such as preliminary bid.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            {bid.stages.length > 0 ? (
                                bid.stages.map((stage) => (
                                    <div
                                        key={stage.id ?? stage.stage_type_id}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                                    >
                                        <div>
                                            <p className="font-medium text-foreground">
                                                {stage.name}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {stage.notes ||
                                                    'No stage notes'}
                                            </p>
                                        </div>
                                        <Badge variant="outline">
                                            {stage.stage_date || 'No date'}
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No stages added yet.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Scope of work</CardTitle>
                            <CardDescription>
                                Custom product descriptions and pricing for each
                                location on this bid.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            {bid.scope_of_work_text ? (
                                <div
                                    className="rich-text-content text-sm text-foreground"
                                    dangerouslySetInnerHTML={{
                                        __html: bid.scope_of_work_text,
                                    }}
                                />
                            ) : null}
                            {bid.scopes.length > 0 ? (
                                bid.scopes.map((scope) => (
                                    <div
                                        key={scope.id}
                                        className="flex flex-col gap-3 rounded-lg border border-border p-4"
                                    >
                                        <p className="font-medium text-foreground">
                                            {scope.name}
                                        </p>
                                        {scope.products?.length > 0 ? (
                                            <div className="flex flex-col gap-3">
                                                <div className="hidden gap-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:grid xl:grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.5fr)_4.5rem_minmax(7rem,0.9fr)_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(7.5rem,0.9fr)]">
                                                    <div>Location of the service</div>
                                                    <div>Product Description</div>
                                                    <div className="text-right">Qty</div>
                                                    <div className="text-right">
                                                        Material Unit Price
                                                    </div>
                                                    <div className="text-right">
                                                        Allocated Install / Freight / Handling
                                                    </div>
                                                    <div className="text-right">
                                                        Combined Installed Unit Price
                                                    </div>
                                                    <div className="text-right">
                                                        Building Total
                                                    </div>
                                                </div>
                                                {scope.products.map(
                                                    (
                                                        product,
                                                        productIndex,
                                                    ) => {
                                                        const combined =
                                                            lineCombinedPrice(
                                                                product,
                                                            );
                                                        const extended =
                                                            lineExtendedAmount(
                                                                product,
                                                            );

                                                        return (
                                                            <div
                                                                key={
                                                                    product.id ??
                                                                    productIndex
                                                                }
                                                                className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 md:grid-cols-2 xl:grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.5fr)_4.5rem_minmax(7rem,0.9fr)_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(7.5rem,0.9fr)] xl:items-start xl:border-0 xl:p-0"
                                                            >
                                                                <p className="min-w-0 break-words text-sm text-foreground md:col-span-2 xl:col-span-1">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Location of the service
                                                                    </DirectoryFieldLabel>
                                                                    {product.location ||
                                                                        '—'}
                                                                </p>
                                                                <p className="min-w-0 whitespace-pre-wrap break-words text-sm text-foreground md:col-span-2 xl:col-span-1">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Product Description
                                                                    </DirectoryFieldLabel>
                                                                    {scopeProductDescription(
                                                                        product,
                                                                    ) || '—'}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground xl:text-right xl:tabular-nums">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Qty
                                                                    </DirectoryFieldLabel>
                                                                    {product.quantity ??
                                                                        '—'}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground xl:text-right xl:tabular-nums">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Material Unit Price
                                                                    </DirectoryFieldLabel>
                                                                    {product.unit_bid
                                                                        ? formatMoney(
                                                                              product.unit_bid,
                                                                          )
                                                                        : '—'}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground xl:text-right xl:tabular-nums">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Allocated Install / Freight / Handling
                                                                    </DirectoryFieldLabel>
                                                                    {product.allocated_handling
                                                                        ? formatMoney(
                                                                              product.allocated_handling,
                                                                          )
                                                                        : '—'}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground xl:text-right xl:tabular-nums">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Combined Installed Unit Price
                                                                    </DirectoryFieldLabel>
                                                                    {combined
                                                                        ? formatMoney(
                                                                              combined,
                                                                          )
                                                                        : '—'}
                                                                </p>
                                                                <p className="text-sm font-medium xl:text-right xl:tabular-nums">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Building Total
                                                                    </DirectoryFieldLabel>
                                                                    {extended
                                                                        ? formatMoney(
                                                                              extended,
                                                                          )
                                                                        : '—'}
                                                                </p>
                                                            </div>
                                                        );
                                                    },
                                                )}
                                                <p className="text-right text-sm font-semibold text-foreground">
                                                    Scope total{' '}
                                                    {formatMoney(
                                                        scope.products.reduce(
                                                            (
                                                                sum,
                                                                product,
                                                            ) => {
                                                                const extended =
                                                                    Number(
                                                                        lineExtendedAmount(
                                                                            product,
                                                                        ) || 0,
                                                                    );

                                                                return (
                                                                    sum +
                                                                    (Number.isFinite(
                                                                        extended,
                                                                    )
                                                                        ? extended
                                                                        : 0)
                                                                );
                                                            },
                                                            0,
                                                        ) ||
                                                            scope.extended,
                                                    )}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No items added yet.
                                            </p>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No scopes added yet.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
