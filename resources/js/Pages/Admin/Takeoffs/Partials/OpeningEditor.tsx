import InspectorSelect from '@/Components/InspectorSelect';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { router } from '@inertiajs/react';
import { SearchIcon } from 'lucide-react';
import { createContext, FormEvent, ReactNode, useContext, useEffect, useState } from 'react';
import { countMark } from '../pinLabels';
import type { TakeoffDocument, TakeoffOpening } from '../types';
import type { PdfPoint } from './PdfWorkspace';

type Errors = Record<string, string>;

type Props = {
    takeoffUuid: string;
    opening: TakeoffOpening | null;
    openings: TakeoffOpening[];
    creating: boolean;
    documents: TakeoffDocument[];
    pendingMarker: PdfPoint | null;
    canEdit: boolean;
    onClose: () => void;
    onDirty: (dirty: boolean) => void;
    onSelect: (choice: number | 'new' | null) => void;
};

function openingForm(opening: TakeoffOpening | null, creating: boolean) {
    const waived: Record<string, string> = opening?.waived_checks && !Array.isArray(opening.waived_checks) ? opening.waived_checks : {};

    if (!opening || creating) {
        return empty;
    }

    return {
        ...empty,
        tag: opening.tag ?? '',
        is_bulk: opening.is_bulk,
        opening_type: opening.opening_type,
        location: opening.location ?? '',
        quantity: opening.quantity,
        product_category: opening.product_category ?? '',
        width: opening.width ?? '',
        height: opening.height ?? '',
        depth: opening.depth ?? '',
        dimension_unit: opening.dimension_unit,
        frame_type: opening.frame_type ?? '',
        handing: opening.handing ?? '',
        hardware_set: opening.hardware_set ?? '',
        glazing: opening.glazing ?? '',
        finish: opening.finish ?? '',
        manufacturer: opening.manufacturer ?? '',
        product_model: opening.product_model ?? '',
        product_id: opening.product_id ? String(opening.product_id) : '',
        scope: opening.scope,
        notes: opening.notes ?? '',
        exclusions: opening.exclusions ?? '',
        assumptions: opening.assumptions ?? '',
        disposition: opening.disposition,
        disposition_reason: opening.disposition_reason ?? '',
        acoustic_requirement: opening.acoustic_requirement ?? '',
        rf_requirement: opening.rf_requirement ?? '',
        fire_requirement: opening.fire_requirement ?? '',
        ballistic_requirement: opening.ballistic_requirement ?? '',
        other_requirements: opening.other_requirements ?? '',
        verified_acoustic: opening.verified_acoustic ?? '',
        verified_rf: opening.verified_rf ?? '',
        verified_fire: opening.verified_fire ?? '',
        verified_ballistic: opening.verified_ballistic ?? '',
        verification_status: opening.verification_status,
        requirement_document_id: opening.requirement_document_id ? String(opening.requirement_document_id) : '',
        requirement_page: opening.requirement_page ? String(opening.requirement_page) : '',
        requirement_section: opening.requirement_section ?? '',
        group_id: opening.group_id ? String(opening.group_id) : '',
        needs_review: opening.needs_review,
        waive_dimensions: waived.dimensions ?? '',
        waive_product: waived.product ?? '',
        waive_technical: waived.technical ?? '',
        waive_hardware: waived.hardware ?? '',
        waive_pricing: waived.pricing ?? '',
    };
}

const empty = {
    tag: '',
    is_bulk: false,
    opening_type: 'door',
    location: '',
    quantity: '1',
    product_category: '',
    width: '',
    height: '',
    depth: '',
    dimension_unit: 'in',
    frame_type: '',
    handing: '',
    hardware_set: '',
    glazing: '',
    finish: '',
    manufacturer: '',
    product_model: '',
    product_id: '',
    scope: 'both',
    notes: '',
    exclusions: '',
    assumptions: '',
    disposition: 'active',
    disposition_reason: '',
    acoustic_requirement: '',
    rf_requirement: '',
    fire_requirement: '',
    ballistic_requirement: '',
    other_requirements: '',
    verified_acoustic: '',
    verified_rf: '',
    verified_fire: '',
    verified_ballistic: '',
    verification_status: 'recorded',
    requirement_document_id: '',
    requirement_page: '',
    requirement_section: '',
    group_id: '',
    needs_review: false,
    waive_dimensions: '',
    waive_product: '',
    waive_technical: '',
    waive_hardware: '',
    waive_pricing: '',
};

