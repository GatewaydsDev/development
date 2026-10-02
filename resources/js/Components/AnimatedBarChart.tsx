import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export type BarChartItem = {
    key: string;
    label: string;
    value: number;
    display?: string;
};

const barColors: Record<string, string> = {
    lead: 'bg-sky-500',
    quoted: 'bg-indigo-500',
    approved: 'bg-emerald-500',
    scheduled: 'bg-blue-500',
    in_progress: 'bg-amber-500',
    completed: 'bg-green-500',
    invoiced: 'bg-purple-500',
    cancelled: 'bg-rose-500',
    preliminary: 'bg-cyan-500',
    draft: 'bg-slate-500',
    sent: 'bg-cyan-500',
    accepted: 'bg-teal-500',
    expired: 'bg-amber-500',
    declined: 'bg-rose-500',
    low: 'bg-slate-400',
    normal: 'bg-slate-500',
    high: 'bg-amber-500',
    urgent: 'bg-rose-500',
};

const fallbackBarColors = [
    'bg-sky-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-teal-500',
    'bg-amber-500',
    'bg-rose-500',
];

export function AnimatedBarChart({
    items,
    emptyLabel = 'Nothing to show yet.',
    hideZeros = true,
}: {
    items: BarChartItem[];
    emptyLabel?: string;
    hideZeros?: boolean;
}) {
    const max = Math.max(1, ...items.map((item) => item.value));
    const signature = items.map((item) => `${item.key}:${item.value}`).join('|');
    const [grown, setGrown] = useState(false);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');

        if (media.matches) {
            setGrown(true);

            return;
        }

        setGrown(false);

        let secondFrame = 0;
        const firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => setGrown(true));
        });

        return () => {
            window.cancelAnimationFrame(firstFrame);
            window.cancelAnimationFrame(secondFrame);
        };
    }, [signature]);

    if (
        items.length === 0 ||
        (hideZeros && items.every((item) => item.value === 0))
    ) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                {emptyLabel}
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {items.map((item, index) => {
                const width =
                    item.value === 0
                        ? 0
                        : Math.max((item.value / max) * 100, 8);

                return (
                    <div
                        key={item.key}
                        className="grid grid-cols-[minmax(5.5rem,9rem)_minmax(0,1fr)_auto] items-center gap-3"
                    >
                        <span className="break-words text-sm font-medium leading-tight text-foreground">
                            {item.label}
                        </span>
                        <div
                            className="h-3 overflow-hidden rounded-full bg-muted"
                            role="img"
                            aria-label={`${item.label}: ${item.display ?? item.value}`}
                        >
                            <div
                                className={cn(
                                    'h-full rounded-full',
                                    barColors[item.key] ??
                                        fallbackBarColors[
                                            index % fallbackBarColors.length
                                        ],
                                )}
                                style={{
                                    width: grown ? `${width}%` : '0%',
                                    transitionProperty: 'width',
                                    transitionDuration: '750ms',
                                    transitionTimingFunction:
                                        'cubic-bezier(0.22, 1, 0.36, 1)',
                                    transitionDelay: `${index * 55}ms`,
                                }}
                            />
                        </div>
                        <span className="min-w-8 text-right text-sm font-semibold tabular-nums text-foreground">
                            {item.display ?? item.value}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
