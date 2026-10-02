import { AnimatedBarChart, type BarChartItem } from '@/Components/AnimatedBarChart';
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
import { useProjectListRefresh } from '@/hooks/useProjectListRefresh';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
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
    } | null;
    listVersion?: string | null;
    bidListVersion?: string | null;
    quotationListVersion?: string | null;
    stats?: {
        totalProjects: number;
        activeProjects: number;
    } | null;
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
        <CardFooter className="mt-auto justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums text-foreground">
                {formatChartTotal(items, money)}
            </span>
        </CardFooter>
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
}: DashboardProps) {
    const { auth } = usePage<PageProps>().props;
    const can = auth.can ?? {};
    const canViewProjects = Boolean(can.viewProjects);
    const canViewBids = Boolean(can.viewBids);
    const canViewQuotations = Boolean(can.viewQuotations);
    const showGraphics = Boolean(
        canViewProjects || charts?.quotations || charts?.bids,
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

            <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-4 shadow-sm">
                    <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                        Dashboard
                    </h1>
                    {stats && (
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

                {showGraphics && charts ? (
                    <div className="flex flex-col gap-6">
                        <div className="grid gap-6 xl:grid-cols-2">
                            {canViewProjects && (
                                <>
                                    <Card className="h-full pb-0 shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="text-lg font-bold sm:text-xl">
                                                Projects by status
                                            </CardTitle>
                                            <CardDescription>
                                                How the current projects are
                                                spread across each status.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <AnimatedBarChart
                                                key={listVersion ?? 'status'}
                                                items={charts.byStatus}
                                                emptyLabel="No projects yet."
                                            />
                                        </CardContent>
                                        <ChartTotal items={charts.byStatus} />
                                    </Card>
                                    <Card className="h-full pb-0 shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="text-lg font-bold sm:text-xl">
                                                Projects by priority
                                            </CardTitle>
                                            <CardDescription>
                                                Priority mix across every
                                                project.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <AnimatedBarChart
                                                key={`${listVersion ?? 'priority'}-priority`}
                                                items={charts.byPriority}
                                                emptyLabel="No projects yet."
                                            />
                                        </CardContent>
                                        <ChartTotal items={charts.byPriority} />
                                    </Card>
                                </>
                            )}
                            {charts.quotations && (
                                <Card className="h-full pb-0 shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-lg font-bold sm:text-xl">
                                            Quotations by status
                                        </CardTitle>
                                        <CardDescription>
                                            Dollar totals for each quotation
                                            status.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <AnimatedBarChart
                                            key={`${quotationListVersion ?? 'quotations'}-quotations`}
                                            items={charts.quotations}
                                            emptyLabel="No quotations yet."
                                            hideZeros={false}
                                        />
                                    </CardContent>
                                    <ChartTotal
                                        items={charts.quotations}
                                        money
                                    />
                                </Card>
                            )}
                            {charts.bids && (
                                <Card className="h-full pb-0 shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-lg font-bold sm:text-xl">
                                            Bids by stage
                                        </CardTitle>
                                        <CardDescription>
                                            Dollar totals for each bid stage.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <AnimatedBarChart
                                            key={`${bidListVersion ?? 'bids'}-bids`}
                                            items={charts.bids}
                                            emptyLabel="No bids yet."
                                            hideZeros={false}
                                        />
                                    </CardContent>
                                    <ChartTotal items={charts.bids} money />
                                </Card>
                            )}
                        </div>
                    </div>
                ) : (
                    <Card className="h-full shadow-sm">
                        <CardHeader>
                            <CardTitle>Personal Workspace</CardTitle>
                            <CardDescription>
                                You are signed in to Gateway. You can manage
                                your profile or review account settings below.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-xl border border-dashed border-border p-6 text-center">
                                <ShieldCheckIcon className="mx-auto size-10 text-muted-foreground" />
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
