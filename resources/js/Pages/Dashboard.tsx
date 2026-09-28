import ActionHint from '@/Components/ActionHint';
import DirectoryFieldLabel from '@/Components/DirectoryFieldLabel';
import PaginationNav from '@/Components/PaginationNav';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowRightIcon,
    BriefcaseIcon,
    ClipboardListIcon,
    EditIcon,
    EyeIcon,
    FileSpreadsheetIcon,
    FileTextIcon,
    FileTypeIcon,
    FilterIcon,
    PlusIcon,
    PrinterIcon,
    SearchIcon,
    ShieldCheckIcon,
    XIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import {
    type ProjectOptions,
    type ProjectsPaginator,
} from './Admin/Projects/types';

type DashboardProps = {
    filters?: {
        search?: string;
        status?: string;
        highlight?: number | null;
    };
    options?: ProjectOptions | null;
    projects?: ProjectsPaginator | null;
    stats?: {
        totalProjects: number;
        activeProjects: number;
    } | null;
};

const statusBadgeClassName = (status?: string | null) => {
    const colors: Record<string, string> = {
        lead: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300',
        quoted: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/40 dark:text-indigo-300',
        approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300',
        scheduled: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-300',
        in_progress: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300',
        completed: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/40 dark:text-green-300',
        invoiced: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/70 dark:bg-purple-950/40 dark:text-purple-300',
        cancelled: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300',
    };

    return colors[status ?? ''] ?? 'border-border bg-muted text-foreground';
};

const priorityBadgeClassName = (priority?: string | null) => {
    const colors: Record<string, string> = {
        urgent: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300',
        high: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300',
        medium: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-300',
        low: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
    };

    return colors[priority ?? ''] ?? 'border-border bg-muted text-foreground';
};

