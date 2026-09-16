import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
                                    Shipping and handling exclusions/adjustments
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
                                    No shipping and handling text yet.
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
                            <CardTitle>Bid application text</CardTitle>
                            <CardDescription>
                                The proposal language for this bid.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {bid.application_text ? (
                                <div
                                    className="rich-text-content rounded-lg border border-border bg-background p-4"
                                    dangerouslySetInnerHTML={{
                                        __html: bid.application_text,
                                    }}
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No bid application text yet.
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
                                Start with predefined scope wording, then add
                                or remove service and product lines.
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
                                        {scope.notations ? (
                                            <div
                                                className="rich-text-content text-sm text-foreground"
                                                dangerouslySetInnerHTML={{
                                                    __html: scope.notations,
                                                }}
                                            />
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No information added
                                            </p>
                                        )}
                                        {scope.products?.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-border text-left text-muted-foreground">
                                                            <th className="py-2 pr-3 font-medium">
                                                                Location
                                                            </th>
                                                            <th className="py-2 pr-3 font-medium">
                                                                Service
                                                            </th>
                                                            <th className="py-2 pr-3 font-medium">
                                                                Product
                                                            </th>
                                                            <th className="py-2 pr-3 text-right font-medium">
                                                                Qty
                                                            </th>
                                                            <th className="py-2 pr-3 text-right font-medium">
                                                                Unit value
                                                            </th>
                                                            <th className="py-2 pr-3 text-right font-medium">
                                                                Allocated Install /
                                                                Freight / Handling
                                                            </th>
                                                            <th className="py-2 pr-3 text-right font-medium">
                                                                Combined price
                                                            </th>
                                                            <th className="py-2 text-right font-medium">
                                                                Total
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
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
                                                                <tr
                                                                    key={
                                                                        product.id ??
                                                                        productIndex
                                                                    }
                                                                    className="border-b border-border last:border-0"
                                                                >
                                                                    <td className="py-2 pr-3">
                                                                        {product.location ||
                                                                            '—'}
                                                                    </td>
                                                                    <td className="py-2 pr-3">
                                                                        {product.service_name ||
                                                                            '—'}
                                                                    </td>
                                                                    <td className="py-2 pr-3">
                                                                        {product.abbreviation
                                                                            ? `${product.abbreviation} — ${product.name || product.description}`
                                                                            : product.name ||
                                                                              product.description ||
                                                                              '—'}
                                                                    </td>
                                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                                        {product.quantity ??
                                                                            '—'}
                                                                    </td>
                                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                                        {product.unit_bid
                                                                            ? formatMoney(
                                                                                  product.unit_bid,
                                                                              )
                                                                            : '—'}
                                                                    </td>
                                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                                        {product.allocated_handling
                                                                            ? formatMoney(
                                                                                  product.allocated_handling,
                                                                              )
                                                                            : '—'}
                                                                    </td>
                                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                                        {combined
                                                                            ? formatMoney(
                                                                                  combined,
                                                                              )
                                                                            : '—'}
                                                                    </td>
                                                                    <td className="py-2 text-right tabular-nums">
                                                                        {extended
                                                                            ? formatMoney(
                                                                                  extended,
                                                                              )
                                                                            : '—'}
                                                                    </td>
                                                                </tr>
                                                                );
                                                            },
                                                        )}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr>
                                                            <td
                                                                colSpan={6}
                                                                className="pt-3 text-right font-medium text-foreground"
                                                            >
                                                                Scope total
                                                            </td>
                                                            <td
                                                                colSpan={2}
                                                                className="pt-3 text-right font-medium tabular-nums text-foreground"
                                                            >
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
                                                                                    ) ||
                                                                                        0,
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
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No service and product
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
