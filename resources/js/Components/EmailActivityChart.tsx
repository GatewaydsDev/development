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
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/Components/ui/chart';
import { Skeleton } from '@/Components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { InboxIcon, MailWarningIcon, SendIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

export type EmailActivity = {
    status: 'ok' | 'no_mailbox' | 'error';
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

const chartConfig = {
    received: { label: 'Received', color: '#2563eb' },
    sent: { label: 'Sent', color: '#0f766e' },
} satisfies ChartConfig;

function Shell({
    children,
    footer,
    range,
    loading,
    onRange,
    description,
}: {
    children: ReactNode;
    footer?: ReactNode;
    range: number;
    loading: boolean;
    onRange?: (range: number) => void;
    description: string;
}) {
    return (
        <Card size="sm" className="h-full border-t-2 border-t-sky-600 pb-0 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <CardTitle>Email activity</CardTitle>
                    <CardDescription className="truncate text-xs" title={description}>
                        {description}
                    </CardDescription>
                </div>
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
            <Skeleton className="h-36 w-full" />
        </Shell>
    );
}

export function EmailActivityChart({ activity }: { activity: EmailActivity }) {
    const [loading, setLoading] = useState(false);

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
            ) : (
                <ChartContainer
                    key={`${activity.range}-${activity.refreshedAt}`}
                    config={chartConfig}
                    className="aspect-auto h-36 w-full text-xs"
                >
                    <BarChart
                        accessibilityLayer
                        data={activity.days}
                        margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
                        barGap={1}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={4}
                            interval={dense ? 'preserveStartEnd' : 0}
                            minTickGap={dense ? 16 : 0}
                            tick={{ fontSize: 10 }}
                        />
                        <YAxis
                            width={24}
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10 }}
                        />
                        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                        <ChartLegend
                            content={<ChartLegendContent className="gap-x-2 pt-1 text-[10px]" />}
                        />
                        <Bar dataKey="received" fill="var(--color-received)" radius={3} />
                        <Bar dataKey="sent" fill="var(--color-sent)" radius={3} />
                    </BarChart>
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
