import { AnimatedBarChart, type BarChartItem } from '@/Components/AnimatedBarChart';
import {
    EmailActivityChart,
    EmailActivitySkeleton,
    type EmailActivity,
} from '@/Components/EmailActivityChart';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { PresenceWatcher } from '@/Components/PresenceWatcher';
import { useProjectListRefresh } from '@/hooks/useProjectListRefresh';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Deferred, Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRightIcon,
    BriefcaseIcon,
    ShieldCheckIcon,
} from 'lucide-react';

type DashboardProps = {
    charts?: {
        byStatus: BarChartItem[];
        byPriority: BarChartItem[];
        quotations: BarChartItem[] | null;
        bids: BarChartItem[] | null;
        takeoffs: BarChartItem[] | null;
        projectControl?: BarChartItem[] | null;
    } | null;
    listVersion?: string | null;
    bidListVersion?: string | null;
    quotationListVersion?: string | null;
    stats?: {
        totalProjects: number;
        activeProjects: number;
    } | null;
    emailActivity?: EmailActivity;
    canWatchPresence?: boolean;
};

function formatChartTotal(items: BarChartItem[], money: boolean): string {
    const total = items.reduce((sum, item) => sum + item.value, 0);

    if (money) {
        return `$${total.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    return total.toLocaleString('en-US');
}

function ChartTotal({
    items,
    money = false,
}: {
    items: BarChartItem[];
    money?: boolean;
}) {
    return (
        <CardFooter className="mt-auto justify-between px-3 py-2 text-xs">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums text-foreground">
                {formatChartTotal(items, money)}
            </span>
        </CardFooter>
    );
}

function ChartCard({
    title,
    description,
    items,
    chartKey,
    emptyLabel,
    money = false,
    hideZeros = true,
    accent,
    layout = 'columns',
}: {
    title: string;
    description: string;
    items: BarChartItem[];
    chartKey: string;
    emptyLabel: string;
    money?: boolean;
    hideZeros?: boolean;
    accent: string;
    layout?: 'columns' | 'rows';
}) {
    return (
        <Card size="sm" className={cn('h-full border-t-2 pb-0 shadow-sm', accent)}>
            <CardHeader className="gap-0.5 pb-0">
                <CardTitle>{title}</CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <AnimatedBarChart
                    key={chartKey}
                    items={items}
                    emptyLabel={emptyLabel}
                    hideZeros={hideZeros}
                    layout={layout}
                />
            </CardContent>
            <ChartTotal items={items} money={money} />
        </Card>
    );
}

const dashboardRefreshProps = [
    'charts',
    'stats',
    'listVersion',
    'bidListVersion',
    'quotationListVersion',
];

export default function Dashboard({
    charts = null,
    listVersion = null,
    bidListVersion = null,
    quotationListVersion = null,
    stats,
    emailActivity,
    canWatchPresence = false,
}: DashboardProps) {
    const { auth } = usePage<PageProps>().props;
    const can = auth.can ?? {};
    const canViewProjects = Boolean(can.viewProjects);
    const canViewBids = Boolean(can.viewBids);
    const canViewQuotations = Boolean(can.viewQuotations);
    const canViewTakeoffs = Boolean(can.viewTakeoffs);
    const showGraphics = Boolean(
        canViewProjects ||
            charts?.quotations ||
            charts?.bids ||
            charts?.takeoffs ||
            charts?.projectControl,
    );

    useProjectListRefresh(
        canViewProjects ? listVersion : null,
        dashboardRefreshProps,
    );
    useProjectListRefresh(
        canViewBids ? bidListVersion : null,
        dashboardRefreshProps,
        'admin.bids.version',
    );
    useProjectListRefresh(
        canViewQuotations ? quotationListVersion : null,
        dashboardRefreshProps,
        'admin.quotations.version',
    );

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                    <h1 className="text-base font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
                        Dashboard
                    </h1>
                    {canViewProjects && stats && (
                        <Badge
                            variant="secondary"
                            className="dash-soft dash-text dash-border gap-1.5 border text-xs font-medium"
                        >
                            <BriefcaseIcon className="dash-icon size-3" />
                            <span>
                                <strong className="font-semibold">
                                    {stats.activeProjects}
                                </strong>{' '}
                                active / {stats.totalProjects} total projects
                            </span>
                        </Badge>
                    )}
                </div>

                {canWatchPresence && <PresenceWatcher />}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {showGraphics && charts && (
                        <>
                            {canViewProjects && (
                                <>
                                    <ChartCard
                                        title="Projects by status"
                                        description="How many projects are in each status."
                                        items={charts.byStatus}
                                        chartKey={listVersion ?? 'status'}
                                        emptyLabel="No projects yet."
                                        accent="border-t-teal-600 border-teal-200 bg-teal-50/60 dark:border-teal-900 dark:bg-teal-950/20"
                                        layout="rows"
                                    />
                                    <ChartCard
                                        title="Projects by priority"
                                        description="How many projects are in each priority."
                                        items={charts.byPriority}
                                        chartKey={`${listVersion ?? 'priority'}-priority`}
                                        emptyLabel="No projects yet."
                                        accent="border-t-amber-500 border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
                                    />
                                </>
                            )}
                            {charts.quotations && (
                                <ChartCard
                                    title="Quotations by status"
                                    description="Dollar total for each quotation status."
                                    items={charts.quotations}
                                    chartKey={`${quotationListVersion ?? 'quotations'}-quotations`}
                                    emptyLabel="No quotations yet."
                                    money
                                    hideZeros={false}
                                    accent="border-t-blue-600 border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20"
                                />
                            )}
                            {charts.bids && (
                                <ChartCard
                                    title="Bids by stage"
                                    description="Dollar total for each bid stage."
                                    items={charts.bids}
                                    chartKey={`${bidListVersion ?? 'bids'}-bids`}
                                    emptyLabel="No bids yet."
                                    money
                                    hideZeros={false}
                                    accent="border-t-violet-600 border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20"
                                />
                            )}
                            {canViewTakeoffs && charts.takeoffs && (
                                <ChartCard
                                    title="Takeoffs by status"
                                    description="How many takeoffs are in each status."
                                    items={charts.takeoffs}
                                    chartKey="takeoffs"
                                    emptyLabel="No takeoffs yet."
                                    accent="border-t-rose-600 border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20"
                                />
                            )}
                            {charts.projectControl && (
                                <ChartCard
                                    title="Project control pipeline"
                                    description="Dollar value of jobs by pipeline status."
                                    items={charts.projectControl}
                                    chartKey="project-control"
                                    emptyLabel="No project control jobs yet."
                                    money
                                    hideZeros={false}
                                    accent="border-t-emerald-600 border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
                                />
                            )}
                        </>
                    )}
                    <Deferred data="emailActivity" fallback={<EmailActivitySkeleton />}>
                        <>
                            {emailActivity && (
                                <EmailActivityChart activity={emailActivity} />
                            )}
                        </>
                    </Deferred>
                </div>

                {!showGraphics && (
                    <Card className="h-full border-sky-200 bg-sky-50/70 shadow-sm dark:border-sky-900 dark:bg-sky-950/30">
                        <CardHeader>
                            <CardTitle>Personal Workspace</CardTitle>
                            <CardDescription>
                                You are signed in to Gateway. You can manage
                                your profile or review account settings below.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-xl border border-dashed border-border p-6 text-center">
                                <ShieldCheckIcon className="mx-auto size-10 text-sky-600 dark:text-sky-300" />
                                <h3 className="mt-3 font-semibold text-foreground">
                                    Workspace Ready
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Contact your administrator if you need
                                    access to projects, bids, or directory
                                    tools.
                                </p>
                                <Button asChild className="mt-4" variant="outline">
                                    <Link href={route('profile.edit')}>
                                        Open profile settings
                                        <ArrowRightIcon data-icon="inline-end" />
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
