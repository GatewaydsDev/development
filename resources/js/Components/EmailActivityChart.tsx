import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/Components/ui/chart';
import { DashboardChart, type ChartPalette, type ChartStyle } from '@/Components/DashboardPieChart';
import { Skeleton } from '@/Components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { InboxIcon, MailWarningIcon, SendIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

export type EmailActivity = {
    status: 'ok' | 'no_mailbox' | 'loading' | 'error';
    mailbox: string | null;
    range: number;
    days: Array<{
        date: string;
        label: string;
        received: number;
        sent: number;
    }>;
    totals: { received: number; sent: number };
    truncated: boolean;
    error: string | null;
    refreshedAt: string | null;
};

const RANGES = [7, 14, 30] as const;

const emailColors: Record<ChartPalette, { received: string; sent: string }> = {
    default: { received: '#2563eb', sent: '#0f766e' },
    colorful: { received: '#00c2ff', sent: '#ff2bd6' },
};

function emailChartConfig(palette: ChartPalette): ChartConfig {
    return {
        received: { label: 'Received', color: emailColors[palette].received },
        sent: { label: 'Sent', color: emailColors[palette].sent },
    };
}

function SeriesLegend({ palette }: { palette: ChartPalette }) {
    const colors = emailColors[palette];

    return (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: colors.received }} />
                Received
            </span>
            <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: colors.sent }} />
                Sent
            </span>
        </div>
    );
}

