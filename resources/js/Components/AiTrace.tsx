import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { CheckIcon, LoaderCircleIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type AiTraceEntry = {
    id: string;
    command: string;
    steps: string[];
    status: 'working' | 'done' | 'error';
};

export default function AiTrace({
    entries,
    onClear,
}: {
    entries: AiTraceEntry[];
    onClear: () => void;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const seen = useRef(0);

    useEffect(() => {
        if (entries.length > seen.current) {
            setCollapsed(false);
        }

        seen.current = entries.length;
    }, [entries.length]);

    if (entries.length === 0) {
        return null;
    }

    if (collapsed) {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-background shadow-lg"
                onClick={() => setCollapsed(false)}
            >
                Trace ({entries.length})
            </Button>
        );
    }

    return (
        <section
            aria-live="polite"
            aria-label="AI trace"
            className="flex max-h-[min(24rem,70vh)] w-[min(20rem,calc(100vw-16rem))] flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-xl"
        >
            <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <h2 className="text-sm font-semibold">AI trace</h2>
                <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="xs" onClick={onClear}>
                        Clear
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Hide the AI trace"
                        onClick={() => setCollapsed(true)}
                    >
                        <XIcon />
                    </Button>
                </div>
            </header>
            <ol className="flex flex-col gap-3 overflow-y-auto p-3">
                {entries.map((entry) => (
                    <li key={entry.id} className="flex flex-col gap-1.5">
                        <p className="font-mono text-xs text-muted-foreground">&gt; {entry.command}</p>
                        <ul className="flex flex-col gap-1">
                            {entry.steps.map((step, index) => (
                                <li key={`${entry.id}-${index}`} className="flex items-start gap-1.5 text-sm">
                                    {entry.status === 'working' ? (
                                        <LoaderCircleIcon className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" />
                                    ) : entry.status === 'error' ? (
                                        <XIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                                    ) : (
                                        <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
                                    )}
                                    <span className={cn('whitespace-pre-wrap', entry.status === 'error' && 'text-destructive')}>{step}</span>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ol>
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                Save the page to keep these changes.
            </p>
        </section>
    );
}
