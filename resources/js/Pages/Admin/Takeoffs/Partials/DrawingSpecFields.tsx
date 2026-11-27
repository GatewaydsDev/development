import InputError from '@/Components/InputError';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { OpeningForm } from './OpeningEditor';
import type { TakeoffOpening } from '../types';

export const drawingSpecCatalog = [
    { key: 'depth', label: 'Depth', placeholder: '' },
    { key: 'scheduled_thickness', label: 'Thickness', placeholder: '1 3/4' },
    { key: 'building_name', label: 'Building', placeholder: 'Building A' },
    { key: 'frame_type', label: 'Frame type', placeholder: 'Hollow metal' },
    { key: 'frame_width', label: 'Frame width', placeholder: '' },
    { key: 'frame_height', label: 'Frame height', placeholder: '' },
    { key: 'frame_depth', label: 'Jamb depth', placeholder: '' },
    { key: 'fire_requirement', label: 'Fire rating', placeholder: '90 min' },
    { key: 'glazing', label: 'Glazing', placeholder: '1/4 in tempered, 6 x 24 vision' },
    { key: 'hardware_set', label: 'Hardware set', placeholder: 'Set 3' },
    { key: 'finish', label: 'Finish', placeholder: 'Paint' },
    { key: 'acoustic_requirement', label: 'Acoustic / STC', placeholder: 'STC 45' },
    { key: 'rf_requirement', label: 'RF shielding', placeholder: '' },
    { key: 'ballistic_requirement', label: 'Ballistic', placeholder: '' },
] as const;

export type DrawingSpecKey = (typeof drawingSpecCatalog)[number]['key'];

const controlClass = 'h-10 w-full rounded-md border-input bg-background px-3 text-sm text-foreground shadow-sm';

function hasValue(opening: TakeoffOpening, key: DrawingSpecKey): boolean {
    const value = opening[key];

    return value !== null && value !== undefined && String(value).trim() !== '';
}

export default function DrawingSpecFields({
    takeoffUuid,
    form,
    errors = {},
    canEdit = true,
    onChange,
}: {
    takeoffUuid: string;
    form: OpeningForm;
    errors?: Record<string, string>;
    canEdit?: boolean;
    onChange: (patch: Partial<OpeningForm>) => void;
}) {
    const page = usePage<{ takeoff?: { spec_fields?: string[]; openings?: TakeoffOpening[] } }>();
    const openings = page.props.takeoff?.openings ?? [];
    const active = drawingSpecCatalog
        .map((field) => field.key)
        .filter((key) => (page.props.takeoff?.spec_fields ?? []).includes(key));
    const available = drawingSpecCatalog.filter((field) => !active.includes(field.key));
    const [adding, setAdding] = useState('');

    const remember = (keys: string[]) => {
        router.patch(route('admin.takeoffs.spec-fields.update', takeoffUuid), {
            spec_fields: keys,
        }, { preserveScroll: true, preserveState: true });
    };

    return (
        <div className="grid gap-5">
            <p className="text-sm text-muted-foreground">
                Only the specifications on this drawing are listed. A field is added when the schedule has it.
            </p>
            {active.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground">No extra specifications on this drawing yet.</p>
            ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                    {active.map((key) => {
                        const field = drawingSpecCatalog.find((item) => item.key === key);
                        const used = openings.some((opening) => hasValue(opening, key));

                        if (!field) {
                            return null;
                        }

                        return (
                            <label key={key} className="grid gap-2 text-sm">
                                <span className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-foreground">{field.label}</span>
                                    {canEdit && !used ? (
                                        <button
                                            type="button"
                                            className="text-xs font-medium text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                                onChange({ [key]: '' });
                                                remember(active.filter((item) => item !== key));
                                            }}
                                        >
                                            Remove
                                        </button>
                                    ) : null}
                                </span>
                                <TextInput
                                    className="h-10"
                                    value={form[key] ?? ''}
                                    placeholder={field.placeholder}
                                    disabled={!canEdit}
                                    onChange={(event) => onChange({ [key]: event.target.value })}
                                />
                                <InputError message={errors[key]} />
                            </label>
                        );
                    })}
                </div>
            )}
            {canEdit && available.length > 0 ? (
                <label className="grid gap-2 text-sm">
                    <span className="font-medium text-foreground">Add a specification</span>
                    <span className="flex gap-2">
                        <select className={controlClass} value={adding} onChange={(event) => setAdding(event.target.value)}>
                            <option value="">Choose a field from the drawing</option>
                            {available.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                        </select>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={adding === ''}
                            onClick={() => {
                                remember([...active, adding]);
                                setAdding('');
                            }}
                        >
                            Add
                        </Button>
                    </span>
                </label>
            ) : null}
        </div>
    );
}
