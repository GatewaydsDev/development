import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DirectoryFieldLabel from '@/Components/DirectoryFieldLabel';
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
    FileSpreadsheetIcon,
    FileTextIcon,
    FileUpIcon,
    HistoryIcon,
    PrinterIcon,
    TrashIcon,
} from 'lucide-react';
import { isEmptyHtml } from '@/Pages/Admin/Bids/bidText';
import {
    fillQuotationPlaceholders,
    formatMoney,
    quotationInsertValues,
    quotationToFormData,
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
    const [isConvertOpen, setIsConvertOpen] = useState(false);
    const pricingBasisHtml = !isEmptyHtml(quotation.pricing_basis)
        ? fillQuotationPlaceholders(
              quotation.pricing_basis ?? '',
              quotationInsertValues(
                  quotationToFormData(quotation, options),
                  options,
                  quotation,
              ),
          )
        : '';
    const removeQuotation = () => {
        if (!window.confirm('Remove this quotation? This cannot be undone.')) {
            return;
        }

        router.delete(route('admin.quotations.destroy', quotation.id));
    };

    const convertToBid = () => {
        if (!quotation.project) {
            window.alert(
                'This quotation needs a project before it can become a bid. Open the quotation, choose a project, then try again.',
            );
            return;
        }

        setIsConvertOpen(true);
    };

    const confirmConvertToBid = () => {
        setIsConvertOpen(false);
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
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
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

                    <Card className="border-emerald-200 bg-emerald-50 shadow-sm ring-0 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                                <HistoryIcon className="size-4 text-muted-foreground" />
                                Quotation revisions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {quotation.revisions &&
                            quotation.revisions.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {quotation.revisions.map((revision) => (
                                        <div
                                            key={
                                                revision.id ?? revision.number
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
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold text-foreground">
                                Project information
                            </CardTitle>
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
                            <CardTitle className="text-base font-semibold text-foreground">
                                Contractor
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <dl className="grid gap-4 md:grid-cols-2">
                                <DetailItem
                                    label="Contractor"
                                    value={quotation.contractor?.name}
                                />
                            </dl>
                            {(quotation.contacts ?? []).length > 0 ? (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {(quotation.contacts ?? []).map((contact) => (
                                        <div
                                            key={contact.id}
                                            className="rounded-lg border border-border bg-background p-4"
                                        >
                                            <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                                                {contact.name ||
                                                    'Unnamed contact'}
                                                {contact.is_primary ? (
                                                    <Badge variant="outline">
                                                        Primary
                                                    </Badge>
                                                ) : null}
                                            </p>
                                            {contact.title ? (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {contact.title}
                                                </p>
                                            ) : null}
                                            {contact.email ? (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {contact.email}
                                                </p>
                                            ) : null}
                                            {contact.phone_number ? (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {contact.phone_number}
                                                </p>
                                            ) : null}
                                            {!contact.email &&
                                            !contact.phone_number ? (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    No email or phone
                                                </p>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No contacts selected for this quotation.
                                </p>
                            )}
                            {!isEmptyHtml(quotation.notes) ? (
                                <div className="py-6">
                                    <h3 className="text-base font-semibold text-foreground">
                                        Quote proposal based
                                    </h3>
                                    <div
                                        className="rich-text-content mt-3 text-sm text-foreground"
                                        dangerouslySetInnerHTML={{
                                            __html: quotation.notes ?? '',
                                        }}
                                    />
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold text-foreground">
                                Base Bid
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="hidden grid-cols-[5rem_14rem_minmax(0,2fr)_9rem] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                                    <div className="text-right">Qty</div>
                                    <div>Size</div>
                                    <div>Description</div>
                                    <div className="text-right">Price</div>
                                </div>
                                {(quotation.line_items ?? []).map((item) => (
                                    <div
                                        key={item.id ?? item.description}
                                        className="grid gap-2 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[5rem_14rem_minmax(0,2fr)_9rem] md:items-center"
                                    >
                                        <p className="text-sm text-muted-foreground md:text-right">
                                            <DirectoryFieldLabel hideFrom="md">
                                                Qty
                                            </DirectoryFieldLabel>
                                            {item.quantity ?? '—'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            <DirectoryFieldLabel hideFrom="md">
                                                Size
                                            </DirectoryFieldLabel>
                                            {item.size || '—'}
                                        </p>
                                        <p className="font-medium text-foreground whitespace-pre-line">
                                            <DirectoryFieldLabel hideFrom="md">
                                                Description
                                            </DirectoryFieldLabel>
                                            {item.description}
                                        </p>
                                        <p className="text-sm font-medium md:text-right">
                                            <DirectoryFieldLabel hideFrom="md">
                                                Price
                                            </DirectoryFieldLabel>
                                            {item.unit_price === null
                                                ? '—'
                                                : formatMoney(item.unit_price)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-right text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                Total {formatMoney(quotation.total)}
                            </p>
                        </CardContent>
                    </Card>

                    {pricingBasisHtml ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base font-semibold text-foreground">
                                    Pricing Basis
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className="rich-text-content py-4 text-sm text-foreground"
                                    dangerouslySetInnerHTML={{
                                        __html: pricingBasisHtml,
                                    }}
                                />
                            </CardContent>
                        </Card>
                    ) : null}

                    {(quotation.field_tables ?? []).map((table, tableIndex) => (
                        <Card
                            key={table.id ?? `table-${tableIndex}`}
                            className="border-emerald-200 bg-emerald-50 shadow-sm ring-0 dark:border-emerald-900/60 dark:bg-emerald-950/30"
                        >
                            <CardHeader>
                                <CardTitle className="text-base font-semibold text-foreground">
                                    {table.title || 'Table'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {(table.fields ?? []).length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No fields added to this table.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto rounded-lg border border-border bg-background">
                                        <table className="w-full border-collapse text-sm">
                                            <tbody>
                                                {(table.fields ?? []).map(
                                                    (item, index) => (
                                                        <tr
                                                            key={
                                                                item.id ??
                                                                `${item.field}-${index}`
                                                            }
                                                            className="border-b border-border last:border-b-0"
                                                        >
                                                            <th className="w-[34%] border-r border-border bg-muted/40 px-4 py-3 text-left align-top font-medium text-foreground">
                                                                {item.field ||
                                                                    '—'}
                                                            </th>
                                                            <td className="px-4 py-3 align-top text-foreground">
                                                                {item.value ||
                                                                    '—'}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}

                    {!isEmptyHtml(quotation.pricing_conditions) ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base font-semibold text-foreground">
                                    Pricing, conditions and more
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className="rich-text-content text-sm text-foreground"
                                    dangerouslySetInnerHTML={{
                                        __html:
                                            quotation.pricing_conditions ?? '',
                                    }}
                                />
                            </CardContent>
                        </Card>
                    ) : null}

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold text-foreground">
                                Authorization
                            </CardTitle>
                            <CardDescription>
                                This quotation is submitted by{' '}
                                {options.company?.name ||
                                    'Gateway Door Systems'}
                                . Acceptance below confirms the pricing and
                                conditions in this document.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg border border-border bg-muted/30 p-4">
                                    <h3 className="text-sm font-semibold text-foreground">
                                        Submitted by
                                    </h3>
                                    <dl className="mt-3 flex flex-col gap-3">
                                        <div>
                                            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Company
                                            </dt>
                                            <dd className="mt-1 text-sm text-foreground">
                                                {options.company?.name ||
                                                    'Gateway Door Systems'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Authorized representative
                                            </dt>
                                            <dd className="mt-1 text-sm text-foreground">
                                                {quotation.created_by_name ||
                                                    '—'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Signature
                                            </dt>
                                            {quotation.signature_url ? (
                                                <dd className="mt-2">
                                                    <img
                                                        src={
                                                            quotation.signature_url
                                                        }
                                                        alt="Authorized representative signature"
                                                        className="h-12 max-w-[180px] object-contain object-left"
                                                    />
                                                </dd>
                                            ) : (
                                                <dd className="mt-5 border-b border-foreground" />
                                            )}
                                        </div>
                                        <div>
                                            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Date
                                            </dt>
                                            <dd className="mt-1 text-sm text-foreground">
                                                {quotation.quoted_at || '—'}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                                <div className="rounded-lg border border-border bg-muted/30 p-4">
                                    <h3 className="text-sm font-semibold text-foreground">
                                        Accepted by
                                    </h3>
                                    <dl className="mt-3 flex flex-col gap-3">
                                        <div>
                                            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Company
                                            </dt>
                                            <dd className="mt-5 border-b border-foreground" />
                                        </div>
                                        <div>
                                            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Authorized representative
                                            </dt>
                                            <dd className="mt-5 border-b border-foreground" />
                                        </div>
                                        <div>
                                            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Signature
                                            </dt>
                                            <dd className="mt-5 border-b border-foreground" />
                                        </div>
                                        <div>
                                            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Date
                                            </dt>
                                            <dd className="mt-5 border-b border-foreground" />
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>

            <AlertDialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
                <AlertDialogContent className="border-emerald-200 dark:border-emerald-900/70">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create this bid?</AlertDialogTitle>
                        <AlertDialogDescription>
                            “{quotation.quotation_number}” is not a bid yet.
                            Create it from this quotation so it can be reused
                            later?
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
