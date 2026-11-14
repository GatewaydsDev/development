import { Button } from '@/Components/ui/button';
import type { OpeningProposal } from '@/Pages/Admin/Takeoffs/types';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

type Props = {
    proposals: OpeningProposal[];
    canEdit: boolean;
    onActive: (proposal: OpeningProposal | null) => void;
    onConfirm: (proposal: OpeningProposal, kind: 'door' | 'window') => void;
    onDismiss: (proposal: OpeningProposal) => void;
};

function sizeLabel(proposal: OpeningProposal): string | null {
    const unit = proposal.dimension_unit || 'in';
    const size = [proposal.width, proposal.height].filter(Boolean).join(' × ');

    if (!size) {
        return null;
    }

    return proposal.depth ? `${size} × ${proposal.depth} ${unit}` : `${size} ${unit}`;
}

export default function OpeningReview({ proposals, canEdit, onActive, onConfirm, onDismiss }: Props) {
    const [index, setIndex] = useState(0);
    const [kind, setKind] = useState<'door' | 'window'>('door');
    const current = proposals[Math.min(index, Math.max(proposals.length - 1, 0))] ?? null;

    useEffect(() => {
        onActive(current);
    }, [current, onActive]);

    useEffect(() => {
        setKind(current?.opening_type === 'window' ? 'window' : 'door');
    }, [current?.document_id, current?.tag, current?.opening_type]);

    if (!canEdit || !current) {
        return null;
    }

    const facts = [
        ['Location', current.location],
        ['Size', sizeLabel(current)],
        ['Hand', current.handing],
        ['Frame', current.frame_type],
        ['Hardware', current.hardware_set],
        ['Glazing', current.glazing],
        ['Finish', current.finish],
        ['Acoustic', current.acoustic_requirement],
        ['Fire', current.fire_requirement],
        ['Quantity', current.quantity],
        ['Page', current.requirement_page ? String(current.requirement_page) : null],
        ['Source', current.requirement_section],
        ['Notes', current.notes],
    ].filter((fact): fact is [string, string] => Boolean(fact[1]));

    return (
        <section className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[#16324F]">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Confirm before adding</p>
                    <h3 className="text-lg font-semibold">{current.tag}</h3>
                    <p className="text-sm text-[#3d4d5c]">
                        {index + 1} of {proposals.length} read from the drawing. Check that this is a door or window, then add it with the specs below.
                    </p>
                </div>
                <div className="flex gap-1">
                    <button type="button" className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-40" disabled={index <= 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>Previous</button>
                    <button type="button" className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-40" disabled={index >= proposals.length - 1} onClick={() => setIndex((value) => Math.min(proposals.length - 1, value + 1))}>Next</button>
                </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1" role="group" aria-label="Opening type">
                {(['door', 'window'] as const).map((choice) => (
                    <button
                        key={choice}
                        type="button"
                        aria-pressed={kind === choice}
                        className={cn(
                            'h-9 rounded-lg border text-sm font-semibold capitalize',
                            kind === choice ? 'border-[#16324F] bg-[#16324F] text-white' : 'border-amber-300 bg-white',
                        )}
                        onClick={() => setKind(choice)}
                    >
                        {choice}
                    </button>
                ))}
            </div>
            {facts.length > 0 ? (
                <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                    {facts.map(([label, value]) => (
                        <div key={label} className="rounded-md bg-white px-2 py-1">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5c6b7a]">{label}</dt>
                            <dd>{value}</dd>
                        </div>
                    ))}
                </dl>
            ) : (
                <p className="mt-3 text-sm text-[#3d4d5c]">The tag was found on the sheet. No measurements or location could be read for it.</p>
            )}
            <div className="mt-3 flex gap-2">
                <Button type="button" onClick={() => onConfirm(current, kind)}>Add {current.tag}</Button>
                <Button type="button" variant="outline" onClick={() => onDismiss(current)}>Not an opening</Button>
            </div>
        </section>
    );
}
