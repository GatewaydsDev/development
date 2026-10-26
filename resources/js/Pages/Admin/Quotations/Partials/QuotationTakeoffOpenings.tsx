import { Button } from '@/Components/ui/button';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import type { QuotationLineItemFormData, QuotationTakeoffOption } from '../types';

type Props = {
    projectSelected: boolean;
    takeoffs: QuotationTakeoffOption[];
    lineItems: QuotationLineItemFormData[];
    onChange: (items: QuotationLineItemFormData[]) => void;
};

export default function QuotationTakeoffOpenings({ projectSelected, takeoffs, lineItems, onChange }: Props) {
    const [takeoffId, setTakeoffId] = useState<number | null>(takeoffs[0]?.id ?? null);
    const [selected, setSelected] = useState<number[]>([]);
    const [notice, setNotice] = useState('');
    const takeoff = takeoffs.find((item) => item.id === takeoffId) ?? null;

    const addSelected = () => {
        if (!takeoff) {
            return;
        }

        const existing = new Set(lineItems.map((item) => item.description.trim()));
        const additions = takeoff.openings
            .filter((opening) => selected.includes(opening.id) && !existing.has(opening.description.trim()))
            .map((opening) => ({
                description: opening.description,
                quantity: opening.quantity,
                size: opening.size,
                unit_price: '',
            }));
        const skipped = selected.length - additions.length;

        if (additions.length > 0) {
            onChange([...lineItems, ...additions]);
        }

        setSelected([]);
        setNotice(additions.length === 0
            ? 'Those openings are already on this quotation.'
            : `Added ${additions.length} ${additions.length === 1 ? 'opening' : 'openings'}.${skipped > 0 ? ` ${skipped} already on the quotation ${skipped === 1 ? 'was' : 'were'} left as is.` : ''} Save the quotation to keep them.`);
    };

    return (
        <section
            id="quotation-openings"
            className="scroll-mt-48 flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5"
        >
            <div>
                <h3 className="text-base font-semibold text-foreground">Takeoff openings</h3>
                <p className="mt-1 text-sm text-muted-foreground">Choose a takeoff for this project, then select the openings to put on the quotation. Each opening is added once, with its size and specs.</p>
            </div>
            {!projectSelected ? (
                <p className="text-sm text-muted-foreground">Select a project to see its takeoffs.</p>
            ) : takeoffs.length === 0 ? (
                <p className="text-sm text-muted-foreground">This project has no takeoffs yet.</p>
            ) : (
                <>
                    <div className="grid gap-2">
                        {takeoffs.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`rounded-md border px-3 py-2 text-left text-sm ${item.id === takeoff?.id ? 'border-[#16324F] bg-[#16324F] text-white' : 'bg-background'}`}
                                onClick={() => {
                                    setTakeoffId(item.id);
                                    setSelected([]);
                                    setNotice('');
                                }}
                            >
                                <span className="font-medium">{item.title}</span>
                                <span className="ml-2">Revision {item.revision_number}</span>
                                <span className="ml-2">{item.opening_count} {item.opening_count === 1 ? 'opening' : 'openings'}</span>
                            </button>
                        ))}
                    </div>
                    {takeoff && takeoff.openings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">This takeoff has no openings to add.</p>
                    ) : null}
                    {takeoff && takeoff.openings.length > 0 ? (
                        <div className="max-h-80 overflow-auto rounded-md border">
                            <table className="min-w-full text-sm">
                                <thead className="sticky top-0 z-10 text-left text-white">
                                    <tr>
                                        <th className="bg-[#16324F] px-2 py-2"> </th>
                                        <th className="bg-[#16324F] px-2 py-2">Tag</th>
                                        <th className="bg-[#16324F] px-2 py-2">Type</th>
                                        <th className="bg-[#16324F] px-2 py-2">Qty</th>
                                        <th className="bg-[#16324F] px-2 py-2">Size</th>
                                        <th className="bg-[#16324F] px-2 py-2">Specs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {takeoff.openings.map((opening) => (
                                        <tr key={opening.id} className="border-t">
                                            <td className="px-2 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.includes(opening.id)}
                                                    aria-label={`Select ${opening.tag || opening.description}`}
                                                    onChange={(event) => setSelected((current) => event.target.checked ? [...current, opening.id] : current.filter((id) => id !== opening.id))}
                                                />
                                            </td>
                                            <td className="px-2 py-2">{opening.tag || '—'}</td>
                                            <td className="px-2 py-2">{opening.opening_type}</td>
                                            <td className="px-2 py-2">{opening.quantity}</td>
                                            <td className="px-2 py-2">{opening.size || '—'}</td>
                                            <td className="px-2 py-2">{opening.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="button" variant="create" disabled={selected.length === 0} onClick={addSelected}>
                            <PlusIcon data-icon="inline-start" />
                            Add selected openings
                        </Button>
                        {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
                    </div>
                </>
            )}
            {lineItems.some((item) => item.description.trim() !== '') ? (
                <div className="overflow-x-auto rounded-md border">
                    <p className="bg-muted px-3 py-2 text-sm font-medium">On this quotation</p>
                    <table className="min-w-full text-sm">
                        <tbody>
                            {lineItems.map((item, index) => item.description.trim() === '' ? null : (
                                <tr key={`${item.description}-${index}`} className="border-t">
                                    <td className="px-2 py-2">{item.quantity}</td>
                                    <td className="px-2 py-2">{item.size || '—'}</td>
                                    <td className="px-2 py-2">{item.description}</td>
                                    <td className="px-2 py-2 text-right">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => onChange(lineItems.filter((_, itemIndex) => itemIndex !== index))}
                                        >
                                            Remove
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </section>
    );
}
