import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
import { useState } from 'react';
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
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const removeBid = () => {
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
                            <Button
                                variant="outline"
                                onClick={() => setIsDeleteOpen(true)}
                            >
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
                                    Bid information
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Scope, shipping and handling, basis and
                                    qualification, and the rest of the bid
                                    wording.
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
                                    No bid information yet.
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

                </div>
            </div>

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove bid?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove this bid{bid.project?.name ? ` for “${bid.project.name}”` : ''}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={removeBid}
                        >
                            Remove bid
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
