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
    FileSpreadsheetIcon,
    FileTextIcon,
    FileUpIcon,
    PrinterIcon,
    TrashIcon,
} from 'lucide-react';
import {
    formatMoney,
    type QuotationOptions,
    type QuotationPayload,
} from './types';

type ShowProps = {
    quotation: QuotationPayload;
    options: QuotationOptions;
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

export default function Show({ quotation, options }: ShowProps) {
    const removeQuotation = () => {
        if (!window.confirm('Remove this quotation? This cannot be undone.')) {
            return;
        }

        router.delete(route('admin.quotations.destroy', quotation.id));
    };

    const convertToBid = () => {
        if (!quotation.project) {
            window.alert(
                'Link this quotation to a project before converting it to a bid.',
            );
            return;
        }

        if (
            !window.confirm(
                'Create a bid from this quotation? The quotation stays saved and will be linked to the new bid.',
            )
        ) {
            return;
        }

        router.post(route('admin.quotations.convert-to-bid', quotation.id));
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
                                href={route('admin.quotations.index')}
                                className="transition hover:text-foreground"
                            >
                                Quotations
                            </Link>
                            <span>/</span>
                            <span className="text-foreground">
                                {quotation.quotation_number}
                            </span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Quotation details
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" asChild>
                            <a
                                href={route(
                                    'admin.quotations.print',
                                    quotation.id,
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
                                    'admin.quotations.export.pdf',
                                    quotation.id,
                                )}
                            >
                                <FileTextIcon className="size-4" />
                                PDF
                            </a>
                        </Button>
                        <Button variant="outline" asChild>
                            <a
                                href={route(
                                    'admin.quotations.export.word',
                                    quotation.id,
                                )}
                            >
                                <FileTextIcon className="size-4" />
                                Word 2026
                            </a>
                        </Button>
                        {quotation.converted_bid ? (
                            <Button variant="outline" asChild>
                                <Link
                                    href={route(
                                        'admin.bids.show',
                                        quotation.converted_bid.id,
                                    )}
                                >
                                    <ClipboardListIcon className="size-4" />
                                    Open bid
                                </Link>
                            </Button>
                        ) : options.can.convert_to_bid ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={convertToBid}
                                >
                                    <ClipboardListIcon className="size-4" />
                                    Make this a bid
                                </Button>
                                <Button variant="outline" asChild>
                                    <Link
                                        href={route('admin.bids.create', {
                                            quotation: quotation.id,
                                        })}
                                    >
                                        <FileUpIcon className="size-4" />
                                        Import into new bid
                                    </Link>
                                </Button>
                            </>
                        ) : null}
                        {options.can.update && (
                            <Button asChild>
                                <Link
                                    href={route(
                                        'admin.quotations.edit',
                                        quotation.id,
                                    )}
                                >
                                    <EditIcon className="size-4" />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        {options.can.delete && (
                            <Button variant="outline" onClick={removeQuotation}>
                                <TrashIcon className="size-4" />
                                Remove
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <Head title={`Quotation: ${quotation.quotation_number}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileSpreadsheetIcon className="size-4 text-muted-foreground" />
                                {quotation.title}
                            </CardTitle>
                            <CardDescription>
                                {quotation.quotation_number}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 md:grid-cols-3">
                                <DetailItem
                                    label="Status"
                                    value={quotation.status_label}
                                />
                                <DetailItem
                                    label="Quoted on"
                                    value={quotation.quoted_at}
                                />
                                <DetailItem
                                    label="Valid until"
                                    value={quotation.valid_until}
                                />
                                <DetailItem
                                    label="Total"
                                    value={formatMoney(quotation.total)}
                                />
                                <DetailItem
                                    label="Linked bid"
                                    value={
                                        quotation.converted_bid
                                            ? 'Converted to a bid'
                                            : 'Not converted yet'
                                    }
                                />
                            </dl>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Customer information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 md:grid-cols-2">
                                <DetailItem
                                    label="Customer / owner"
                                    value={
                                        quotation.customer?.company_name ||
                                        quotation.customer?.name
                                    }
                                />
                                <DetailItem
                                    label="Contact name"
                                    value={
                                        quotation.customer?.contact_name ||
                                        null
                                    }
                                />
                                <DetailItem
                                    label="Email"
                                    value={quotation.customer?.email}
                                />
                                <DetailItem
                                    label="Phone"
                                    value={quotation.customer?.phone_number}
                                />
                                <DetailItem
                                    label="Address"
                                    value={quotation.customer?.address}
                                />
                            </dl>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Project information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {quotation.project ? (
                                <dl className="grid gap-4 md:grid-cols-2">
                                    <DetailItem
                                        label="Project name"
                                        value={quotation.project.name}
                                    />
                                    <DetailItem
                                        label="Project number"
                                        value={quotation.project.project_number}
                                    />
                                    <DetailItem
                                        label="Site address"
                                        value={quotation.project.site_address}
                                    />
                                </dl>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No project linked.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Quoted items</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="hidden grid-cols-[minmax(0,2fr)_6rem_8rem_8rem] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                                    <div>Description</div>
                                    <div className="text-right">Qty</div>
                                    <div className="text-right">Unit price</div>
                                    <div className="text-right">Extended</div>
                                </div>
                                {(quotation.line_items ?? []).map((item) => (
                                    <div
                                        key={item.id ?? item.description}
                                        className="grid gap-2 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,2fr)_6rem_8rem_8rem] md:items-center"
                                    >
                                        <p className="font-medium text-foreground">
                                            {item.description}
                                        </p>
                                        <p className="text-sm text-muted-foreground md:text-right">
                                            {item.quantity ?? '—'}
                                        </p>
                                        <p className="text-sm text-muted-foreground md:text-right">
                                            {item.unit_price === null
                                                ? '—'
                                                : formatMoney(item.unit_price)}
                                        </p>
                                        <p className="text-sm font-medium md:text-right">
                                            {formatMoney(item.extended)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-right text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                Total {formatMoney(quotation.total)}
                            </p>
                        </CardContent>
                    </Card>

                    {quotation.notes ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap text-sm text-foreground">
                                    {quotation.notes}
                                </p>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
