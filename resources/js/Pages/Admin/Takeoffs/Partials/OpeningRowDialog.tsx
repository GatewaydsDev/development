import CreatableSelect, { type CreatableOption } from '@/Components/CreatableSelect';
import InputError from '@/Components/InputError';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';
import type { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { OpeningForm } from './OpeningEditor';
import OpeningInclusions, { type CatalogProduct, type InclusionDraft } from './OpeningInclusions';
import type { OpeningInclusion, SupplierQuote } from '../types';

type CatalogName = { id: number | null; name: string };

function text(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function storedOpeningType(name: string | null | undefined): string {
    const value = text(name);
    const lower = value.toLowerCase();

    if (lower === 'door' || lower === 'doors') {
        return 'door';
    }

    if (lower === 'window' || lower === 'windows') {
        return 'window';
    }

    return value;
}

function namedOptions(names: Array<string | null | undefined>): CreatableOption[] {
    const seen = new Set<string>();
    const options: CreatableOption[] = [];

    names.forEach((name) => {
        const trimmed = text(name);
        const key = trimmed.toLowerCase();

        if (trimmed === '' || seen.has(key)) {
            return;
        }

        seen.add(key);
        options.push({ id: trimmed, name: trimmed });
    });

    options.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));

    return options;
}

const controlClass = 'h-10 w-full rounded-md border-input bg-background px-3 text-sm text-foreground shadow-sm';

