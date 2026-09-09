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
import { ClipboardListIcon, EditIcon, TrashIcon } from 'lucide-react';
import { formatMoney, type BidOptions, type BidPayload } from './types';

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
    const removeBid = () => {
        if (!window.confirm('Remove this bid? This cannot be undone.')) {
            return;
        }

        router.delete(route('admin.bids.destroy', bid.id));
    };

    return (
        <AuthenticatedLayout
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
                        {options.can.update && (
                            <Button asChild>
                                <Link href={route('admin.bids.edit', bid.id)}>
                                    <EditIcon className="size-4" />
                                    Edit
                                </Link>
                            </Button>
                        )}
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
                                    label="Current stage"
                                    value={bid.current_stage}
                                />
                                <DetailItem
                                    label="Latest pricing"
                                    value={formatMoney(bid.latest_total)}
                                />
                                <DetailItem
                                    label="Notes"
                                    value={bid.notes}
                                />
                            </dl>
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
                                Reusable titles, products, and notations for
                                this bid.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
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
                                            <ul className="flex flex-col gap-1 text-sm text-foreground">
                                                {scope.products.map(
                                                    (product, productIndex) => (
                                                        <li
                                                            key={
                                                                product.id ??
                                                                productIndex
                                                            }
                                                        >
                                                            {product.abbreviation
                                                                ? `${product.abbreviation} — ${product.name || product.description}`
                                                                : product.name ||
                                                                  product.description}
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No product descriptions
                                            </p>
                                        )}
                                        <p className="text-sm text-muted-foreground">
                                            {scope.notations ||
                                                'No notations'}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No scopes added yet.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {bid.pricings.map((pricing) => (
                        <Card key={pricing.id ?? pricing.name}>
                            <CardHeader>
                                <CardTitle>{pricing.name}</CardTitle>
                                <CardDescription>
                                    {pricing.revision_date || 'No date'}
                                    {pricing.notes
                                        ? ` · ${pricing.notes}`
                                        : ''}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                {pricing.items.length > 0 ? (
                                    pricing.items.map((item, index) => (
                                        <div
                                            key={item.id ?? index}
                                            className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_8rem_7rem]"
                                        >
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Line item
                                                </p>
                                                <p className="font-medium text-foreground">
                                                    {item.description}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Pricing basis
                                                </p>
                                                <p className="text-sm text-foreground">
                                                    {item.pricing_basis ||
                                                        'Not added yet'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Status
                                                </p>
                                                <Badge variant="outline">
                                                    {item.status_name ||
                                                        'None'}
                                                </Badge>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Amount
                                                </p>
                                                <p className="font-medium text-foreground">
                                                    {formatMoney(item.amount)}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No line items in this revision.
                                    </p>
                                )}
                                <div className="flex justify-end border-t border-border pt-3">
                                    <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                                        {formatMoney(pricing.total)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