const inspectorInput = 'h-6 w-full bg-transparent px-1 text-[13px] text-[#1a3d8f] outline-none focus:bg-[#fff8dc] disabled:text-neutral-500';
const InspectorQuery = createContext('');
const InspectorDepth = createContext(0);
const InspectorGroupMatch = createContext(false);

function PropertyRow({ name, children }: { name: string; children: ReactNode }) {
    const query = useContext(InspectorQuery).trim().toLowerCase();
    const depth = useContext(InspectorDepth);
    const groupMatch = useContext(InspectorGroupMatch);

    if (query && !groupMatch && !name.toLowerCase().includes(query)) {
        return null;
    }

    return (
        <div className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] border-b border-[#d6d6d6] text-[13px] hover:bg-[#e7f0fb]">
            <div className="border-r border-[#d6d6d6] bg-[#f7f7f7] py-1 pr-2 text-neutral-900" style={{ paddingLeft: 8 + depth * 14 }}>
                {name}
            </div>
            <div className="min-w-0 bg-white">{children}</div>
        </div>
    );
}

function MarkField({ takeoffUuid, opening, openings, canEdit }: { takeoffUuid: string; opening: TakeoffOpening; openings: TakeoffOpening[]; canEdit: boolean }) {
    const line = openings.findIndex((item) => item.id === opening.id) + 1;
    const effective = countMark(opening.callout, Math.max(line, 1));
    const [value, setValue] = useState(effective);

    useEffect(() => {
        setValue(effective);
    }, [opening.id, effective]);

    const save = () => {
        const next = value.trim();
        const stored = next === '' || next === String(Math.max(line, 1)) ? null : next;
        const current = opening.callout?.trim() || null;

        if (stored === current) {
            setValue(effective);

            return;
        }

        router.patch(route('admin.takeoffs.openings.callout', [takeoffUuid, opening.id]), { callout: stored }, { preserveScroll: true });
    };

    return (
        <PropertyRow name="Mark">
            <input
                aria-label="Mark"
                className={inspectorInput}
                value={value}
                disabled={!canEdit}
                maxLength={12}
                onChange={(event) => setValue(event.target.value)}
                onBlur={save}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                    }
                }}
            />
        </PropertyRow>
    );
}

function PropertyGroup({
    name,
    summary,
    children,
    defaultOpen = false,
}: {
    name: string;
    summary?: string;
    children: ReactNode;
    defaultOpen?: boolean;
}) {
    const query = useContext(InspectorQuery).trim().toLowerCase();
    const depth = useContext(InspectorDepth);
    const [open, setOpen] = useState(defaultOpen);
    const groupMatch = query.length > 0 && name.toLowerCase().includes(query);
    const expanded = query.length > 0 || open;

    return (
        <InspectorGroupMatch.Provider value={groupMatch}>
            <div>
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen((current) => !current)}
                    className="grid w-full grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] border-b border-[#d6d6d6] text-left text-[13px] hover:bg-[#d7e6f8]"
                >
                    <span className="flex items-center gap-1 border-r border-[#d6d6d6] bg-[#f3f3f3] py-1 pr-1" style={{ paddingLeft: 4 + depth * 14 }}>
                        <span className="inline-flex size-3.5 shrink-0 items-center justify-center border border-[#9a9a9a] bg-white text-[11px] leading-none text-neutral-800">
                            {expanded ? '−' : '+'}
                        </span>
                        <span className="truncate">{name}</span>
                    </span>
                    <span className="truncate bg-white px-1 py-1 text-[#1a3d8f]">{summary}</span>
                </button>
                {expanded ? <InspectorDepth.Provider value={depth + 1}>{children}</InspectorDepth.Provider> : null}
            </div>
        </InspectorGroupMatch.Provider>
    );
}

