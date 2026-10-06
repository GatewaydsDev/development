import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/Components/ui/chart';
import { type ComponentProps } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from 'recharts';

export type BarChartItem = {
    key: string;
    label: string;
    value: number;
    display?: string;
};

const chartColors = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
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

export function AnimatedBarChart({
    items,
    emptyLabel = 'Nothing to show yet.',
    hideZeros = true,
}: {
    items: BarChartItem[];
    emptyLabel?: string;
    hideZeros?: boolean;
}) {
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

    const chartData = series.map((item) => ({
        label: item.label,
        display: item.display,
        [item.configKey]: item.value,
    }));

    return (
        <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[320px] w-full"
        >
            <BarChart
                accessibilityLayer
                data={chartData}
                margin={{ top: 28, right: 8, left: 8 }}
            >
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey="label"
                    tickLine={false}
                    tickMargin={8}
                    axisLine={false}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={64}
                />
                <ChartTooltip content={<CategoryTooltip />} />
                <ChartLegend
                    content={<ChartLegendContent />}
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
                            fontSize={12}
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
