import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/Components/ui/chart';
import { type ComponentProps, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from 'recharts';

export type BarChartItem = {
    key: string;
    label: string;
    value: number;
    display?: string;
};

const chartColors = [
    '#0f766e',
    '#dc2626',
    '#2563eb',
    '#d97706',
    '#7c3aed',
    '#db2777',
    '#0891b2',
    '#65a30d',
] as const;

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

function CategoryTooltip(props: ComponentProps<typeof ChartTooltipContent>) {
    const payload = props.payload
        ?.filter((item) => {
            if (
                item.dataKey == null ||
                typeof item.payload !== 'object' ||
                item.payload === null
            ) {
                return item.value != null;
            }

            const row = item.payload as Record<string, unknown>;

            return row[String(item.dataKey)] != null;
        })
        .map((item) => {
            const row = item.payload as { display?: string };

            if (!row?.display || item.value == null) {
                return item;
            }

            return { ...item, value: row.display };
        });

    return <ChartTooltipContent {...props} hideLabel payload={payload} />;
}

function RowBars({
    series,
}: {
    series: Array<BarChartItem & { configKey: string; color: string }>;
}) {
    const max = Math.max(...series.map((item) => item.value), 1);
    const [grown, setGrown] = useState(false);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setGrown(true));

        return () => cancelAnimationFrame(frame);
    }, []);

    return (
        <ul className="flex flex-col gap-2">
            {series.map((item) => {
                const amount = item.display ?? item.value.toLocaleString();
                const percent = item.value <= 0 ? 0 : Math.max(8, (item.value / max) * 100);

                return (
                    <li
                        key={item.configKey}
                        className="grid grid-cols-[minmax(0,11rem)_minmax(2.5rem,1fr)_auto] items-center gap-2"
                    >
                        <span className="flex min-w-0 items-start gap-1.5">
                            <span
                                aria-hidden
                                className="mt-1 size-2 shrink-0 rounded-sm"
                                style={{ backgroundColor: item.color }}
                            />
                            <span
                                className="line-clamp-2 min-w-0 text-xs font-medium leading-4 text-foreground"
                                title={item.label}
                            >
                                {item.label}
                            </span>
                        </span>
                        <span className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                            <span
                                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                                style={{
                                    width: grown ? `${percent}%` : '0%',
                                    backgroundColor: item.color,
                                }}
                            />
                        </span>
                        <span className="min-w-4 text-right text-xs font-semibold tabular-nums text-foreground">
                            {amount}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export function AnimatedBarChart({
    items,
    emptyLabel = 'Nothing to show yet.',
    hideZeros = true,
    layout = 'columns',
}: {
    items: BarChartItem[];
    emptyLabel?: string;
    hideZeros?: boolean;
    layout?: 'columns' | 'rows';
}) {
    if (
        items.length === 0 ||
        (hideZeros && items.every((item) => item.value === 0))
    ) {
        return (
            <p className="py-4 text-center text-xs text-muted-foreground">
                {emptyLabel}
            </p>
        );
    }

    const usedKeys = new Set<string>();
    const series = items.map((item, index) => ({
        ...item,
        configKey: configKey(item.key, index, usedKeys),
        color: chartColors[index % chartColors.length],
    }));

    const chartConfig: ChartConfig = {};

    for (const item of series) {
        chartConfig[item.configKey] = {
            label: item.label,
            color: item.color,
        };
    }

    if (layout === 'rows') {
        return <RowBars series={series} />;
    }

    const chartData = series.map((item) => ({
        label: item.label,
        display: item.display,
        [item.configKey]: item.value,
    }));

    return (
        <ChartContainer
            config={chartConfig}
            className="aspect-auto h-36 w-full text-xs"
        >
            <BarChart
                accessibilityLayer
                data={chartData}
                margin={{ top: 16, right: 4, left: 4, bottom: 0 }}
            >
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey="label"
                    tickLine={false}
                    tickMargin={4}
                    axisLine={false}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={36}
                    tick={{ fontSize: 10 }}
                />
                <ChartTooltip content={<CategoryTooltip />} />
                <ChartLegend
                    content={<ChartLegendContent className="gap-x-2 gap-y-0.5 pt-1 text-[10px]" />}
                    className="flex-wrap"
                    itemSorter={null}
                />
                {series.map((item) => (
                    <Bar
                        key={item.configKey}
                        dataKey={item.configKey}
                        stackId="value"
                        fill={`var(--color-${item.configKey})`}
                        radius={4}
                    >
                        <LabelList
                            position="top"
                            offset={8}
                            className="fill-foreground"
                            fontSize={10}
                            valueAccessor={(entry) => {
                                const raw = Array.isArray(entry.value)
                                    ? entry.value[entry.value.length - 1]
                                    : entry.value;

                                if (typeof raw !== 'number' || raw === 0) {
                                    return '';
                                }

                                const point = entry.payload as {
                                    display?: string;
                                };

                                return point.display ?? raw.toLocaleString();
                            }}
                        />
                    </Bar>
                ))}
            </BarChart>
        </ChartContainer>
    );
}
