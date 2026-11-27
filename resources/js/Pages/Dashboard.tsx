import { type BarChartItem } from '@/Components/AnimatedBarChart';
import { DashboardChart, type ChartPalette, type ChartStyle } from '@/Components/DashboardPieChart';
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
    BarChart3Icon,
    BriefcaseIcon,
    LineChartIcon,
    MailIcon,
    PieChartIcon,
    ShieldCheckIcon,
    type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

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

function SectionTitle({
    icon: Icon,
    children,
}: {
    icon: LucideIcon;
    children: string;
}) {
    return (
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="grid size-6 place-items-center rounded-md border border-border bg-card text-muted-foreground">
                <Icon className="size-3.5" />
            </span>
            {children}
        </h2>
    );
}

const chartPalettes: Array<{ id: ChartPalette; label: string }> = [
    { id: 'default', label: 'Default' },
    { id: 'colorful', label: 'Colorful' },
];

const chartStyles: Array<{ id: ChartStyle; label: string; icon: LucideIcon }> = [
    { id: 'pie', label: 'Pie', icon: PieChartIcon },
    { id: 'bars', label: 'Bars', icon: BarChart3Icon },
    { id: 'lines', label: 'Lines', icon: LineChartIcon },
];

function ChartStyleTabs({
    style,
    onChange,
}: {
    style: ChartStyle;
    onChange: (style: ChartStyle) => void;
}) {
    return (
        <div role="tablist" aria-label="Chart style" className="flex rounded-lg border border-border bg-card p-0.5">
            {chartStyles.map((option) => {
                const Icon = option.icon;
                const selected = style === option.id;

                return (
                    <button
                        key={option.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(option.id)}
                        className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
                            selected && 'bg-foreground text-background hover:text-background',
                        )}
                    >
                        <Icon className="size-3.5" />
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

function ChartPaletteTabs({
    palette,
    onChange,
}: {
    palette: ChartPalette;
    onChange: (palette: ChartPalette) => void;
}) {
    return (
        <div role="tablist" aria-label="Chart theme" className="flex rounded-lg border border-border bg-card p-0.5">
            {chartPalettes.map((option) => {
                const selected = palette === option.id;

                return (
                    <button
                        key={option.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(option.id)}
                        className={cn(
                            'inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
                            selected && 'bg-foreground text-background hover:text-background',
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

function ChartCard({
    title,
    description,
    items,
    chartKey,
    emptyLabel,
    style,
    palette,
    money = false,
    hideZeros = true,
}: {
    title: string;
    description: string;
    items: BarChartItem[];
    chartKey: string;
    emptyLabel: string;
    style: ChartStyle;
    palette: ChartPalette;
    money?: boolean;
    hideZeros?: boolean;
}) {
    return (
        <Card size="sm" className="h-full border-border/70 bg-card shadow-sm">
            <CardHeader className="gap-1 pb-0">
                <CardDescription className="text-[11px] font-medium uppercase tracking-wide">
                    {title}
                </CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
                    {formatChartTotal(items, money)}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent>
                <DashboardChart
                    key={`${chartKey}-${style}-${palette}`}
                    items={items}
                    style={style}
                    palette={palette}
                    emptyLabel={emptyLabel}
                    hideZeros={hideZeros}
                />
            </CardContent>
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
    const [chartStyle, setChartStyle] = useState<ChartStyle>(() => {
        try {
            const saved = localStorage.getItem('gateway.dashboard-chart-style');

            if (saved === 'pie' || saved === 'bars' || saved === 'lines') {
                return saved;
            }
        } catch {
            // The pie view is used for this visit.
        }

        return 'pie';
    });
    const chooseChartStyle = (style: ChartStyle) => {
        setChartStyle(style);

        try {
            localStorage.setItem('gateway.dashboard-chart-style', style);
        } catch {
            // The choice still applies until the page is closed.
        }
    };
    const [chartPalette, setChartPalette] = useState<ChartPalette>(() => {
        try {
            const saved = localStorage.getItem('gateway.dashboard-chart-palette');

            if (saved === 'default' || saved === 'colorful') {
                return saved;
            }
        } catch {
            // Regular colors are used for this visit.
        }

        return 'default';
    });
    const chooseChartPalette = (palette: ChartPalette) => {
        setChartPalette(palette);

        try {
            localStorage.setItem('gateway.dashboard-chart-palette', palette);
        } catch {
            // The choice still applies until the page is closed.
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="flex min-w-0 flex-1 flex-col gap-5 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-lg font-semibold tracking-tight text-foreground">
                            Dashboard
                        </h1>
                        {canViewProjects && stats && (
                            <Badge
                                variant="secondary"
                                className="dash-soft dash-text dash-border gap-1.5 border text-xs font-medium"
                            >
                                <BriefcaseIcon className="dash-icon size-3" />
                                <span>
                                    <strong className="font-semibold tabular-nums">
                                        {stats.activeProjects}
                                    </strong>{' '}
                                    active / {stats.totalProjects} total projects
                                </span>
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <ChartPaletteTabs palette={chartPalette} onChange={chooseChartPalette} />
                        <ChartStyleTabs style={chartStyle} onChange={chooseChartStyle} />
                    </div>
                </div>

                {showGraphics && charts && (
                    <div className="flex flex-col gap-5">
                        {canViewProjects && (
                            <section className="flex flex-col gap-2">
                                <SectionTitle icon={PieChartIcon}>Projects</SectionTitle>
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                    <ChartCard
                                        title="Projects by status"
                                        description="Share of projects in each status."
                                        items={charts.byStatus}
                                        chartKey={listVersion ?? 'status'}
                                        emptyLabel="No projects yet."
                                        style={chartStyle}
                                        palette={chartPalette}
                                    />
                                    <ChartCard
                                        title="Projects by priority"
                                        description="Share of projects in each priority."
                                        items={charts.byPriority}
                                        chartKey={`${listVersion ?? 'priority'}-priority`}
                                        emptyLabel="No projects yet."
                                        style={chartStyle}
                                        palette={chartPalette}
                                    />
                                </div>
                            </section>
                        )}
                        {(charts.quotations || charts.bids || (canViewTakeoffs && charts.takeoffs) || charts.projectControl) && (
                            <section className="flex flex-col gap-2">
                                <SectionTitle icon={BriefcaseIcon}>Pipeline</SectionTitle>
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                    {charts.quotations && (
                                        <ChartCard
                                            title="Quotations by status"
                                            description="Dollar share of each quotation status."
                                            items={charts.quotations}
                                            chartKey={`${quotationListVersion ?? 'quotations'}-quotations`}
                                            emptyLabel="No quotations yet."
                                            style={chartStyle}
                                            palette={chartPalette}
                                            money
                                            hideZeros={false}
                                        />
                                    )}
                                    {charts.bids && (
                                        <ChartCard
                                            title="Bids by stage"
                                            description="Dollar share of each bid stage."
                                            items={charts.bids}
                                            chartKey={`${bidListVersion ?? 'bids'}-bids`}
                                            emptyLabel="No bids yet."
                                            style={chartStyle}
                                            palette={chartPalette}
                                            money
                                            hideZeros={false}
                                        />
                                    )}
                                    {canViewTakeoffs && charts.takeoffs && (
                                        <ChartCard
                                            title="Takeoffs by status"
                                            description="Share of takeoffs in each status."
                                            items={charts.takeoffs}
                                            chartKey="takeoffs"
                                            emptyLabel="No takeoffs yet."
                                            style={chartStyle}
                                            palette={chartPalette}
                                        />
                                    )}
                                    {charts.projectControl && (
                                        <ChartCard
                                            title="Project control"
                                            description="Dollar share of jobs by pipeline status."
                                            items={charts.projectControl}
                                            chartKey="project-control"
                                            emptyLabel="No project control jobs yet."
                                            style={chartStyle}
                                            palette={chartPalette}
                                            money
                                            hideZeros={false}
                                        />
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                )}

                <section className="flex flex-col gap-2">
                    <SectionTitle icon={MailIcon}>Mail</SectionTitle>
                    <Deferred data="emailActivity" fallback={<EmailActivitySkeleton />}>
                        <>
                            {emailActivity && (
                                <EmailActivityChart activity={emailActivity} style={chartStyle} palette={chartPalette} />
                            )}
                        </>
                    </Deferred>
                </section>

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

                {canWatchPresence && <PresenceWatcher />}
            </div>
        </AuthenticatedLayout>
    );
}
