import CreatableSelect, { type CreatableOption } from '@/Components/CreatableSelect';
import InputError from '@/Components/InputError';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/Components/ui/dialog';
import type { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import type { OpeningForm } from './OpeningEditor';

type CatalogName = { id: number | null; name: string };

function storedOpeningType(name: string): string {
    const lower = name.trim().toLowerCase();

    if (lower === 'door' || lower === 'doors') {
        return 'door';
    }

    if (lower === 'window' || lower === 'windows') {
        return 'window';
    }

    return name.trim();
}

function namedOptions(names: string[]): CreatableOption[] {
    const seen = new Set<string>();
    const options: CreatableOption[] = [];

    names.forEach((name) => {
        const trimmed = name.trim();
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
}: {
    open: boolean;
    title: string;
    form: OpeningForm;
    errors: Record<string, string>;
    saving: boolean;
    onChange: (patch: Partial<OpeningForm>) => void;
    onClose: () => void;
    onSave: () => void;
}) {
    const page = usePage<PageProps<{
        doorTypes?: { id: number; name: string }[];
        openingCategories?: CatalogName[];
        openingTypes?: { id: number; name: string }[];
    }>>();
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
            options.push({ id: stored, name: name.trim() });
        });

        return options;
    }, [form.opening_type, page.props.openingTypes]);
    const doorTypes = (page.props.doorTypes ?? []).map((type) => ({ id: type.id, name: type.name }));
    const categoryValue = categoryOptions.find((option) => option.name.toLowerCase() === form.product_category.trim().toLowerCase());
    const extraErrors = Object.entries(errors).filter(([name, message]) => message && !shownErrors.has(name));

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit {title}</DialogTitle>
                    <DialogDescription>Change this opening and save it. The row stays on the list.</DialogDescription>
                </DialogHeader>
                <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
                    <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                    {extraErrors.map(([name, message]) => <InputError key={name} message={message} className="sm:col-span-2" />)}
                    <label className="grid gap-1 text-sm sm:col-span-2">
                        <span className="font-medium">Opening tag</span>
                        <TextInput value={form.tag} onChange={(event) => onChange({ tag: event.target.value })} placeholder="Tag" />
                        <InputError message={errors.tag} />
                    </label>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input
                            type="checkbox"
                            checked={form.is_bulk}
                            onChange={(event) => onChange({ is_bulk: event.target.checked })}
                        />
                        Bulk quantity record
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
                    {form.opening_type === 'door' ? (
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
                    ) : null}
                    <label className="grid gap-1 text-sm">
                        <span className="font-medium">Quantity</span>
                        <TextInput value={form.quantity} onChange={(event) => onChange({ quantity: event.target.value })} inputMode="decimal" />
                        <InputError message={errors.quantity} />
                    </label>
                    <label className="grid gap-1 text-sm">
                        <span className="font-medium">Location</span>
                        <TextInput value={form.location} onChange={(event) => onChange({ location: event.target.value })} placeholder="Floor or room" />
                        <InputError message={errors.location} />
                    </label>
                    <label className="grid gap-1 text-sm">
                        <span className="font-medium">Width</span>
                        <TextInput value={form.width} onChange={(event) => onChange({ width: event.target.value })} />
                        <InputError message={errors.width} />
                    </label>
                    <label className="grid gap-1 text-sm">
                        <span className="font-medium">Height</span>
                        <TextInput value={form.height} onChange={(event) => onChange({ height: event.target.value })} />
                        <InputError message={errors.height} />
                    </label>
                    <label className="grid gap-1 text-sm">
                        <span className="font-medium">Depth</span>
                        <TextInput value={form.depth} onChange={(event) => onChange({ depth: event.target.value })} />
                        <InputError message={errors.depth} />
                    </label>
                    <label className="grid gap-1 text-sm">
                        <span className="font-medium">Unit</span>
                        <select className="h-12 rounded-md border-gray-300 py-2 text-sm leading-6" value={form.dimension_unit} onChange={(event) => onChange({ dimension_unit: event.target.value })}>
                            <option value="in">Inches</option>
                            <option value="ft">Feet</option>
                            <option value="mm">Millimeters</option>
                            <option value="cm">Centimeters</option>
                        </select>
                        <InputError message={errors.dimension_unit} />
                    </label>
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
                    <label className="grid gap-1 text-sm">
                        <span className="font-medium">Scope</span>
                        <select className="h-12 rounded-md border-gray-300 py-2 text-sm leading-6" value={form.scope} onChange={(event) => onChange({ scope: event.target.value })}>
                            <option value="both">Supply and installation</option>
                            <option value="supply">Supply only</option>
                            <option value="installation">Installation only</option>
                        </select>
                        <InputError message={errors.scope} />
                    </label>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
                        <Button type="submit" variant="create" disabled={saving}>{saving ? 'Saving' : 'Save opening'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
