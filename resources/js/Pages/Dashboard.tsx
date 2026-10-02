import { AnimatedBarChart, type BarChartItem } from '@/Components/AnimatedBarChart';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/Components/ui/table';
import { useProjectListRefresh } from '@/hooks/useProjectListRefresh';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { cn } from '@/lib/utils';
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
    summary?: WorkspaceSummary | null;
};

type QuotationStatusTotal = {
    status: string;
    label: string;
    total: string;
};

type WorkspaceSummary = {
    projects: string | null;
    activeProjects: string | null;
    bids: string | null;
    quotations: string | null;
    quotationStatuses: QuotationStatusTotal[];
};

const summaryRowTones = {
    emerald: {
        row: 'bg-emerald-50 text-emerald-950 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/60',
        accent: 'border-l-4 border-l-emerald-500',
    },
    teal: {
        row: 'bg-teal-50 text-teal-950 hover:bg-teal-100/80 dark:bg-teal-950/40 dark:text-teal-100 dark:hover:bg-teal-950/60',
        accent: 'border-l-4 border-l-teal-500',
    },
    sky: {
        row: 'bg-sky-50 text-sky-950 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-950/60',
        accent: 'border-l-4 border-l-sky-500',
    },
    violet: {
        row: 'bg-violet-50 text-violet-950 hover:bg-violet-100/80 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/60',
        accent: 'border-l-4 border-l-violet-500',
    },
    slate: {
        row: 'bg-slate-50 text-slate-800 hover:bg-slate-100/80 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:bg-slate-900/70',
        accent: 'border-l-4 border-l-slate-400',
    },
    cyan: {
        row: 'bg-cyan-50 text-cyan-950 hover:bg-cyan-100/80 dark:bg-cyan-950/40 dark:text-cyan-100 dark:hover:bg-cyan-950/60',
        accent: 'border-l-4 border-l-cyan-500',
    },
    amber: {
        row: 'bg-amber-50 text-amber-950 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60',
        accent: 'border-l-4 border-l-amber-500',
    },
    rose: {
        row: 'bg-rose-50 text-rose-950 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/60',
        accent: 'border-l-4 border-l-rose-500',
    },
} as const;

type SummaryRowTone = keyof typeof summaryRowTones;

const quotationStatusTones: Record<string, SummaryRowTone> = {
    draft: 'slate',
    sent: 'cyan',
    accepted: 'teal',
    expired: 'amber',
    declined: 'rose',
};

function WorkspaceSummaryTable({ summary }: { summary: WorkspaceSummary }) {
    const rows: Array<{
        key: string;
        label: string;
        total: string;
        href?: string;
        nested?: boolean;
        tone: SummaryRowTone;
    }> = [];

    if (summary.projects !== null) {
        rows.push({
            key: 'projects',
            label: 'Projects',
            total: summary.projects,
            href: route('admin.projects.index'),
            tone: 'emerald',
        });
    }

    if (summary.activeProjects !== null) {
        rows.push({
            key: 'active-projects',
            label: 'Active projects',
            total: summary.activeProjects,
            tone: 'teal',
        });
    }

    if (summary.bids !== null) {
        rows.push({
            key: 'bids',
            label: 'Bids',
            total: summary.bids,
            href: route('admin.bids.index'),
            tone: 'sky',
        });
    }

    if (summary.quotations !== null) {
        rows.push({
            key: 'quotations',
            label: 'Quotations',
            total: summary.quotations,
            href: route('admin.quotations.index'),
            tone: 'violet',
        });

        summary.quotationStatuses.forEach((status) => {
            rows.push({
                key: `quotation-${status.status}`,
                label: status.label,
                total: status.total,
                nested: true,
                tone: quotationStatusTones[status.status] ?? 'violet',
            });
        });
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg font-bold sm:text-xl">
                    Summary
                </CardTitle>
                <CardDescription>
                    Dollar totals for projects, bids, and quotations.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-hidden rounded-xl border border-border">
                    <Table className="table-fixed">
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="w-[70%] px-4 text-xs font-semibold uppercase tracking-wider">
                                    Record
                                </TableHead>
                                <TableHead className="w-[30%] px-4 text-right text-xs font-semibold uppercase tracking-wider">
                                    Total
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow
                                    key={row.key}
                                    className={summaryRowTones[row.tone].row}
                                >
                                    <TableCell
                                        className={cn(
                                            'px-4 text-sm',
                                            summaryRowTones[row.tone].accent,
                                            row.nested && 'pl-8',
                                        )}
                                    >
                                        {row.href ? (
                                            <Link
                                                href={row.href}
                                                className="font-medium underline-offset-2 hover:underline"
                                            >
                                                {row.label}
                                            </Link>
                                        ) : (
                                            row.label
                                        )}
                                    </TableCell>
                                    <TableCell className="px-4 text-right text-sm font-semibold tabular-nums">
                                        {row.total}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

const dashboardRefreshProps = [
    'charts',
    'stats',
    'summary',
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
    summary,
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
                                    <Card className="shadow-sm">
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
                                    </Card>
                                    <Card className="shadow-sm">
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
                                    </Card>
                                </>
                            )}
                            {charts.quotations && (
                                <Card className="shadow-sm">
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
                                </Card>
                            )}
                            {charts.bids && (
                                <Card className="shadow-sm">
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
                                </Card>
                            )}
                        </div>
                        {summary && (
                            <WorkspaceSummaryTable summary={summary} />
                        )}
                    </div>
                ) : (
                    <Card className="shadow-sm">
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