function Shell({
    children,
    footer,
    range,
    loading,
    onRange,
    description,
    headline = '—',
    legend = false,
    palette = 'default',
}: {
    children: ReactNode;
    footer?: ReactNode;
    range: number;
    loading: boolean;
    onRange?: (range: number) => void;
    description: string;
    headline?: string;
    legend?: boolean;
    palette?: ChartPalette;
}) {
    return (
        <Card size="sm" className="h-full border-border/70 bg-card pb-0 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
                <div className="flex min-w-0 flex-col gap-1">
                    <CardDescription className="text-[11px] font-medium uppercase tracking-wide">
                        Email activity
                    </CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
                        {headline}
                    </CardTitle>
                    <p className="truncate text-xs text-muted-foreground" title={description}>
                        {description}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {legend ? <SeriesLegend palette={palette} /> : null}
                    {onRange && (
                        <div
                            role="group"
                            aria-label="Date range"
                            className="flex shrink-0 rounded-md border border-border p-0.5"
                        >
                            {RANGES.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    disabled={loading}
                                    aria-pressed={range === value}
                                    onClick={() => onRange(value)}
                                    className={cn(
                                        'rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60',
                                        range === value && 'bg-muted text-foreground',
                                    )}
                                >
                                    {value}d
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className={cn(loading && 'opacity-60 transition-opacity')}>
                {children}
            </CardContent>
            {footer}
        </Card>
    );
}

export function EmailActivitySkeleton() {
    return (
        <Shell range={14} loading description="Loading your mailbox...">
            <Skeleton className="h-44 w-full" />
        </Shell>
    );
}

export function EmailActivityChart({
    activity,
    style = 'lines',
    palette = 'default',
}: {
    activity: EmailActivity;
    style?: ChartStyle;
    palette?: ChartPalette;
}) {
    const chartConfig = emailChartConfig(palette);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activity.status !== 'loading') {
            return;
        }

        const timer = window.setInterval(() => {
            router.reload({
                only: ['emailActivity'],
                async: true,
                showProgress: false,
            });
        }, 4_000);

        return () => window.clearInterval(timer);
    }, [activity.status]);

    const changeRange = (next: number) => {
        if (next === activity.range) {
            return;
        }

        router.reload({
            only: ['emailActivity'],
            data: { emailRange: next },
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });
    };

    if (activity.status === 'no_mailbox') {
        return (
            <Shell range={activity.range} loading={false} description="Received and sent by you.">
                <div className="flex flex-col items-center gap-1 py-6 text-center">
                    <InboxIcon className="size-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                        No Microsoft 365 mailbox is assigned to your account.
                    </p>
                </div>
            </Shell>
        );
    }

    if (activity.status === 'loading') {
        return <EmailActivitySkeleton />;
    }

    if (activity.status === 'error') {
        return (
            <Shell
                range={activity.range}
                loading={loading}
                onRange={changeRange}
                description={activity.mailbox ?? 'Received and sent by you.'}
            >
                <div className="flex flex-col items-center gap-1 py-6 text-center">
                    <MailWarningIcon className="size-6 text-amber-600" />
                    <p className="text-xs text-muted-foreground">
                        {activity.error ?? 'Email activity could not be loaded.'}
                    </p>
                </div>
            </Shell>
        );
    }

    const empty = activity.totals.received === 0 && activity.totals.sent === 0;
    const dense = activity.days.length > 7;

    return (
        <Shell
            range={activity.range}
            loading={loading}
            onRange={changeRange}
            headline={(activity.totals.received + activity.totals.sent).toLocaleString('en-US')}
            legend
            palette={palette}
            description={`${activity.mailbox} · last ${activity.range} days`}
            footer={
                <CardFooter className="mt-auto justify-between gap-3 px-3 py-2 text-xs">
                    <Link
                        href={route('mailbox.index')}
                        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <InboxIcon className="size-3" style={{ color: chartConfig.received.color }} />
                        Received
                        <span className="font-semibold tabular-nums text-foreground">
                            {activity.totals.received.toLocaleString('en-US')}
                        </span>
                    </Link>
                    <Link
                        href={route('mailbox.index', { folder: 'sent' })}
                        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <SendIcon className="size-3" style={{ color: chartConfig.sent.color }} />
                        Sent
                        <span className="font-semibold tabular-nums text-foreground">
                            {activity.totals.sent.toLocaleString('en-US')}
                        </span>
                    </Link>
                </CardFooter>
            }
        >
            {empty ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                    No email in the last {activity.range} days.
                </p>
            ) : style === 'pie' ? (
                <DashboardChart
                    style="pie"
                    palette={palette}
                    hideZeros={false}
                    items={[
                        { key: 'received', label: 'Received', value: activity.totals.received, color: emailColors[palette].received },
                        { key: 'sent', label: 'Sent', value: activity.totals.sent, color: emailColors[palette].sent },
                    ]}
                />
            ) : (
                <ChartContainer
                    key={`${style}-${activity.range}-${activity.refreshedAt}`}
                    config={chartConfig}
                    className="aspect-auto h-44 w-full text-xs"
                >
                    {style === 'bars' ? (
                        <BarChart
                            accessibilityLayer
                            data={activity.days}
                            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                            barGap={2}
                        >
                            {palette === 'colorful' ? (
                                <defs>
                                    <linearGradient id="email-received" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#7aebff" />
                                        <stop offset="100%" stopColor="#00c2ff" />
                                    </linearGradient>
                                    <linearGradient id="email-sent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ff8ae8" />
                                        <stop offset="100%" stopColor="#ff2bd6" />
                                    </linearGradient>
                                </defs>
                            ) : null}
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={dense ? 'preserveStartEnd' : 0} minTickGap={dense ? 24 : 8} tick={{ fontSize: 10 }} />
                            <YAxis width={28} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                            <Bar dataKey="received" fill={palette === 'colorful' ? 'url(#email-received)' : 'var(--color-received)'} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="sent" fill={palette === 'colorful' ? 'url(#email-sent)' : 'var(--color-sent)'} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    ) : (
                        <LineChart
                            accessibilityLayer
                            data={activity.days}
                            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={dense ? 'preserveStartEnd' : 0} minTickGap={dense ? 24 : 8} tick={{ fontSize: 10 }} />
                            <YAxis width={28} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                            <Line type="monotone" dataKey="received" stroke="var(--color-received)" strokeWidth={3} dot={{ r: 3, fill: emailColors[palette].received, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="sent" stroke="var(--color-sent)" strokeWidth={3} dot={{ r: 3, fill: emailColors[palette].sent, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                        </LineChart>
                    )}
                </ChartContainer>
            )}
            {activity.truncated && (
                <p className="pt-1 text-[10px] text-muted-foreground">
                    Showing the most recent 2,000 messages per folder.
                </p>
            )}
        </Shell>
    );
}
