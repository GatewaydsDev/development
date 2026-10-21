import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { router } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';
import type { TakeoffDocument, TakeoffOpening } from '../types';
import type { PdfPoint } from './PdfWorkspace';

type Errors = Record<string, string>;

type Props = {
    takeoffUuid: string;
    opening: TakeoffOpening | null;
    documents: TakeoffDocument[];
    pendingMarker: PdfPoint | null;
    canEdit: boolean;
    onClose: () => void;
    onDirty: (dirty: boolean) => void;
};

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

export default function OpeningEditor({ takeoffUuid, opening, documents, pendingMarker, canEdit, onClose, onDirty }: Props) {
    const [form, setForm] = useState(empty);
    const [errors, setErrors] = useState<Errors>({});
    const [products, setProducts] = useState<{ id: number; name: string; manufacturer: string | null }[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(opening ? {
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
            waive_dimensions: opening.waived_checks.dimensions ?? '',
            waive_product: opening.waived_checks.product ?? '',
            waive_technical: opening.waived_checks.technical ?? '',
            waive_hardware: opening.waived_checks.hardware ?? '',
            waive_pricing: opening.waived_checks.pricing ?? '',
        } : empty);
        setErrors({});
        onDirty(false);
    }, [opening?.id, opening?.updated_at]);

    const set = (key: string, value: string | boolean) => {
        setForm((current) => ({ ...current, [key]: value }));
        onDirty(true);
    };

    const searchProducts = (query: string) => {
        set('manufacturer', query);
        const token = decodeURIComponent(document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '');
        void fetch(`${route('admin.takeoffs.products')}?q=${encodeURIComponent(query)}`, {
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
        }).then((response) => response.json()).then((rows) => setProducts(Array.isArray(rows) ? rows : [])).catch(() => setProducts([]));
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!canEdit) {
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
            onError: (formErrors: Errors) => setErrors(formErrors),
            onSuccess: () => {
                onDirty(false);
                onClose();
            },
            onFinish: () => setSaving(false),
        };

        if (opening) {
            router.patch(route('admin.takeoffs.openings.update', [takeoffUuid, opening.id]), payload, options);
        } else {
            router.post(route('admin.takeoffs.openings.store', takeoffUuid), payload, options);
        }
    };

    const field = (label: string, key: string, type = 'text') => (
        <label className="block text-sm">
            <span className="text-muted-foreground">{label}</span>
            <TextInput className="mt-1 w-full" type={type} value={String(form[key as keyof typeof form] ?? '')} onChange={(event) => set(key, event.target.value)} />
            <InputError message={errors[key]} />
        </label>
    );

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold">{opening ? opening.label : 'New opening'}</h3>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
            {errors.updated_at ? <p className="text-sm text-destructive">{errors.updated_at}</p> : null}
            <p className="text-xs text-muted-foreground">
                {form.is_bulk ? 'This is a quantity-based bulk record, not one tagged opening.' : 'This is one tagged opening. Extra drawing markers do not increase its quantity.'}
            </p>
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_bulk} onChange={(event) => set('is_bulk', event.target.checked)} />
                Bulk quantity record
            </label>
            <div className="grid gap-3 md:grid-cols-2">
                {field('Opening tag', 'tag')}
                <label className="block text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <select className="mt-1 w-full rounded-md border-gray-300 shadow-sm" value={form.opening_type} onChange={(event) => set('opening_type', event.target.value)}>
                        <option value="door">Door</option>
                        <option value="window">Window</option>
                    </select>
                </label>
                {field('Location / floor', 'location')}
                {field('Quantity', 'quantity')}
                {field('Category', 'product_category')}
                {field('Width', 'width')}
                {field('Height', 'height')}
                {field('Depth', 'depth')}
                <label className="block text-sm">
                    <span className="text-muted-foreground">Dimension unit</span>
                    <select className="mt-1 w-full rounded-md border-gray-300 shadow-sm" value={form.dimension_unit} onChange={(event) => set('dimension_unit', event.target.value)}>
                        <option value="in">Inches</option>
                        <option value="ft">Feet</option>
                        <option value="mm">Millimeters</option>
                        <option value="cm">Centimeters</option>
                    </select>
                </label>
                {field('Frame', 'frame_type')}
                {field(form.opening_type === 'window' ? 'Handing (not required for a fixed window)' : 'Handing', 'handing')}
                {field('Hardware set', 'hardware_set')}
                {field('Glazing', 'glazing')}
                {field('Finish', 'finish')}
                <label className="block text-sm md:col-span-2">
                    <span className="text-muted-foreground">Existing catalog product</span>
                    <TextInput className="mt-1 w-full" value={form.manufacturer} placeholder="Search catalog or type a manufacturer" onChange={(event) => searchProducts(event.target.value)} />
                    {products.length ? (
                        <select className="mt-2 w-full rounded-md border-gray-300 shadow-sm" value={form.product_id} onChange={(event) => {
                            const product = products.find((item) => String(item.id) === event.target.value);
                            set('product_id', event.target.value);
                            if (product) {
                                set('product_model', product.name);
                                set('manufacturer', product.manufacturer ?? '');
                            }
                        }}>
                            <option value="">No catalog product</option>
                            {products.map((product) => <option key={product.id} value={product.id}>{product.manufacturer ? `${product.manufacturer} — ` : ''}{product.name}</option>)}
                        </select>
                    ) : null}
                </label>
                {field('Product / model, if known', 'product_model')}
                <label className="block text-sm">
                    <span className="text-muted-foreground">Scope</span>
                    <select className="mt-1 w-full rounded-md border-gray-300 shadow-sm" value={form.scope} onChange={(event) => set('scope', event.target.value)}>
                        <option value="both">Supply and installation</option>
                        <option value="supply">Supply only</option>
                        <option value="installation">Installation only</option>
                    </select>
                </label>
            </div>
            <InputLabel value="Requirements" />
            <p className="text-xs text-muted-foreground">Record the project requirement separately from the performance of a proposed product. A manufacturer name does not verify compliance.</p>
            <label className="block text-sm">Acoustic / STC<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.acoustic_requirement} onChange={(event) => set('acoustic_requirement', event.target.value)} /></label>
            <label className="block text-sm">RF shielding (frequency ranges, attenuation, and test criteria)<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={3} value={form.rf_requirement} onChange={(event) => set('rf_requirement', event.target.value)} /></label>
            <label className="block text-sm">Fire rating<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.fire_requirement} onChange={(event) => set('fire_requirement', event.target.value)} /></label>
            <label className="block text-sm">Ballistic<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.ballistic_requirement} onChange={(event) => set('ballistic_requirement', event.target.value)} /></label>
            <label className="block text-sm">Other<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.other_requirements} onChange={(event) => set('other_requirements', event.target.value)} /></label>
            <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-sm">Source document
                    <select className="mt-1 w-full rounded-md border-gray-300 shadow-sm" value={form.requirement_document_id} onChange={(event) => set('requirement_document_id', event.target.value)}>
                        <option value="">None</option>
                        {documents.map((item) => <option key={item.id} value={item.id}>{item.original_filename}</option>)}
                    </select>
                </label>
                {field('Source page', 'requirement_page')}
                {field('Source section', 'requirement_section')}
            </div>
            <label className="block text-sm">Verification
                <select className="mt-1 w-full rounded-md border-gray-300 shadow-sm" value={form.verification_status} onChange={(event) => set('verification_status', event.target.value)}>
                    <option value="recorded">Requirement recorded</option>
                    <option value="proposed">Product proposed</option>
                    <option value="pending">Technical verification pending</option>
                    <option value="completed">Technical verification completed</option>
                </select>
            </label>
            {opening?.verified_by && form.verification_status === 'completed' ? <p className="text-sm">Completed by {opening.verified_by}.</p> : null}
            <label className="block text-sm">Verified acoustic performance<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.verified_acoustic} onChange={(event) => set('verified_acoustic', event.target.value)} /></label>
            <label className="block text-sm">Verified RF performance<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.verified_rf} onChange={(event) => set('verified_rf', event.target.value)} /></label>
            <label className="block text-sm">Verified fire performance<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.verified_fire} onChange={(event) => set('verified_fire', event.target.value)} /></label>
            <label className="block text-sm">Verified ballistic performance<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.verified_ballistic} onChange={(event) => set('verified_ballistic', event.target.value)} /></label>
            <label className="block text-sm">Disposition
                <select className="mt-1 w-full rounded-md border-gray-300 shadow-sm" value={form.disposition} onChange={(event) => set('disposition', event.target.value)}>
                    <option value="active">Active</option>
                    <option value="excluded">Excluded</option>
                    <option value="not_applicable">Not applicable</option>
                </select>
            </label>
            {field('Reason for exclusion or not applicable', 'disposition_reason')}
            <p className="text-xs text-muted-foreground">Leave a check blank to keep the review flag. A reason marks that check as an intentional decision.</p>
            {field('Dimensions not applicable because', 'waive_dimensions')}
            {field('Product not applicable because', 'waive_product')}
            {field('Technical verification not applicable because', 'waive_technical')}
            {field('Hardware not applicable because', 'waive_hardware')}
            {field('Pricing not applicable because', 'waive_pricing')}
            <label className="block text-sm">Notes<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.notes} onChange={(event) => set('notes', event.target.value)} /></label>
            <label className="block text-sm">Exclusions<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.exclusions} onChange={(event) => set('exclusions', event.target.value)} /></label>
            <label className="block text-sm">Assumptions<textarea className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={2} value={form.assumptions} onChange={(event) => set('assumptions', event.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.needs_review} onChange={(event) => set('needs_review', event.target.checked)} />
                Still needs review after a document change
            </label>
            {canEdit ? <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save opening'}</Button> : <p className="text-sm text-muted-foreground">You can view this opening.</p>}
        </form>
    );
}
