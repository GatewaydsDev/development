import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FormActionFab from '@/Components/FormActionFab';
import { Link, router, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import TextInput from '@/Components/TextInput';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

type RequestedItem = {
    id: number;
    description: string;
    quantity: string;
    unit_of_measure: string;
};

type QuoteItem = {
    id: number;
    description: string;
    quantity: string;
    unit_of_measure: string;
    unit_price: string | null;
    line_total: string;
    price_request_item_id: number | null;
};

type Quote = {
    id: number;
    uuid: string;
    revision_number: number;
    supplier_reference_number: string | null;
    received_at: string | null;
    expires_at: string | null;
    currency: string;
    discount_amount: string;
    discount_mode: string;
    freight_amount: string;
    tax_amount: string;
    other_charges_amount: string;
    grand_total: string;
    lead_time_value: string | null;
    lead_time_unit: string;
    lead_time_text: string | null;
    payment_terms: string | null;
    specification_compliance: string | null;
    exclusions: string | null;
    review_status: string;
    items: QuoteItem[];
    inquiry?: {
        id: number;
        uuid: string;
        title: string;
        contact?: { id: number; uuid: string; first_name: string; last_name: string | null } | null;
    } | null;
};

type Comparison = {
    quote: Quote;
    missing_item_ids: number[];
    unlinked_items_count: number;
    quantity_mismatches: number;
    has_missing_prices: boolean;
    is_comparable: boolean;
};

type Selection = {
    supplier_quote?: {
        id: number;
        revision_number: number;
        currency: string;
        grand_total: string;
        supplier_reference_number: string | null;
    } | null;
    selection_reason: string;
    selected_by?: { id: number; name: string } | null;
    selected_at: string;
} | null;

type PriceRequest = {
    id: number;
    uuid: string;
    title: string;
    currency: string;
    items: RequestedItem[];
};

type Props = PageProps<{
    priceRequest: PriceRequest;
    comparisons: Comparison[];
    lowestTotal: number | null;
    selection: Selection;
    hasNewerRevisionThanSelection: boolean;
    requestedItems: RequestedItem[];
}>;

export default function CompareQuotes({
    priceRequest,
    comparisons,
    lowestTotal,
    selection,
    hasNewerRevisionThanSelection,
    requestedItems,
}: Props) {
    const page = usePage<Props>();
    const can = (page.props.auth.can ?? {}) as Record<string, boolean>;
    const canSelectPreferred = Boolean(can.managePriceRequests);

    const [selectionChoice, setSelectionChoice] = useState(
        selection?.supplier_quote ? String(selection.supplier_quote.id) : '',
    );
    const [selectionReason, setSelectionReason] = useState(
        selection?.selection_reason ?? '',
    );
    const [selectionOpen, setSelectionOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const closeEditor = () => {
        setSelectionOpen(false);
        setErrors({});
        setSelectionChoice(selection?.supplier_quote ? String(selection.supplier_quote.id) : '');
        setSelectionReason(selection?.selection_reason ?? '');
    };

    const submitSelection = (event: FormEvent) => {
        event.preventDefault();

        if (!selectionChoice) {
            return;
        }

        router.post(
            route('contact-directory.price-requests.preferred-quote.store', priceRequest.uuid),
            {
                supplier_quote_id: selectionChoice,
                selection_reason: selectionReason,
            },
            { preserveScroll: true, onStart: () => { setSaving(true); setErrors({}); }, onError: setErrors, onFinish: () => setSaving(false), onSuccess: () => setSelectionOpen(false) },
        );
    };

    return (
        <AuthenticatedLayout stickyTitle={`Compare quotes · ${priceRequest.title}`}>
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            Quote comparison
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Side-by-side view of each supplier's current quote revision.
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link
                            href={route('contact-directory.price-requests.show', priceRequest.uuid)}
                        >
                            Back to price request
                        </Link>
                    </Button>
                </div>

                {selection?.supplier_quote && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Preferred quote</CardTitle>
                            {hasNewerRevisionThanSelection && (
                                <CardDescription className="font-medium text-amber-700 dark:text-amber-400">
                                    A newer quote revision has arrived since this selection. The
                                    preferred quote decision may need review.
                                </CardDescription>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <p className="text-sm">
                                Revision {selection.supplier_quote.revision_number} ·{' '}
                                {selection.supplier_quote.currency}{' '}
                                {Number(selection.supplier_quote.grand_total).toLocaleString(
                                    undefined,
                                    { minimumFractionDigits: 2 },
                                )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Reason: {selection.selection_reason}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Selected by {selection.selected_by?.name ?? '—'} on{' '}
                                {new Date(selection.selected_at).toLocaleString([], {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </p>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4 xl:grid-cols-2">
                    {comparisons.length === 0 && (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                No supplier quotes have been recorded for this price request yet.
                            </CardContent>
                        </Card>
                    )}
                    {comparisons.map((comparison) => {
                        const quote = comparison.quote;
                        const isLowest =
                            comparison.is_comparable &&
                            lowestTotal !== null &&
                            Number(quote.grand_total) === lowestTotal;

                        return (
                            <Card key={quote.id}>
                                <CardHeader>
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <CardTitle className="text-base">
                                            {quote.inquiry?.contact
                                                ? `${quote.inquiry.contact.first_name} ${
                                                      quote.inquiry.contact.last_name ?? ''
                                                  }`
                                                : quote.inquiry?.title ?? 'Supplier quote'}
                                        </CardTitle>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline">
                                                Revision {quote.revision_number}
                                            </Badge>
                                            {quote.supplier_reference_number && (
                                                <Badge variant="outline">
                                                    Ref {quote.supplier_reference_number}
                                                </Badge>
                                            )}
                                            {isLowest && (
                                                <Badge className="bg-emerald-600 text-white">
                                                    Lowest comparable total
                                                </Badge>
                                            )}
                                            {!comparison.is_comparable && (
                                                <Badge variant="destructive">
                                                    Not directly comparable
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <CardDescription>
                                        {quote.received_at ? `Received ${quote.received_at}` : ''}
                                        {quote.expires_at ? ` · Expires ${quote.expires_at}` : ''}
                                        {quote.payment_terms ? ` · ${quote.payment_terms}` : ''}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <p className="text-xs uppercase text-muted-foreground">
                                            Grand total
                                        </p>
                                        <p
                                            className={cn(
                                                'text-xl font-semibold',
                                                !comparison.is_comparable &&
                                                    'text-muted-foreground',
                                            )}
                                        >
                                            {quote.currency}{' '}
                                            {Number(quote.grand_total).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                            })}
                                            {!comparison.is_comparable &&
                                                ' (not directly comparable)'}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="block text-xs uppercase text-muted-foreground">
                                                Freight
                                            </span>
                                            {quote.currency}{' '}
                                            {Number(quote.freight_amount).toLocaleString(
                                                undefined,
                                                { minimumFractionDigits: 2 },
                                            )}
                                        </div>
                                        <div>
                                            <span className="block text-xs uppercase text-muted-foreground">
                                                Tax
                                            </span>
                                            {quote.currency}{' '}
                                            {Number(quote.tax_amount).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                            })}
                                        </div>
                                        <div>
                                            <span className="block text-xs uppercase text-muted-foreground">
                                                Other charges
                                            </span>
                                            {quote.currency}{' '}
                                            {Number(quote.other_charges_amount).toLocaleString(
                                                undefined,
                                                { minimumFractionDigits: 2 },
                                            )}
                                        </div>
                                        <div>
                                            <span className="block text-xs uppercase text-muted-foreground">
                                                Discount
                                            </span>
                                            {Number(quote.discount_amount).toLocaleString(
                                                undefined,
                                                { minimumFractionDigits: 2 },
                                            )}
                                            {quote.discount_mode === 'percent' ? ' %' : ` ${quote.currency}`}
                                        </div>
                                        <div className="col-span-2">
                                            <span className="block text-xs uppercase text-muted-foreground">
                                                Lead time
                                            </span>
                                            {quote.lead_time_value
                                                ? `${quote.lead_time_value} ${quote.lead_time_unit}`
                                                : quote.lead_time_text ?? '—'}
                                        </div>
                                        <div className="col-span-2">
                                            <span className="block text-xs uppercase text-muted-foreground">
                                                Review status
                                            </span>
                                            {quote.review_status}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="mb-2 text-sm font-semibold">Line items</h4>
                                        <ul className="space-y-2">
                                            {requestedItems.map((requestedItem) => {
                                                const matching = quote.items.find(
                                                    (item) =>
                                                        item.price_request_item_id ===
                                                        requestedItem.id,
                                                );

                                                return (
                                                    <li
                                                        key={requestedItem.id}
                                                        className="rounded-md border border-border px-3 py-2"
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <span className="min-w-0 text-sm">
                                                                {requestedItem.description}
                                                            </span>
                                                            <span className="text-sm">
                                                                {matching ? (
                                                                    <>
                                                                        {quote.currency}{' '}
                                                                        {Number(
                                                                            matching.line_total,
                                                                        ).toLocaleString(undefined, {
                                                                            minimumFractionDigits: 2,
                                                                        })}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-destructive">
                                                                        Missing item
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        {matching && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {Number(matching.quantity)}{' '}
                                                                {matching.unit_of_measure} ×{' '}
                                                                {matching.unit_price === null ||
                                                                matching.unit_price === ''
                                                                    ? 'no price'
                                                                    : `${quote.currency} ${Number(
                                                                          matching.unit_price,
                                                                      ).toLocaleString(undefined, {
                                                                          minimumFractionDigits: 2,
                                                                      })}`}
                                                                {matching.quantity !==
                                                                    requestedItem.quantity ||
                                                                matching.unit_of_measure !==
                                                                    requestedItem.unit_of_measure
                                                                    ? ' · different quantity or unit'
                                                                    : ''}
                                                            </p>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                            {quote.items
                                                .filter((item) => !item.price_request_item_id)
                                                .map((item) => (
                                                    <li
                                                        key={`extra-${item.id}`}
                                                        className="rounded-md border border-border px-3 py-2"
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <span className="text-sm">
                                                                {item.description}
                                                            </span>
                                                            <span className="text-sm">
                                                                {quote.currency}{' '}
                                                                {Number(
                                                                    item.line_total,
                                                                ).toLocaleString(undefined, {
                                                                    minimumFractionDigits: 2,
                                                                })}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Not linked to a requested item
                                                        </p>
                                                    </li>
                                                ))}
                                        </ul>
                                    </div>

                                    {quote.specification_compliance && (
                                        <p className="text-sm text-muted-foreground">
                                            Specification compliance: {quote.specification_compliance}
                                        </p>
                                    )}
                                    {quote.exclusions && (
                                        <p className="text-sm text-muted-foreground">
                                            Exclusions: {quote.exclusions}
                                        </p>
                                    )}

                                    {comparison.missing_item_ids.length > 0 && (
                                        <p className="text-sm font-medium text-destructive">
                                            Missing{' '}
                                            {comparison.missing_item_ids.length} requested item(s).
                                        </p>
                                    )}
                                    {comparison.has_missing_prices && (
                                        <p className="text-sm font-medium text-destructive">
                                            One or more line items have no price.
                                        </p>
                                    )}
                                    {comparison.quantity_mismatches > 0 && (
                                        <p className="text-sm font-medium text-destructive">
                                            {comparison.quantity_mismatches} line item(s) have a
                                            different quantity or unit.
                                        </p>
                                    )}
                                    {quote.currency !== priceRequest.currency && (
                                        <p className="text-sm font-medium text-destructive">
                                            This quote uses a different currency (
                                            {quote.currency} vs {priceRequest.currency}) and cannot
                                            be compared by total without a conversion rate.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {canSelectPreferred && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Select a preferred quote</CardTitle>
                            <CardDescription>
                                Selecting a preferred quote records the decision against the exact
                                revision chosen. It does not send a purchase order, email
                                suppliers, or close other inquiries.
                            </CardDescription>
                            {!selectionOpen && <div><Button type="button" onClick={() => setSelectionOpen(true)}>Choose preferred quote</Button></div>}
                        </CardHeader>
                        {selectionOpen && <CardContent>
                            <form id="directory-preferred-quote-form" onSubmit={submitSelection} className="min-w-0 space-y-5 pr-4 pb-28 sm:pr-20 lg:pb-6">
                                <FormActionFab form="directory-preferred-quote-form" cancelHref={route('contact-directory.price-requests.show', priceRequest.uuid)} saveLabel="Save preferred quote" onCancel={closeEditor} disabled={saving || !selectionChoice} />
                                {Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-destructive">{Object.values(errors).join(' ')}</p>}
                                <fieldset className="space-y-2">
                                    <legend className="text-sm font-medium text-foreground">
                                        Preferred quote
                                    </legend>
                                    {comparisons.map((comparison) => (
                                        <label
                                            key={comparison.quote.id}
                                            className="flex items-start gap-3 rounded-md border border-border px-3 py-2"
                                        >
                                            <input
                                                type="radio"
                                                name="preferred_quote"
                                                value={comparison.quote.id}
                                                checked={
                                                    selectionChoice ===
                                                    String(comparison.quote.id)
                                                }
                                                onChange={(event) =>
                                                    setSelectionChoice(event.target.value)
                                                }
                                                disabled={!comparison.is_comparable}
                                                className="mt-1"
                                            />
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium">
                                                    {comparison.quote.inquiry?.contact
                                                        ? `${comparison.quote.inquiry.contact.first_name} ${
                                                              comparison.quote.inquiry.contact
                                                                  .last_name ?? ''
                                                          }`
                                                        : comparison.quote.inquiry?.title ??
                                                          'Supplier quote'}{' '}
                                                    · revision{' '}
                                                    {comparison.quote.revision_number}
                                                </span>
                                                <span className="block text-sm text-muted-foreground">
                                                    {comparison.quote.currency}{' '}
                                                    {Number(
                                                        comparison.quote.grand_total,
                                                    ).toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                    })}
                                                    {!comparison.is_comparable &&
                                                        ' · not directly comparable'}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </fieldset>

                                <div>
                                    <label htmlFor="quote-selection-reason" className="mb-2 block text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                        Selection reason
                                    </label>
                                    <TextInput
                                        id="quote-selection-reason"
                                        className="h-11 w-full min-w-0 border-border"
                                        value={selectionReason}
                                        onChange={(event) =>
                                            setSelectionReason(event.target.value)
                                        }
                                        placeholder="Why this quote was selected"
                                        required
                                    />
                                </div>

                            </form>
                        </CardContent>}
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