function SingleCheck({ name, value, options, onChange }: { name: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
    return (
        <div role="group" className="flex flex-wrap gap-1.5">
            {options.map((option) => {
                const checked = String(option.value) === String(value);

                return (
                    <label key={option.value} className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-sm', checked ? 'border-emerald-600 bg-emerald-50 text-foreground dark:bg-emerald-950/40' : 'border-border')}>
                        <input
                            type="checkbox"
                            name={name}
                            className="size-3.5 rounded border-input"
                            checked={checked}
                            onChange={() => onChange(checked ? '' : option.value)}
                        />
                        <span className="leading-5">{option.label}</span>
                    </label>
                );
            })}
        </div>
    );
}

function ProductFacts({ product }: { product: CatalogProduct }) {
    const kind = product.kind === 'window' ? 'Window' : product.kind === 'part' ? 'Part' : product.kind === 'door' ? 'Door' : null;
    const facts = [
        ['Type', kind],
        ['Supplier', product.supplier_name],
        ['SKU', product.sku],
        ['Glass', product.glass_type],
        ['Glazing', product.glazing_type],
        ['Seal', product.seal],
        ['Fire', product.fire_label],
        ['STC', product.stc_rating],
        ['RF', product.rf_shielding],
        ['Thickness', product.thickness],
    ].flatMap(([label, value]) => {
        const shown = text(value);

        return shown ? [[label, shown] as const] : [];
    });

    return (
        <dl className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-2">
            {facts.map(([label, value]) => (
                <div key={label} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="truncate text-sm text-foreground">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-lg border border-border bg-muted/20 p-4">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#16324F] dark:text-emerald-200">{title}</h3>
            {children}
        </section>
    );
}

function Field({ label, className, error, children }: { label: string; className?: string; error?: string; children: ReactNode }) {
    return (
        <label className={cn('grid gap-2 text-sm', className)}>
            <span className="font-medium text-foreground">{label}</span>
            {children}
            <InputError message={error} />
        </label>
    );
}

const shownErrors = new Set([
    'tag',
    'opening_type',
    'door_configuration_id',
    'quantity',
    'width',
    'height',
    'depth',
    'dimension_unit',
    'location',
    'product_category',
    'scope',
]);

export default function OpeningRowDialog({
    open,
    title,
    form,
    errors,
    saving,
    onChange,
    onClose,
    onSave,
    takeoffUuid = '',
    openingId = null,
    inclusions = [],
    quotes = [],
    canConfigure = false,
}: {
    open: boolean;
    title: string;
    form: OpeningForm;
    errors: Record<string, string>;
    saving: boolean;
    onChange: (patch: Partial<OpeningForm>) => void;
    onClose: () => void;
    onSave: (inclusion: InclusionDraft | null) => void;
    takeoffUuid?: string;
    openingId?: number | null;
    inclusions?: OpeningInclusion[];
    quotes?: SupplierQuote[];
    canConfigure?: boolean;
}) {
    const page = usePage<PageProps<{
        doorTypes?: { id: number; name: string }[];
        openingCategories?: CatalogName[];
        openingTypes?: { id: number; name: string }[];
        costProducts?: CatalogProduct[];
    }>>();
    const catalogProducts = page.props.costProducts ?? [];
    const categoryOptions = useMemo(
        () => namedOptions([
            ...(page.props.openingCategories ?? []).map((category) => category.name),
            form.product_category,
        ]),
        [form.product_category, page.props.openingCategories],
    );
    const openingTypeOptions = useMemo(() => {
        const seen = new Set<string>();
        const options: CreatableOption[] = [];

        [...(page.props.openingTypes ?? []).map((type) => type.name), form.opening_type].forEach((name) => {
            const stored = storedOpeningType(name);
            const key = stored.toLowerCase();

            if (stored === '' || seen.has(key)) {
                return;
            }

            seen.add(key);
            options.push({ id: stored, name: text(name) || stored });
        });

        return options;
    }, [form.opening_type, page.props.openingTypes]);
    const inclusionDraft = useRef<InclusionDraft | null>(null);
    const [choiceError, setChoiceError] = useState('');
    const selectedProduct = catalogProducts.find((product) => String(product.id) === form.product_id) ?? null;
    const doorTypes = (selectedProduct?.kind === 'door' && (selectedProduct.configurations ?? []).length > 0
        ? selectedProduct.configurations ?? []
        : page.props.doorTypes ?? []
    ).map((type) => ({ id: type.id, name: type.name }));
    const configurationOptions = doorTypes.map((type) => ({ value: String(type.id), label: type.name }));
    if (form.door_configuration_id && !configurationOptions.some((option) => option.value === String(form.door_configuration_id))) {
        const saved = (page.props.doorTypes ?? []).find((type) => String(type.id) === String(form.door_configuration_id));
        if (saved) {
            configurationOptions.unshift({ value: String(saved.id), label: saved.name });
        }
    }
    const handingOptions = (selectedProduct?.handings ?? []).map((handing) => ({ value: handing.name, label: handing.name }));
    if (form.handing && !handingOptions.some((option) => option.value === form.handing)) {
        handingOptions.unshift({ value: form.handing, label: form.handing });
    }
    const selectedConfiguration = configurationOptions.find((option) => option.value === String(form.door_configuration_id))?.label ?? '';
    const categoryValue = categoryOptions.find((option) => option.name.toLowerCase() === text(form.product_category).toLowerCase());
    const extraErrors = Object.entries(errors).filter(([name, message]) => message && !shownErrors.has(name));
    const size = [form.width, form.height, form.depth].filter(Boolean).join(' × ');
    const summary = [
        form.opening_type === 'window' ? 'Window' : form.opening_type === 'door' ? 'Door' : form.opening_type,
        form.quantity ? `Qty ${form.quantity}` : null,
        size ? `${size} ${form.dimension_unit}` : null,
        form.location || null,
    ].filter(Boolean).join(' · ');

    const chooseProduct = (id: string) => {
        const product = catalogProducts.find((item) => String(item.id) === id);

        if (!product) {
            onChange({
                product_id: '',
                product_model: '',
                manufacturer: '',
                door_configuration_id: '',
            });

            return;
        }

        const configurations = product.configurations ?? [];
        const handings = product.handings ?? [];
        const currentConfiguration = configurations.some((item) => String(item.id) === String(form.door_configuration_id))
            ? String(form.door_configuration_id)
            : '';
        const currentHanding = handings.some((item) => item.name === form.handing) ? form.handing : '';
        const glazing = [product.glass_type, product.glazing_type, product.seal].filter(Boolean).join(' · ');

        setChoiceError('');
        onChange({
            product_id: String(product.id),
            product_model: product.name,
            manufacturer: product.supplier_name ?? '',
            ...(product.kind === 'door' || product.kind === 'window' ? { opening_type: product.kind } : {}),
            door_configuration_id: product.kind === 'door' ? currentConfiguration : '',
            handing: product.kind === 'door' ? currentHanding : form.handing,
            ...(product.kind === 'window' && glazing ? { glazing } : {}),
            ...(!form.scheduled_thickness && product.thickness ? { scheduled_thickness: product.thickness } : {}),
        });
    };

    const saveOpening = () => {
        const configurations = selectedProduct?.configurations ?? [];
        const handings = selectedProduct?.handings ?? [];

        if (selectedProduct?.kind === 'door' && configurations.length > 0 && !form.door_configuration_id) {
            setChoiceError('Select the door configuration for this opening.');

            return;
        }

        if (selectedProduct?.kind === 'door' && handings.length > 0 && !form.handing) {
            setChoiceError('Select the handing for this opening.');

            return;
        }

        setChoiceError('');
        const draft = inclusionDraft.current;
        const alreadyLinked = Boolean(draft?.product_id) && inclusions.some((item) => String(item.product_id) === draft?.product_id);
        onSave(alreadyLinked ? null : draft);
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, open]);

    if (!open || typeof window === 'undefined') {
        return null;
    }

    return createPortal(
        <>
            <div className="fixed inset-0 z-50 bg-zinc-950/50" onClick={onClose} aria-hidden="true" />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-background text-foreground shadow-2xl" role="dialog" aria-modal="true" aria-label={`Edit ${title}`}>
                <div className="flex h-full min-h-0 flex-col">
                <div className="shrink-0 border-b px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-lg font-semibold">Edit {title}</h2>
                            <p className="text-sm text-muted-foreground">{summary || 'Set the opening, then save it on this row.'}</p>
                        </div>
                        <Button type="button" variant="outline" size="icon" aria-label="Close" onClick={onClose}>
                            <XIcon />
                        </Button>
                    </div>
                </div>
                <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); saveOpening(); }}>
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                        {extraErrors.map(([name, message]) => <InputError key={name} message={message} />)}
                        <Section title="Product">
                            <div className="grid gap-5">
                                <label className="grid gap-2 text-sm">
                                    <span className="font-medium text-foreground">Verified product</span>
                                    <select className={controlClass} value={form.product_id} onChange={(event) => chooseProduct(event.target.value)}>
                                        <option value="">Select a product</option>
                                        {catalogProducts.map((product) => (
                                            <option key={product.id} value={product.id}>{product.name}</option>
                                        ))}
                                    </select>
                                </label>
                                {selectedProduct ? <ProductFacts product={selectedProduct} /> : (
                                    <p className="text-sm text-muted-foreground">Select a product. Its details, configuration, and handing show here so you can choose what this opening uses.</p>
                                )}
                                {selectedProduct?.kind === 'door' ? (
                                    <div className="grid gap-5">
                                        {selectedConfiguration || form.handing ? (
                                            <p className="text-sm text-foreground">
                                                {[selectedConfiguration ? `Configuration ${selectedConfiguration}` : null, form.handing ? `Handing ${form.handing}` : null].filter(Boolean).join(' · ')}
                                            </p>
                                        ) : null}
                                        <div className="grid gap-2">
                                            <span className="text-sm font-medium text-foreground">Configuration</span>
                                            <SingleCheck
                                                name="opening-configuration"
                                                value={String(form.door_configuration_id)}
                                                options={configurationOptions}
                                                onChange={(value) => { setChoiceError(''); onChange({ door_configuration_id: value }); }}
                                            />
                                            <InputError message={errors.door_configuration_id} />
                                        </div>
                                        {handingOptions.length > 0 ? (
                                            <div className="grid gap-2">
                                                <span className="text-sm font-medium text-foreground">Handing for this opening</span>
                                                <SingleCheck
                                                    name="opening-handing"
                                                    value={form.handing}
                                                    options={handingOptions}
                                                    onChange={(value) => { setChoiceError(''); onChange({ handing: value }); }}
                                                />
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                                <InputError message={choiceError} />
                            </div>
                        </Section>
                        <Section title="Opening">
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field label="Opening tag" className="sm:col-span-2" error={errors.tag}>
                                    <TextInput className="h-10" value={form.tag} onChange={(event) => onChange({ tag: event.target.value })} placeholder="Tag" />
                                </Field>
                                <label className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm sm:col-span-2">
                                    <input
                                        type="checkbox"
                                        className="size-4 rounded border-input"
                                        checked={form.is_bulk}
                                        onChange={(event) => onChange({ is_bulk: event.target.checked })}
                                    />
                                    <span>
                                        <span className="font-medium">Bulk quantity</span>
                                        <span className="block text-xs text-muted-foreground">A quantity without its own opening tag.</span>
                                    </span>
                                </label>
                                <CreatableSelect
                                    id="opening-row-type"
                                    label="Type"
                                    value={storedOpeningType(form.opening_type)}
                                    options={openingTypeOptions}
                                    createRoute={route('admin.takeoffs.opening-types.store')}
                                    optionsProp="openingTypes"
                                    entityLabel="opening type"
                                    placeholder="Search or add a type"
                                    compact
                                    keepTypedValue
                                    error={errors.opening_type}
                                    onChange={(id, option) => {
                                        const openingType = storedOpeningType(option?.name ?? id);
                                        onChange({
                                            opening_type: openingType,
                                            ...(openingType === 'door' ? {} : { door_configuration_id: '' }),
                                        });
                                    }}
                                />
                                {form.opening_type === 'door' && selectedProduct?.kind !== 'door' ? (
                                    <CreatableSelect
                                        id="opening-row-door-type"
                                        label="Door type"
                                        value={form.door_configuration_id}
                                        options={doorTypes}
                                        createRoute={route('admin.takeoffs.door-types.store')}
                                        optionsProp="doorTypes"
                                        entityLabel="door type"
                                        placeholder="Search or add a door type"
                                        compact
                                        error={errors.door_configuration_id}
                                        onChange={(id) => onChange({ door_configuration_id: id })}
                                    />
                                ) : <span className="hidden sm:block" />}
                                <Field label="Quantity" error={errors.quantity}>
                                    <TextInput className="h-10" value={form.quantity} onChange={(event) => onChange({ quantity: event.target.value })} inputMode="decimal" />
                                </Field>
                                <Field label="Location" error={errors.location}>
                                    <TextInput className="h-10" value={form.location} onChange={(event) => onChange({ location: event.target.value })} placeholder="Floor or room" />
                                </Field>
                            </div>
                        </Section>
                        <Section title="Size">
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field label="Width" error={errors.width}>
                                    <TextInput className="h-10" value={form.width} onChange={(event) => onChange({ width: event.target.value })} />
                                </Field>
                                <Field label="Height" error={errors.height}>
                                    <TextInput className="h-10" value={form.height} onChange={(event) => onChange({ height: event.target.value })} />
                                </Field>
                                <Field label="Depth" error={errors.depth}>
                                    <TextInput className="h-10" value={form.depth} onChange={(event) => onChange({ depth: event.target.value })} />
                                </Field>
                                <Field label="Unit" error={errors.dimension_unit}>
                                    <select className={controlClass} value={form.dimension_unit} onChange={(event) => onChange({ dimension_unit: event.target.value })}>
                                        <option value="in">Inches</option>
                                        <option value="ft">Feet</option>
                                        <option value="mm">Millimeters</option>
                                        <option value="cm">Centimeters</option>
                                    </select>
                                </Field>
                            </div>
                        </Section>
                        <Section title="Classification">
                            <div className="grid gap-5 sm:grid-cols-2">
                                <CreatableSelect
                                    id="opening-row-category"
                                    label="Category"
                                    value={categoryValue ? String(categoryValue.id) : form.product_category}
                                    options={categoryOptions}
                                    createRoute={route('admin.takeoffs.opening-categories.store')}
                                    optionsProp="openingCategories"
                                    entityLabel="category"
                                    placeholder="Search or add a category"
                                    compact
                                    keepTypedValue
                                    error={errors.product_category}
                                    onChange={(id, option) => onChange({ product_category: option?.name ?? id })}
                                />
                                <Field label="Scope" error={errors.scope}>
                                    <select className={controlClass} value={form.scope} onChange={(event) => onChange({ scope: event.target.value })}>
                                        <option value="both">Supply and installation</option>
                                        <option value="supply">Supply only</option>
                                        <option value="installation">Installation only</option>
                                    </select>
                                </Field>
                            </div>
                        </Section>
                        {canConfigure && openingId ? (
                            <OpeningInclusions
                                takeoffUuid={takeoffUuid}
                                openingId={openingId}
                                inclusions={inclusions}
                                quotes={quotes}
                                canEdit
                                embedded
                                presetProductId={form.product_id}
                                onDraftChange={(draft) => {
                                    inclusionDraft.current = draft;
                                }}
                            />
                        ) : null}
                    </div>
                    <div className="flex shrink-0 flex-row justify-end gap-3 border-t bg-muted/30 px-5 py-4">
                        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
                        <Button type="submit" variant="create" disabled={saving}>{saving ? 'Saving' : 'Save opening'}</Button>
                    </div>
                </form>
                </div>
            </aside>
        </>,
        window.document.body,
    );
}
