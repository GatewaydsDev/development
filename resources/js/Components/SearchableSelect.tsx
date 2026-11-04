import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon, PlusIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type SearchableOption = { value: string; label: string };

type Props = {
    id?: string;
    value: string;
    options: SearchableOption[];
    onChange: (value: string) => void;
    onCreate?: (label: string) => void;
    createLabel?: string;
    placeholder?: string;
    selectedLabel?: string;
};

export default function SearchableSelect({
    id,
    value,
    options,
    onChange,
    onCreate,
    createLabel = 'Create',
    placeholder = 'Select…',
    selectedLabel,
}: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const root = useRef<HTMLDivElement>(null);
    const selected = options.find((option) => option.value === value);
    const term = query.trim().toLowerCase();
    const filtered = useMemo(
        () => options.filter((option) => option.label.toLowerCase().includes(term)),
        [options, term],
    );
    const canCreate =
        onCreate && term !== '' && !options.some((option) => option.label.toLowerCase() === term);

    useEffect(() => {
        const close = (event: MouseEvent) => {
            if (!root.current?.contains(event.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const pick = (next: string) => {
        onChange(next);
        setOpen(false);
        setQuery('');
    };

    return (
        <div ref={root} className="relative w-full">
            <button
                type="button"
                id={id}
                onClick={() => setOpen((current) => !current)}
                className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-left text-sm text-foreground"
            >
                <span className={cn('truncate', !selected && !selectedLabel && 'text-muted-foreground')}>
                    {selected?.label ?? selectedLabel ?? placeholder}
                </span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-2 shadow-md">
                    <input
                        autoFocus
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                if (filtered[0]) pick(filtered[0].value);
                                else if (canCreate) {
                                    onCreate(query.trim());
                                    setOpen(false);
                                    setQuery('');
                                }
                            }
                        }}
                        placeholder="Search…"
                        className="mb-2 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                    />
                    <ul className="max-h-56 overflow-y-auto">
                        {filtered.map((option) => (
                            <li key={option.value}>
                                <button
                                    type="button"
                                    onClick={() => pick(option.value)}
                                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                                >
                                    <span className="truncate">{option.label}</span>
                                    {option.value === value && <CheckIcon className="size-4" />}
                                </button>
                            </li>
                        ))}
                        {filtered.length === 0 && !canCreate && (
                            <li className="px-2 py-1.5 text-sm text-muted-foreground">No results.</li>
                        )}
                        {canCreate && (
                            <li>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onCreate(query.trim());
                                        setOpen(false);
                                        setQuery('');
                                    }}
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-muted"
                                >
                                    <PlusIcon className="size-4" />
                                    {createLabel} “{query.trim()}”
                                </button>
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