function InspectorCheck({
    checked,
    label,
    disabled,
    onChange,
}: {
    checked: boolean;
    label: string;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex h-6 items-center gap-1.5 px-1 text-[13px] text-[#1a3d8f]">
            <input
                type="checkbox"
                aria-label={label}
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                className="size-3.5 accent-[#1a3d8f]"
            />
            {checked ? 'True' : 'False'}
        </label>
    );
}

export default function OpeningEditor({
    takeoffUuid,
    opening,
    openings,
    creating,
    documents,
    pendingMarker,
    canEdit,
    onClose,
    onDirty,
    onSelect,
}: Props) {
    const selectionKey = creating ? 'new' : opening?.id ?? null;
    const [form, setForm] = useState(() => openingForm(opening, creating));
    const [formSource, setFormSource] = useState<number | 'new' | null>(selectionKey);
    const [errors, setErrors] = useState<Errors>({});
    const [products, setProducts] = useState<{ id: number; name: string; manufacturer: string | null }[]>([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [changed, setChanged] = useState(creating);
    const [query, setQuery] = useState('');
    const editing = Boolean(opening) || creating;

    if (formSource !== selectionKey) {
        setFormSource(selectionKey);
        setForm(openingForm(opening, creating));
        setErrors({});
        setSaved(false);
        setChanged(creating);
    }

    useEffect(() => {
        onDirty(false);
    }, [selectionKey]);

    const set = (key: string, value: string | boolean) => {
        setForm((current) => ({ ...current, [key]: value }));
        setSaved(false);
        setChanged(true);
        onDirty(true);
    };

    const searchProducts = (value: string) => {
        set('manufacturer', value);
        const token = decodeURIComponent(document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '');
        void fetch(`${route('admin.takeoffs.products')}?q=${encodeURIComponent(value)}`, {
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
        }).then((response) => response.json()).then((rows) => setProducts(Array.isArray(rows) ? rows : [])).catch(() => setProducts([]));
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!canEdit || !editing) {
            return;
        }

        setSaving(true);
        const payload = {
            ...form,
            product_id: form.product_id || null,
            requirement_document_id: form.requirement_document_id || null,
            group_id: form.group_id || null,
            width: form.width || null,
            height: form.height || null,
            depth: form.depth || null,
            requirement_page: form.requirement_page || null,
            waived_checks: {
                dimensions: form.waive_dimensions,
                product: form.waive_product,
                technical: form.waive_technical,
                hardware: form.waive_hardware,
                pricing: form.waive_pricing,
            },
            updated_at: opening?.updated_at,
            marker: pendingMarker ? {
                document_id: pendingMarker.documentId,
                page: pendingMarker.page,
                x: pendingMarker.x,
                y: pendingMarker.y,
            } : null,
        };
        const options = {
            preserveScroll: true,
            preserveState: true,
            onError: (formErrors: Errors) => setErrors(formErrors),
            onSuccess: () => {
                onDirty(false);
                setChanged(false);
                setSaved(true);
            },
            onFinish: () => setSaving(false),
        };

        if (opening) {
            router.patch(route('admin.takeoffs.openings.update', [takeoffUuid, opening.id]), payload, options);
        } else {
            router.post(route('admin.takeoffs.openings.store', takeoffUuid), payload, options);
        }
    };

    const text = (name: string, key: keyof typeof empty) => (
        <PropertyRow name={name}>
            <input
                aria-label={name}
                className={inspectorInput}
                value={String(form[key] ?? '')}
                disabled={!canEdit}
                onChange={(event) => set(key, event.target.value)}
            />
            <InputError message={errors[key]} className="px-1" />
        </PropertyRow>
    );

    const area = (name: string, key: keyof typeof empty) => (
        <PropertyRow name={name}>
            <textarea
                aria-label={name}
                rows={2}
                className="w-full bg-transparent px-1 py-1 text-[13px] text-[#1a3d8f] outline-none focus:bg-[#fff8dc] disabled:text-neutral-500"
                value={String(form[key] ?? '')}
                disabled={!canEdit}
                onChange={(event) => set(key, event.target.value)}
            />
            <InputError message={errors[key]} className="px-1" />
        </PropertyRow>
    );

    const messages = Object.values(errors).filter(Boolean);
    const sizeSummary = [form.width, form.height, form.depth].filter(Boolean).join(' × ');
    const scopeLabel = form.scope === 'supply' ? 'Supply' : form.scope === 'installation' ? 'Installation' : 'Supply and installation';
    const spotLabel = form.opening_type === 'window' ? 'window' : 'door';
    const needsSave = canEdit && editing && (changed || pendingMarker !== null);

    return (
        <aside aria-label="Object Inspector" className="object-inspector min-w-0">
            <div className="overflow-visible border border-[#b0b0b0] bg-[#f0f0f0] text-neutral-900 shadow-sm">
                <div className={`flex items-center justify-between gap-2 border-b border-[#b0b0b0] px-2 py-1.5 ${needsSave ? 'bg-emerald-50' : 'bg-[#f4f4f4]'}`}>
                    <p className="text-sm font-semibold">Object Inspector</p>
                    <div className="flex items-center gap-1">
                        {saved && !needsSave ? <span className="text-[12px] font-medium text-emerald-800">Saved</span> : null}
                        {canEdit && editing ? (
                            <Button
                                type="submit"
                                form="opening-editor"
                                size="sm"
                                disabled={saving}
                                className={`border-emerald-800 bg-emerald-600 text-white hover:bg-emerald-700 ${needsSave ? 'inspector-save-pulse' : ''}`}
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`border-neutral-700 bg-neutral-700 text-white hover:bg-neutral-800 hover:text-white ${needsSave ? 'inspector-close-pulse' : ''}`}
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </div>
                </div>
                {needsSave ? (
                    <p className="inspector-save-cue border-b border-emerald-300 bg-emerald-600 px-2 py-1.5 text-[12px] font-semibold text-white">
                        Click the green Save button to keep this {spotLabel}.
                    </p>
                ) : null}
                <div className="border-b border-[#b0b0b0] bg-white p-1">
                    <InspectorSelect
                        aria-label="Opening"
                        className="h-8 w-full border border-[#b0b0b0] bg-white px-1 text-sm font-semibold text-neutral-900"
                        value={creating ? 'new' : opening ? String(opening.id) : ''}
                        onChange={(event) => {
                            const value = event.target.value;

                            if (value === 'new') {
                                onSelect('new');
                                return;
                            }

                            onSelect(value ? Number(value) : null);
                        }}
                    >
                        <option value="">Select an opening</option>
                        {canEdit ? <option value="new">New opening</option> : null}
                        {openings.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.is_bulk ? `Bulk ${item.tag ?? item.label}`.trim() : item.label}
                            </option>
                        ))}
                    </InspectorSelect>
                </div>
                <div className="flex items-end border-b border-[#b0b0b0] bg-[#f0f0f0] px-1">
                    <span className="-mb-px border border-b-white border-[#b0b0b0] bg-white px-3 py-1 text-sm">Properties</span>
                </div>
                <label className="flex items-center gap-1.5 border-b border-[#b0b0b0] bg-white px-2">
                    <SearchIcon className="size-4 shrink-0 text-neutral-500" />
                    <input
                        aria-label="Search properties"
                        value={query}
                        placeholder="Search"
                        onChange={(event) => setQuery(event.target.value)}
                        className="h-8 w-full bg-transparent text-sm text-neutral-900 outline-none"
                    />
                </label>
                {messages.length > 0 ? (
                    <div className="border-b border-red-300 bg-red-50 px-2 py-1 text-[12px] text-red-700">
                        {messages.map((message) => <p key={message}>{message}</p>)}
                    </div>
                ) : null}
                <InspectorQuery.Provider value={query}>
                    <form id="opening-editor" onSubmit={submit} className="bg-white">
                        {editing ? (
                            <>
                                <PropertyGroup name="Basics" summary={form.tag || (creating ? 'New' : opening?.label)} defaultOpen>
                                    <PropertyRow name="Bulk quantity">
                                        <InspectorCheck label="Bulk quantity record" checked={form.is_bulk} disabled={!canEdit} onChange={(checked) => set('is_bulk', checked)} />
                                    </PropertyRow>
                                    {opening && !creating ? <MarkField takeoffUuid={takeoffUuid} opening={opening} openings={openings} canEdit={canEdit} /> : null}
                                    {text('Opening tag', 'tag')}
                                    {text('Location / floor', 'location')}
                                    <PropertyRow name="Type">
                                        <InspectorSelect aria-label="Type" className={inspectorInput} value={form.opening_type} disabled={!canEdit} onChange={(event) => set('opening_type', event.target.value)}>
                                            <option value="door">Door</option>
                                            <option value="window">Window</option>
                                        </InspectorSelect>
                                    </PropertyRow>
                                    {text('Quantity', 'quantity')}
                                    {text('Category', 'product_category')}
                                    <PropertyRow name="Scope">
                                        <InspectorSelect aria-label="Scope" className={inspectorInput} value={form.scope} disabled={!canEdit} onChange={(event) => set('scope', event.target.value)}>
                                            <option value="both">Supply and installation</option>
                                            <option value="supply">Supply only</option>
                                            <option value="installation">Installation only</option>
                                        </InspectorSelect>
                                    </PropertyRow>
                                </PropertyGroup>
                                <PropertyGroup name="Size" summary={sizeSummary ? `${sizeSummary} ${form.dimension_unit}` : form.dimension_unit} defaultOpen>
                                    {text('Width', 'width')}
                                    {text('Height', 'height')}
                                    {text('Depth', 'depth')}
                                    <PropertyRow name="Unit">
                                        <InspectorSelect aria-label="Unit" className={inspectorInput} value={form.dimension_unit} disabled={!canEdit} onChange={(event) => set('dimension_unit', event.target.value)}>
                                            <option value="in">Inches</option>
                                            <option value="ft">Feet</option>
                                            <option value="mm">Millimeters</option>
                                            <option value="cm">Centimeters</option>
                                        </InspectorSelect>
                                    </PropertyRow>
                                </PropertyGroup>
                                <PropertyGroup name="Specs" summary={form.product_model || form.frame_type}>
                                    {text('Frame', 'frame_type')}
                                    {text('Handing', 'handing')}
                                    {text('Hardware set', 'hardware_set')}
                                    {text('Glazing', 'glazing')}
                                    {text('Finish', 'finish')}
                                    {text('Product / model', 'product_model')}
                                    <PropertyRow name="Manufacturer">
                                        <input
                                            aria-label="Manufacturer"
                                            className={inspectorInput}
                                            value={form.manufacturer}
                                            placeholder="Search catalog or type a manufacturer"
                                            disabled={!canEdit}
                                            onChange={(event) => searchProducts(event.target.value)}
                                        />
                                    </PropertyRow>
                                    {products.length ? (
                                        <PropertyRow name="Catalog product">
                                            <InspectorSelect
                                                aria-label="Catalog product"
                                                className={inspectorInput}
                                                value={form.product_id}
                                                disabled={!canEdit}
                                                onChange={(event) => {
                                                    const product = products.find((item) => String(item.id) === event.target.value);
                                                    set('product_id', event.target.value);
                                                    if (product) {
                                                        set('product_model', product.name);
                                                        set('manufacturer', product.manufacturer ?? '');
                                                    }
                                                }}
                                            >
                                                <option value="">No catalog product</option>
                                                {products.map((product) => <option key={product.id} value={product.id}>{product.manufacturer ? `${product.manufacturer} — ` : ''}{product.name}</option>)}
                                            </InspectorSelect>
                                        </PropertyRow>
                                    ) : null}
                                </PropertyGroup>
                                <PropertyGroup name="Requirements" summary={form.verification_status}>
                                    {area('Acoustic / STC', 'acoustic_requirement')}
                                    {area('RF shielding', 'rf_requirement')}
                                    {area('Fire rating', 'fire_requirement')}
                                    {area('Ballistic', 'ballistic_requirement')}
                                    {area('Other', 'other_requirements')}
                                    <PropertyRow name="Source document">
                                        <InspectorSelect aria-label="Source document" className={inspectorInput} value={form.requirement_document_id} disabled={!canEdit} onChange={(event) => set('requirement_document_id', event.target.value)}>
                                            <option value="">None</option>
                                            {documents.map((item) => <option key={item.id} value={item.id}>{item.original_filename}</option>)}
                                        </InspectorSelect>
                                    </PropertyRow>
                                    {text('Source page', 'requirement_page')}
                                    {text('Source section', 'requirement_section')}
                                    <PropertyRow name="Verification">
                                        <InspectorSelect aria-label="Verification" className={inspectorInput} value={form.verification_status} disabled={!canEdit} onChange={(event) => set('verification_status', event.target.value)}>
                                            <option value="recorded">Requirement recorded</option>
                                            <option value="proposed">Product proposed</option>
                                            <option value="pending">Technical verification pending</option>
                                            <option value="completed">Technical verification completed</option>
                                        </InspectorSelect>
                                    </PropertyRow>
                                    {opening?.verified_by && form.verification_status === 'completed' ? (
                                        <PropertyRow name="Verified by">
                                            <p className="px-1 py-1 text-[13px] text-[#1a3d8f]">{opening.verified_by}</p>
                                        </PropertyRow>
                                    ) : null}
                                    {area('Verified acoustic', 'verified_acoustic')}
                                    {area('Verified RF', 'verified_rf')}
                                    {area('Verified fire', 'verified_fire')}
                                    {area('Verified ballistic', 'verified_ballistic')}
                                </PropertyGroup>
                                <PropertyGroup name="Notes" summary={form.disposition === 'active' ? 'Active' : form.disposition === 'excluded' ? 'Excluded' : 'Not applicable'}>
                                    <PropertyRow name="Disposition">
                                        <InspectorSelect aria-label="Disposition" className={inspectorInput} value={form.disposition} disabled={!canEdit} onChange={(event) => set('disposition', event.target.value)}>
                                            <option value="active">Active</option>
                                            <option value="excluded">Excluded</option>
                                            <option value="not_applicable">Not applicable</option>
                                        </InspectorSelect>
                                    </PropertyRow>
                                    {text('Disposition reason', 'disposition_reason')}
                                    {text('Waive dimensions', 'waive_dimensions')}
                                    {text('Waive product', 'waive_product')}
                                    {text('Waive technical', 'waive_technical')}
                                    {text('Waive hardware', 'waive_hardware')}
                                    {text('Waive pricing', 'waive_pricing')}
                                    {area('Notes', 'notes')}
                                    {area('Exclusions', 'exclusions')}
                                    {area('Assumptions', 'assumptions')}
                                    <PropertyRow name="Needs review">
                                        <InspectorCheck label="Still needs review after a document change" checked={form.needs_review} disabled={!canEdit} onChange={(checked) => set('needs_review', checked)} />
                                    </PropertyRow>
                                </PropertyGroup>
                            </>
                        ) : (
                            <p className="px-2 py-3 text-sm text-neutral-600">
                                Select an opening on the drawing or in the list, or choose one above.
                            </p>
                        )}
                    </form>
                </InspectorQuery.Provider>
                <div className="border-t border-[#b0b0b0] bg-[#f4f4f4] px-2 py-1 text-[11px] text-neutral-600">
                    {query.trim()
                        ? `Showing matches for “${query.trim()}”`
                        : editing
                            ? needsSave
                                ? `Click the green Save button to keep this ${spotLabel}. Close leaves it unchanged.`
                                : `${form.is_bulk ? 'Bulk quantity record.' : 'Tagged opening.'} ${scopeLabel}. The green Save button keeps this ${spotLabel}. The corner button saves the takeoff.`
                            : 'All shown'}
                </div>
            </div>
        </aside>
    );
}