export default function Dashboard({
    filters = {},
    options,
    projects,
    stats,
}: DashboardProps) {
    const { auth } = usePage<PageProps>().props;
    const can = auth.can ?? {};

    const canViewProjects = Boolean(can.viewProjects);
    const canCreateProjects = Boolean(can.createProjects);
    const canUpdateProjects = Boolean(can.updateProjects);
    const canCreateBids = Boolean(can.createBids);

    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');

    useEffect(() => {
        setSearch(filters.search ?? '');
        setStatus(filters.status ?? '');
    }, [filters.search, filters.status]);

    const handleSearch = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            route('dashboard'),
            {
                search: search || undefined,
                status: status || undefined,
            },
            {
                preserveState: true,
                replace: true,
                preserveScroll: true,
            },
        );
    };

    const handleClearFilters = () => {
        setSearch('');
        setStatus('');
        router.get(
            route('dashboard'),
            {},
            {
                preserveState: true,
                replace: true,
                preserveScroll: true,
            },
        );
    };

    const hasActiveFilters = Boolean(filters.search || filters.status);

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="flex flex-1 min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8">
                {/* Dashboard Header & Toolbar */}
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                Dashboard
                            </h1>
                            {stats && (
                                <Badge
                                    variant="secondary"
                                    className="gap-1.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-medium text-xs"
                                >
                                    <BriefcaseIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>
                                        <strong className="font-semibold">{stats.activeProjects}</strong> active / {stats.totalProjects} total projects
                                    </span>
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {canCreateProjects && (
                                <Button
                                    asChild
                                    size="sm"
                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    <Link href={route('admin.projects.create')}>
                                        <PlusIcon className="mr-1.5 size-4" />
                                        Add project
                                    </Link>
                                </Button>
                            )}
                            {canCreateBids && (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={route('admin.bids.create')}>
                                        <ClipboardListIcon className="mr-1.5 size-4" />
                                        Add bid
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Main Content (Projects Directory) */}
                    <div className="flex min-w-0 flex-1 flex-col gap-6">
                            {canViewProjects && projects ? (
                                <Card className="shadow-sm">
                                    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <CardTitle className="text-lg font-bold sm:text-xl">
                                                Projects Directory
                                            </CardTitle>
                                            <CardDescription>
                                                Manage, search, and view all
                                                project records and scopes.
                                            </CardDescription>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {canCreateProjects && (
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                                >
                                                    <Link
                                                        href={route(
                                                            'admin.projects.create',
                                                        )}
                                                    >
                                                        <PlusIcon className="mr-1.5 size-3.5" />
                                                        New project
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>

                                    <CardContent className="flex flex-col gap-4">
                                        {/* Filter and Search Bar */}
                                        <form
                                            onSubmit={handleSearch}
                                            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_auto] lg:items-center"
                                        >
                                            <div className="relative">
                                                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                                <input
                                                    type="search"
                                                    value={search}
                                                    onChange={(e) =>
                                                        setSearch(
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Search project name, #, contractor, or location..."
                                                    className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                                                />
                                            </div>

                                            {options?.statuses && (
                                                <select
                                                    value={status}
                                                    onChange={(e) => {
                                                        const newStatus =
                                                            e.target.value;
                                                        setStatus(newStatus);
                                                        router.get(
                                                            route('dashboard'),
                                                            {
                                                                search:
                                                                    search ||
                                                                    undefined,
                                                                status:
                                                                    newStatus ||
                                                                    undefined,
                                                            },
                                                            {
                                                                preserveState: true,
                                                                replace: true,
                                                                preserveScroll: true,
                                                            },
                                                        );
                                                    }}
                                                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                                                >
                                                    <option value="">
                                                        All project statuses
                                                    </option>
                                                    {options.statuses.map(
                                                        (statusOption) => (
                                                            <option
                                                                key={
                                                                    statusOption.id
                                                                }
                                                                value={
                                                                    statusOption.id
                                                                }
                                                            >
                                                                {
                                                                    statusOption.name
                                                                }
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            )}

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="submit"
                                                    variant="secondary"
                                                    size="sm"
                                                    className="h-10 px-4"
                                                >
                                                    <FilterIcon className="mr-1.5 size-3.5" />
                                                    Filter
                                                </Button>

                                                {hasActiveFilters && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={
                                                            handleClearFilters
                                                        }
                                                        className="h-10 text-xs text-muted-foreground hover:text-foreground"
                                                    >
                                                        <XIcon className="mr-1 size-3.5" />
                                                        Clear
                                                    </Button>
                                                )}
                                            </div>
                                        </form>

                                        {/* Projects Table / Responsive Mobile Cards */}
                                        <div className="overflow-hidden rounded-xl border border-border bg-background">
                                            {/* Table Headers for lg+ */}
                                            <div className="hidden border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:grid xl:grid-cols-[1.2fr_1.1fr_1.2fr_120px_100px_auto] xl:items-center xl:gap-4">
                                                <div>Project info</div>
                                                <div>Contractor</div>
                                                <div>Scopes & Location</div>
                                                <div>Status</div>
                                                <div>Priority</div>
                                                <div className="text-right">
                                                    Actions
                                                </div>
                                            </div>

                                            {/* Project Items */}
                                            <div className="divide-y divide-border">
                                                {projects.data.length > 0 ? (
                                                    projects.data.map(
                                                        (project) => (
                                                            <div
                                                                key={project.id}
                                                                className={cn(
                                                                    'grid gap-3 p-4 transition hover:bg-muted/30 xl:grid-cols-[1.2fr_1.1fr_1.2fr_120px_100px_auto] xl:items-center xl:gap-4',
                                                                    filters.highlight ===
                                                                        project.id &&
                                                                        'bg-emerald-50/70 dark:bg-emerald-950/40',
                                                                )}
                                                            >
                                                                {/* Column 1: Project Info */}
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300"
                                                                        >
                                                                            {
                                                                                project.project_number
                                                                            }
                                                                        </Badge>
                                                                        <Link
                                                                            href={route(
                                                                                'admin.projects.show',
                                                                                project.id,
                                                                            )}
                                                                            className="truncate font-semibold text-foreground hover:text-emerald-600 hover:underline"
                                                                        >
                                                                            {
                                                                                project.name
                                                                            }
                                                                        </Link>
                                                                    </div>
                                                                    {project.service_type && (
                                                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                            {
                                                                                project.service_type
                                                                            }
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* Column 2: Contractor */}
                                                                <div className="min-w-0 text-sm text-muted-foreground">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Contractor
                                                                    </DirectoryFieldLabel>
                                                                    {project
                                                                        .contractors
                                                                        .length >
                                                                    0 ? (
                                                                        <div className="flex flex-col">
                                                                            <p className="truncate font-medium text-foreground">
                                                                                {
                                                                                    project
                                                                                        .contractors[0]
                                                                                        .name
                                                                                }
                                                                            </p>
                                                                            {project
                                                                                .contractors[0]
                                                                                .contact_name && (
                                                                                <p className="truncate text-xs text-muted-foreground">
                                                                                    {
                                                                                        project
                                                                                            .contractors[0]
                                                                                            .contact_name
                                                                                    }
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            No contractor
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Column 3: Scopes & Address */}
                                                                <div className="min-w-0">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Scope & Site
                                                                    </DirectoryFieldLabel>
                                                                    {project.scopes &&
                                                                    project
                                                                        .scopes
                                                                        .length >
                                                                        0 ? (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {project.scopes
                                                                                .slice(
                                                                                    0,
                                                                                    2,
                                                                                )
                                                                                .map(
                                                                                    (
                                                                                        scope,
                                                                                        idx,
                                                                                    ) => (
                                                                                        <Badge
                                                                                            key={
                                                                                                idx
                                                                                            }
                                                                                            variant="secondary"
                                                                                            className="text-[10px]"
                                                                                        >
                                                                                            {
                                                                                                scope.type
                                                                                            }
                                                                                        </Badge>
                                                                                    ),
                                                                                )}
                                                                            {project
                                                                                .scopes
                                                                                .length >
                                                                                2 && (
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className="text-[10px]"
                                                                                >
                                                                                    +
                                                                                    {project
                                                                                        .scopes
                                                                                        .length -
                                                                                        2}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    ) : project.bid_scopes &&
                                                                      project
                                                                          .bid_scopes
                                                                          .length >
                                                                          0 ? (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {project.bid_scopes
                                                                                .slice(
                                                                                    0,
                                                                                    2,
                                                                                )
                                                                                .map(
                                                                                    (
                                                                                        scope,
                                                                                    ) => (
                                                                                        <Badge
                                                                                            key={
                                                                                                scope.id
                                                                                            }
                                                                                            variant="outline"
                                                                                            className="text-[10px]"
                                                                                        >
                                                                                            {
                                                                                                scope.name
                                                                                            }
                                                                                        </Badge>
                                                                                    ),
                                                                                )}
                                                                        </div>
                                                                    ) : project.site_address_line_1 ? (
                                                                        <p className="truncate text-xs text-muted-foreground">
                                                                            {
                                                                                project.site_address_line_1
                                                                            }
                                                                            {project.site_city
                                                                                ? `, ${project.site_city}`
                                                                                : ''}
                                                                        </p>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            No scope details
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Column 4: Status */}
                                                                <div>
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Status
                                                                    </DirectoryFieldLabel>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn(
                                                                            'text-xs font-semibold',
                                                                            statusBadgeClassName(
                                                                                project.status_slug,
                                                                            ),
                                                                        )}
                                                                    >
                                                                        {project.status ||
                                                                            'Lead'}
                                                                    </Badge>
                                                                </div>

                                                                {/* Column 5: Priority */}
                                                                <div>
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Priority
                                                                    </DirectoryFieldLabel>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn(
                                                                            'text-[11px] capitalize',
                                                                            priorityBadgeClassName(
                                                                                project.priority,
                                                                            ),
                                                                        )}
                                                                    >
                                                                        {project.priority ||
                                                                            'Normal'}
                                                                    </Badge>
                                                                </div>

                                                                {/* Column 6: Action Buttons */}
                                                                <div>
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Actions
                                                                    </DirectoryFieldLabel>
                                                                    <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                                                                        <ActionHint hint="Print project">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="icon-sm"
                                                                                className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:border-sky-800/60 dark:text-sky-400 dark:hover:bg-sky-950/40"
                                                                                asChild
                                                                            >
                                                                                <a
                                                                                    href={route(
                                                                                        'admin.projects.document.print',
                                                                                        project.id,
                                                                                    )}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    aria-label="Print project"
                                                                                >
                                                                                    <PrinterIcon className="size-4" />
                                                                                </a>
                                                                            </Button>
                                                                        </ActionHint>

                                                                        <ActionHint hint="Download PDF">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="icon-sm"
                                                                                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-800/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                                                                asChild
                                                                            >
                                                                                <a
                                                                                    href={route(
                                                                                        'admin.projects.export.pdf',
                                                                                        project.id,
                                                                                    )}
                                                                                    aria-label="Download as PDF"
                                                                                >
                                                                                    <FileTextIcon className="size-4" />
                                                                                </a>
                                                                            </Button>
                                                                        </ActionHint>

                                                                        <ActionHint hint="Download Word">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="icon-sm"
                                                                                className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800/60 dark:text-blue-400 dark:hover:bg-blue-950/40"
                                                                                asChild
                                                                            >
                                                                                <a
                                                                                    href={route(
                                                                                        'admin.projects.export.word',
                                                                                        project.id,
                                                                                    )}
                                                                                    aria-label="Download as Word"
                                                                                >
                                                                                    <FileTypeIcon className="size-4" />
                                                                                </a>
                                                                            </Button>
                                                                        </ActionHint>

                                                                        <ActionHint hint="View project details">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="icon-sm"
                                                                                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-800/60 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                                                                                asChild
                                                                            >
                                                                                <Link
                                                                                    href={route(
                                                                                        'admin.projects.show',
                                                                                        project.id,
                                                                                    )}
                                                                                    aria-label="View project details"
                                                                                >
                                                                                    <EyeIcon className="size-4" />
                                                                                </Link>
                                                                            </Button>
                                                                        </ActionHint>

                                                                        {canUpdateProjects && (
                                                                            <ActionHint hint="Edit project">
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="icon-sm"
                                                                                    className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                                                                    asChild
                                                                                >
                                                                                    <Link
                                                                                        href={route(
                                                                                            'admin.projects.edit',
                                                                                            project.id,
                                                                                        )}
                                                                                        aria-label="Edit this project"
                                                                                    >
                                                                                        <EditIcon className="size-4" />
                                                                                    </Link>
                                                                                </Button>
                                                                            </ActionHint>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ),
                                                    )
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center p-12 text-center">
                                                        <BriefcaseIcon className="size-10 text-muted-foreground/60" />
                                                        <p className="mt-3 font-semibold text-foreground">
                                                            No projects found
                                                        </p>
                                                        <p className="mt-1 text-sm text-muted-foreground">
                                                            {hasActiveFilters
                                                                ? 'Try adjusting your search query or status filter.'
                                                                : 'Create your first project to get started.'}
                                                        </p>
                                                        {hasActiveFilters && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={
                                                                    handleClearFilters
                                                                }
                                                                className="mt-4"
                                                            >
                                                                Reset filters
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Pagination Nav */}
                                        <PaginationNav
                                            paginator={projects}
                                            itemLabel="projects"
                                        />
                                    </CardContent>
                                </Card>
                            ) : (
                                /* Fallback if user doesn't have project permission */
                                <Card className="shadow-sm">
                                    <CardHeader>
                                        <CardTitle>
                                            Personal Workspace
                                        </CardTitle>
                                        <CardDescription>
                                            You are signed in to Gateway. You
                                            can manage your profile or review
                                            account settings below.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-4">
                                        <div className="rounded-xl border border-dashed border-border p-6 text-center">
                                            <ShieldCheckIcon className="mx-auto size-10 text-muted-foreground" />
                                            <h3 className="mt-3 font-semibold text-foreground">
                                                Workspace Ready
                                            </h3>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Contact your administrator if
                                                you need access to projects,
                                                bids, or directory tools.
                                            </p>
                                            <Button
                                                asChild
                                                className="mt-4"
                                                variant="outline"
                                            >
                                                <Link
                                                    href={route('profile.edit')}
                                                >
                                                    Open profile settings
                                                    <ArrowRightIcon className="ml-1.5 size-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                    </div>
            </div>
        </AuthenticatedLayout>
    );
}
