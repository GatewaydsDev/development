import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type InspectorTab = 'basics' | 'size' | 'specs' | 'requirements' | 'notes' | 'references';

const tabs: { id: InspectorTab; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'size', label: 'Size' },
    { id: 'specs', label: 'Specs' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'notes', label: 'Notes' },
    { id: 'references', label: 'References' },
];

type Props = {
    tab: InspectorTab | null;
    onTab: (tab: InspectorTab | null) => void;
    editor: ReactNode;
    references: ReactNode;
};

export function InspectorTabs({ tab, onTab }: Pick<Props, 'tab' | 'onTab'>) {
    return (
        <div className="flex shrink-0 items-center gap-2 border-b border-[#c5d0dc] bg-[#eef3f8] px-2 py-1.5" onPointerDown={(event) => event.stopPropagation()}>
            <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[#16324F]">Object inspector</p>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1" role="tablist" aria-label="Object inspector">
                {tabs.map((item) => {
                    const active = tab === item.id;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={cn(
                                'rounded-md px-2.5 py-1 text-sm font-semibold',
                                active
                                    ? 'bg-[#16324F] text-white'
                                    : 'bg-white text-[#16324F] hover:bg-[#d6e6f8]',
                            )}
                            onClick={() => onTab(active ? null : item.id)}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function InspectorPanel({ tab, editor, references }: Pick<Props, 'tab' | 'editor' | 'references'>) {
    if (!tab) {
        return null;
    }

    return (
        <aside className="flex h-full w-[min(24rem,42vw)] min-h-0 shrink-0 flex-col overflow-hidden border-l border-[#d5deea] bg-white" onPointerDown={(event) => event.stopPropagation()}>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {tab === 'references' ? <div className="p-3">{references}</div> : editor}
            </div>
        </aside>
    );
}
