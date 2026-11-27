import InputError from '@/Components/InputError';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { money, type OpeningInclusion, type SupplierQuote } from '../types';

export type CatalogProduct = {
    id: number;
    name: string;
    sku: string | null;
    abbreviation?: string | null;
    kind?: string | null;
    supplier_name?: string | null;
    fire_label?: string | null;
    stc_rating?: string | null;
    rf_shielding?: string | null;
    thickness?: string | null;
    glass_type?: string | null;
    glazing_type?: string | null;
    seal?: string | null;
    configurations?: { id: number; name: string }[];
    handings?: { id: number; name: string }[];
    state_prices?: { tax_state_id: number; unit_price: string | null }[];
};

export type InclusionDraft = {
    product_id: string;
    tax_state_id: string;
    supplier_quote_id: string;
    supplier_name: string;
    unit_price: string;
    notes: string;
};

export default function OpeningInclusions({
    takeoffUuid,
    openingId,
    inclusions,
    quotes,
    canEdit,
    embedded = false,
    presetProductId,
    onDraftChange,
}: {
    takeoffUuid: string;
    openingId: number;
    inclusions: OpeningInclusion[];
    quotes: SupplierQuote[];
    canEdit: boolean;
    embedded?: boolean;
    presetProductId?: string;
    onDraftChange?: (draft: InclusionDraft) => void;
}) {
    const page = usePage<{
        costProducts?: CatalogProduct[];
        priceStates?: { id: number; name: string; abbreviation: string | null }[];
        priceStateId?: number | null;
        errors?: Record<string, string>;
    }>();
    const products = page.props.costProducts ?? [];
    const states = page.props.priceStates ?? [];
    const [productId, setProductId] = useState('');
    const [stateId, setStateId] = useState('');
    const [supplierQuoteId, setSupplierQuoteId] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [unitPrice, setUnitPrice] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const openingQuotes = quotes.filter((quote) => quote.opening_id === null || quote.opening_id === openingId);
    const serverError = page.props.errors?.['inclusion.supplier_name']
        || page.props.errors?.['inclusion.unit_price']
        || page.props.errors?.['inclusion.product_id']
        || page.props.errors?.supplier_name
        || page.props.errors?.unit_price
        || page.props.errors?.product_id
        || '';

    useEffect(() => {
        onDraftChange?.({
            product_id: productId,
            tax_state_id: stateId,
            supplier_quote_id: supplierQuoteId,
            supplier_name: supplierName,
            unit_price: unitPrice,
            notes,
        });
    }, [notes, onDraftChange, productId, stateId, supplierName, supplierQuoteId, unitPrice]);

    const productById = (nextProductId: string) => products.find((item) => String(item.id) === nextProductId);

    const pricedStates = (nextProductId: string) => {
        const priced = new Map(
            (productById(nextProductId)?.state_prices ?? [])
                .filter((row) => row.unit_price !== null && row.unit_price !== '')
                .map((row) => [String(row.tax_state_id), row.unit_price as string]),
        );

        return states
            .filter((state) => priced.has(String(state.id)))
            .map((state) => ({ ...state, unit_price: priced.get(String(state.id)) ?? '' }));
    };

    const priceFor = (nextProductId: string, nextStateId: string) => (
        pricedStates(nextProductId).find((state) => String(state.id) === nextStateId)?.unit_price ?? ''
    );

    const chooseState = (nextProductId: string, currentStateId: string) => {
        const available = pricedStates(nextProductId);
        const preferred = page.props.priceStateId ? String(page.props.priceStateId) : '';

        if (available.some((state) => String(state.id) === currentStateId)) {
            return currentStateId;
        }

        if (preferred && available.some((state) => String(state.id) === preferred)) {
            return preferred;
        }

        return available.length === 1 ? String(available[0].id) : '';
    };

    useEffect(() => {
        if (presetProductId === undefined || presetProductId === productId) {
            return;
        }

        const nextStateId = chooseState(presetProductId, stateId);
        setProductId(presetProductId);
        setStateId(nextStateId);
        setSupplierName(productById(presetProductId)?.supplier_name ?? '');
        setUnitPrice(priceFor(presetProductId, nextStateId));
    }, [presetProductId]);

    const add = () => {
        if (!productId) {
            setError('Choose a verified catalog product.');

            return;
        }

        setError('');
        router.post(route('admin.takeoffs.inclusions.store', [takeoffUuid, openingId]), {
            product_id: Number(productId),
            tax_state_id: stateId ? Number(stateId) : null,
            supplier_quote_id: supplierQuoteId ? Number(supplierQuoteId) : null,
            supplier_name: supplierName,
            unit_price: unitPrice,
            notes,
        }, {
            preserveScroll: true,
            onError: (errors) => {
                const first = Object.values(errors).find((message) => typeof message === 'string');
                setError(typeof first === 'string' ? first : 'The product could not be saved.');
            },
            onSuccess: () => {
                setProductId('');
                setSupplierQuoteId('');
                setSupplierName('');
                setUnitPrice('');
                setNotes('');
            },
        });
    };

    const setStatus = (inclusion: OpeningInclusion, status: OpeningInclusion['inclusion']) => {
        router.patch(route('admin.takeoffs.inclusions.update', [takeoffUuid, openingId, inclusion.id]), {
            inclusion: status,
        }, { preserveScroll: true });
    };

    const selectClass = 'h-10 w-full rounded-md border-input bg-background px-3 text-sm text-foreground shadow-sm';

    return (
        <section className={`space-y-4 rounded-lg border border-border p-4 ${embedded ? 'bg-muted/20' : 'bg-muted/30 sm:col-span-2'}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#16324F] dark:text-emerald-200">Products</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Verified product, supplier, state, and unit price for this opening.</p>
                </div>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground">{inclusions.length}</span>
            </div>
            {inclusions.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground">No products linked yet.</p>
            ) : (
                <ul className="grid gap-2">
                    {inclusions.map((item) => {
                        const status = item.inclusion === 'included'
                            ? { label: 'Included', className: 'bg-emerald-100 text-emerald-800' }
                            : item.inclusion === 'excluded'
                                ? { label: 'Left out', className: 'bg-slate-200 text-slate-700' }
                                : { label: 'Not confirmed', className: 'bg-amber-100 text-amber-900' };
                        const detail = [item.supplier_name, item.state_name, item.quote_number].filter(Boolean).join(' · ');

                        return (
                            <li key={item.id} className="grid gap-2 rounded-md border border-border bg-background p-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <p className="truncate text-sm font-medium">{item.product_name || 'Product removed'}</p>
                                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
                                    </div>
                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail || 'No supplier'}</p>
                                    {item.unit_price ? <p className="mt-0.5 text-xs font-semibold tabular-nums">{money(item.unit_price)}</p> : null}
                                    {item.notes ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.notes}</p> : null}
                                </div>
                                {canEdit ? (
                                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                        <Button type="button" size="xs" variant={item.inclusion === 'included' ? 'create' : 'outline'} onClick={() => setStatus(item, 'included')}>Include</Button>
                                        <Button type="button" size="xs" variant="outline" onClick={() => setStatus(item, 'excluded')}>Leave out</Button>
                                        <Button type="button" size="xs" variant="outline" onClick={() => router.delete(route('admin.takeoffs.inclusions.destroy', [takeoffUuid, openingId, item.id]), { preserveScroll: true })}>Remove</Button>
                                    </div>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            )}
            {canEdit ? (
                <div className="grid gap-5 rounded-md border border-border bg-background p-4 sm:grid-cols-2">
                    <p className="text-sm font-medium sm:col-span-2">{embedded ? 'Supplier price' : 'Add a product'}</p>
                    {embedded ? null : (
                        <label className="grid gap-2 text-sm sm:col-span-2">
                            <span className="font-medium">Verified product</span>
                            <select className={selectClass} value={productId} onChange={(event) => {
                                const id = event.target.value;
                                const nextStateId = chooseState(id, stateId);
                                setProductId(id);
                                setStateId(nextStateId);
                                setSupplierName(productById(id)?.supplier_name ?? '');
                                setUnitPrice(priceFor(id, nextStateId));
                            }}>
                                <option value="">Select a product</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>{product.name}</option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label className="grid gap-2 text-sm">
                        <span className="font-medium">State</span>
                        <select className={selectClass} value={stateId} onChange={(event) => {
                            const id = event.target.value;
                            setStateId(id);
                            setUnitPrice(priceFor(productId, id));
                        }}>
                            <option value="">{productId ? 'Select a state' : 'Select a product first'}</option>
                            {pricedStates(productId).map((state) => (
                                <option key={state.id} value={state.id}>{state.abbreviation ? `${state.abbreviation} — ${state.name}` : state.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="grid gap-2 text-sm">
                        <span className="font-medium">Supplier unit price</span>
                        <MaskedDecimalInput id={`opening-inclusion-price-${openingId}`} className="h-10" prefix="$" value={unitPrice} onChange={setUnitPrice} placeholder="0.00" />
                    </label>
                    <label className="grid gap-2 text-sm">
                        <span className="font-medium">Supplier</span>
                        <TextInput className="h-10" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Supplier name" />
                    </label>
                    <label className="grid gap-2 text-sm">
                        <span className="font-medium">Supplier quote</span>
                        <select className={selectClass} value={supplierQuoteId} onChange={(event) => {
                            const id = event.target.value;
                            setSupplierQuoteId(id);
                            const quote = openingQuotes.find((item) => String(item.id) === id);
                            if (quote) {
                                setSupplierName(quote.supplier_name);
                            }
                        }}>
                            <option value="">No saved quote</option>
                            {openingQuotes.map((quote) => (
                                <option key={quote.id} value={quote.id}>
                                    {quote.supplier_name}{quote.quote_number ? ` ${quote.quote_number}` : ''}{quote.opening_id ? '' : ' · whole takeoff'}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="grid gap-2 text-sm sm:col-span-2">
                        <span className="font-medium">Notes</span>
                        <TextInput className="h-10" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What this price covers" />
                    </label>
                    <div className="sm:col-span-2">
                        <InputError message={error || serverError} />
                        <div className="flex justify-end">
                            <Button type="button" variant="outline" size="sm" onClick={add}>Add to this opening</Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
