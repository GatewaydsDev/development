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
    EditIcon,
    EyeIcon,
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
    type ProjectPayload,
    type ProjectsPaginator,
    scopeTypeLabel,
} from './Admin/Projects/types';

const projectListGridClassName =
    'xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.5fr)_7.75rem_6.75rem_12.75rem] xl:items-start xl:gap-4';

function projectLocationLines(project: ProjectPayload): string[] {
    const locality = [
        project.site_city?.trim(),
        [project.site_state?.trim(), project.site_postal_code?.trim()]
            .filter(Boolean)
            .join(' '),
    ]
        .filter(Boolean)
        .join(', ');

    const country = project.site_country?.trim() ?? '';
    const hideCountry = /^(us|usa|united states)$/i.test(country);

    return [
        project.site_address_line_1?.trim(),
        project.site_address_line_2?.trim(),
        locality,
        hideCountry ? '' : country,
    ].filter((line): line is string => Boolean(line));
}

function projectScopeLabels(
    project: ProjectPayload,
    scopeTypes: ProjectOptions['scopeTypes'] | undefined,
): string[] {
    const scopes = (project.scopes ?? [])
        .map((scope) => scopeTypeLabel(scope.type, scopeTypes))
        .filter((label) => label !== 'Not set');

    if (scopes.length > 0) {
        return scopes;
    }

    return (project.bid_scopes ?? [])
        .map((scope) => scope.name.trim())
        .filter(Boolean);
}

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

function ScopeLocationCell({
    project,
    scopeTypes,
}: {
    project: ProjectPayload;
    scopeTypes?: ProjectOptions['scopeTypes'];
}) {
    const scopes = projectScopeLabels(project, scopeTypes);
    const locationLines = projectLocationLines(project);

    if (scopes.length === 0 && locationLines.length === 0) {
        return (
            <span className="text-xs text-muted-foreground">
                No scope details
            </span>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            {scopes.length > 0 && (
                <ul className="flex min-w-0 flex-col gap-1">
                    {scopes.map((scope, index) => (
                        <li
                            key={`${scope}-${index}`}
                            className="break-words text-xs leading-snug text-foreground"
                        >
                            {scope}
                        </li>
                    ))}
                </ul>
            )}
            {locationLines.length > 0 && (
                <div className="flex min-w-0 flex-col">
                    {locationLines.map((line, index) => (
                        <p
                            key={`${line}-${index}`}
                            className="break-words text-xs leading-snug text-muted-foreground"
                        >
                            {line}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}

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
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
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
                                        <div className="overflow-x-auto rounded-xl border border-border bg-background">
                                            <div className="xl:min-w-[72rem]">
                                            {/* Table Headers for lg+ */}
                                            <div
                                                className={cn(
                                                    'hidden border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:grid',
                                                    projectListGridClassName,
                                                )}
                                            >
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
                                                                    'grid gap-3 p-4 transition hover:bg-muted/30 xl:grid',
                                                                    projectListGridClassName,
                                                                    filters.highlight ===
                                                                        project.id &&
                                                                        'bg-emerald-50/70 dark:bg-emerald-950/40',
                                                                )}
                                                            >
                                                                {/* Column 1: Project Info */}
                                                                <div className="flex min-w-0 flex-col gap-1">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="w-fit max-w-full whitespace-normal break-words font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300"
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
                                                                        className="break-words font-semibold leading-snug text-foreground hover:text-emerald-600 hover:underline"
                                                                    >
                                                                        {
                                                                            project.name
                                                                        }
                                                                    </Link>
                                                                    {project.service_type && (
                                                                        <p className="break-words text-xs leading-snug text-muted-foreground">
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
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <p className="break-words font-medium leading-snug text-foreground">
                                                                                {
                                                                                    project
                                                                                        .contractors[0]
                                                                                        .name
                                                                                }
                                                                            </p>
                                                                            {project
                                                                                .contractors[0]
                                                                                .contact_name && (
                                                                                <p className="break-words text-xs leading-snug text-muted-foreground">
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
                                                                    <ScopeLocationCell
                                                                        project={
                                                                            project
                                                                        }
                                                                        scopeTypes={
                                                                            options?.scopeTypes
                                                                        }
                                                                    />
                                                                </div>

                                                                {/* Column 4: Status */}
                                                                <div className="min-w-0">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Status
                                                                    </DirectoryFieldLabel>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn(
                                                                            'h-auto max-w-full whitespace-normal break-words py-1 text-xs font-semibold leading-snug',
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
                                                                <div className="min-w-0">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Priority
                                                                    </DirectoryFieldLabel>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn(
                                                                            'h-auto max-w-full whitespace-normal break-words py-1 text-[11px] capitalize leading-snug',
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
                                                                <div className="min-w-0">
                                                                    <DirectoryFieldLabel hideFrom="xl">
                                                                        Actions
                                                                    </DirectoryFieldLabel>
                                                                    <div className="flex flex-wrap items-center gap-1.5 xl:flex-nowrap xl:justify-end">
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
