import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/Components/ui/chart';
import { type ComponentProps, useEffect, useId, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';
import type { BarChartItem } from '@/Components/AnimatedBarChart';

export type ChartStyle = 'pie' | 'bars' | 'lines';

export type ChartPalette = 'default' | 'colorful';

const palettes: Record<ChartPalette, readonly string[]> = {
    default: [
        '#0f766e',
        '#dc2626',
        '#2563eb',
        '#d97706',
        '#7c3aed',
        '#db2777',
        '#0891b2',
        '#65a30d',
    ],
    colorful: [
        '#ff2d55',
        '#ff7a00',
        '#ffd000',
        '#7dff00',
        '#00e6a8',
        '#00c2ff',
        '#3d5afe',
        '#b000ff',
        '#ff2bd6',
        '#00f0ff',
        '#ff4d6d',
        '#c6ff00',
    ],
};

const lighterPieColors: Record<string, string> = {
    '#0f766e': '#5eead4',
    '#65a30d': '#bef264',
    '#dc2626': '#fca5a5',
    '#ff2d55': '#ffb4c4',
    '#7dff00': '#c8f7b0',
    '#00e6a8': '#99f6e4',
    '#c6ff00': '#e4ffb3',
    '#ff4d6d': '#fecdd3',
};

function pieColor(color: string): string {
    return lighterPieColors[color.toLowerCase()] ?? color;
}

function mixWithWhite(hex: string, amount: number): string {
    const value = Number.parseInt(hex.slice(1), 16);
    const channel = (shift: number) => Math.round(((value >> shift) & 255) + (255 - ((value >> shift) & 255)) * amount);

    return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
}

function configKey(key: string, index: number, used: Set<string>): string {
    const base = key.replace(/[^a-zA-Z0-9_-]/g, '') || `item-${index}`;
    let next = base;
    let suffix = 2;

    while (used.has(next)) {
        next = `${base}-${suffix}`;
        suffix += 1;
    }

    used.add(next);

    return next;
}

function SliceTooltip(props: ComponentProps<typeof ChartTooltipContent>) {
    const payload = props.payload?.map((item) => {
        const row = item.payload as { display?: string; label?: string } | undefined;

        if (!row) {
            return item;
        }

        return {
            ...item,
            name: row.label ?? item.name,
            value: row.display ?? item.value,
        };
    });

    return <ChartTooltipContent {...props} hideLabel indicator="dot" payload={payload} />;
}

export function DashboardChart({
    items,
    style,
    palette = 'default',
    emptyLabel = 'Nothing to show yet.',
    hideZeros = true,
}: {
    items: Array<BarChartItem & { color?: string }>;
    style: ChartStyle;
    palette?: ChartPalette;
    emptyLabel?: string;
    hideZeros?: boolean;
}) {
    const gradientPrefix = useId().replace(/:/g, '');
    const [frame, setFrame] = useState<HTMLDivElement | null>(null);
    const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
    const colors = palettes[palette];
    const usedKeys = new Set<string>();
    const series = items
        .filter((item) => !hideZeros || item.value > 0)
        .map((item, index) => ({
            ...item,
            configKey: configKey(item.key, index, usedKeys),
            color: item.color ?? colors[index % colors.length],
            amount: item.display ?? item.value.toLocaleString('en-US'),
        }));

    useEffect(() => {
        if (!frame) {
            return;
        }

        const update = () => setCompact(frame.clientWidth < 520);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(frame);

        return () => observer.disconnect();
    }, [frame]);

    if (series.length === 0 || series.every((item) => item.value <= 0)) {
        return (
            <p className="py-8 text-center text-xs text-muted-foreground">
                {emptyLabel}
            </p>
        );
    }

    const plotted = series.filter((item) => item.value > 0);
    const chartConfig: ChartConfig = {};

    for (const item of series) {
        chartConfig[item.configKey] = {
            label: item.label,
            color: item.color,
        };
    }

    const legend = (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {series.map((item) => (
                <li key={item.configKey} className="flex items-center gap-2 text-xs">
                    <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                    />
                    <span className="min-w-0 truncate text-muted-foreground" title={item.label}>
                        {item.label}
                    </span>
                    <span className="font-medium tabular-nums text-foreground">{item.amount}</span>
                </li>
            ))}
        </ul>
    );

    const axisTick = (value: unknown) => {
        const text = String(value ?? '');

        if (!compact || text.length <= 12) {
            return text;
        }

        return `${text.slice(0, 11)}…`;
    };

    if (style === 'bars') {
        return (
            <div ref={setFrame} className="min-w-0">
                <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full min-w-0 max-w-full text-xs sm:h-44">
                    <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: compact ? 8 : 0 }}>
                        {palette === 'colorful' ? (
                            <defs>
                                {series.map((item) => (
                                    <linearGradient key={item.configKey} id={`${gradientPrefix}-${item.configKey}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={mixWithWhite(item.color, 0.35)} />
                                        <stop offset="100%" stopColor={item.color} />
                                    </linearGradient>
                                ))}
                            </defs>
                        ) : null}
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={compact ? -40 : -24} textAnchor="end" height={compact ? 72 : 52} tick={{ fontSize: compact ? 9 : 10 }} tickFormatter={axisTick} />
                        <YAxis width={compact ? 32 : 40} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                        <ChartTooltip content={<SliceTooltip />} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={42}>
                            {series.map((item) => (
                                <Cell key={item.configKey} fill={palette === 'colorful' ? `url(#${gradientPrefix}-${item.configKey})` : item.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ChartContainer>
                {legend}
            </div>
        );
    }

    if (style === 'lines') {
        return (
            <div ref={setFrame} className="min-w-0">
                <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full min-w-0 max-w-full text-xs sm:h-44">
                    <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: compact ? 8 : 0 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={compact ? -40 : -24} textAnchor="end" height={compact ? 72 : 52} tick={{ fontSize: compact ? 9 : 10 }} tickFormatter={axisTick} />
                        <YAxis width={compact ? 32 : 40} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                        <ChartTooltip content={<SliceTooltip />} />
                        <Line type="monotone" dataKey="value" stroke={palette === 'colorful' ? '#6366f1' : '#2563eb'} strokeWidth={3} dot={{ r: 5, fill: palette === 'colorful' ? '#d946ef' : '#0f766e', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    </LineChart>
                </ChartContainer>
                {legend}
            </div>
        );
    }

    const slices = plotted.map((item) => ({
        ...item,
        color: pieColor(item.color),
        fill: `var(--color-${item.configKey})`,
    }));
    const pieConfig: ChartConfig = {};

    for (const item of slices) {
        pieConfig[item.configKey] = {
            label: item.label,
            color: item.color,
        };
    }

    const showPieLabels = !compact && slices.every((item) => item.amount.length <= 8);

    return (
        <div ref={setFrame} className="flex min-w-0 flex-col items-center gap-3">
            <ChartContainer
                config={pieConfig}
                className="mx-auto aspect-square w-full max-w-[16.5rem] overflow-hidden pb-0 [&_.recharts-pie-label-text]:fill-foreground [&_.recharts-pie-label-text]:text-[11px]"
            >
                <PieChart margin={showPieLabels ? { top: 16, right: 28, bottom: 16, left: 28 } : { top: 8, right: 8, bottom: 8, left: 8 }}>
                    <ChartTooltip content={<SliceTooltip />} />
                    <Pie
                        data={slices}
                        dataKey="value"
                        nameKey="configKey"
                        outerRadius={showPieLabels ? '62%' : '78%'}
                        label={showPieLabels ? (entry) => {
                            const row = entry as { amount?: string; value?: number };

                            return row.amount ?? String(row.value ?? '');
                        } : false}
                    />
                </PieChart>
            </ChartContainer>
            <ul className="flex w-full flex-wrap justify-center gap-x-3 gap-y-1">
                {slices.map((item) => (
                    <li key={item.configKey} className="flex min-w-0 max-w-full items-center gap-2 text-xs">
                        <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="max-w-[9rem] truncate text-muted-foreground" title={item.label}>
                            {item.label}
                        </span>
                        <span className="font-medium tabular-nums text-foreground">{item.amount}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
