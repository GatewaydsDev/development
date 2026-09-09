import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Head, Link, router } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import {
    BriefcaseIcon,
    EditIcon,
    EyeIcon,
    PlusIcon,
    SearchIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import {
    optionLabel,
    type ProjectOptions,
    type ProjectsPaginator,
} from './types';

type IndexProps = {
    filters: {
        search?: string;
        status?: string;
        highlight?: number | null;
    };
    options: ProjectOptions;
    projects: ProjectsPaginator;
};

const statusBadgeClassName = (status?: string | null) => {
    const colors: Record<string, string> = {
        lead: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300',
        quoted: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/40 dark:text-indigo-300',
        approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300',
        scheduled: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-300',
        in_progress: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300',
        completed: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/40 dark:text-green-300',
        cancelled: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300',
    };

    return (
        (status && colors[status]) ||
        'border-border bg-muted text-muted-foreground'
    );
};

export default function Index({ filters, options, projects }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const highlightedProjectId = filters.highlight ?? null;

    useEffect(() => {
        if (!highlightedProjectId) {
            return;
        }

        document
            .getElementById(`project-row-${highlightedProjectId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlightedProjectId]);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.projects.index'),
            { search, status },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const paginationLabel = (label: string) =>
        label
            .replace('&laquo; Previous', 'Previous')
            .replace('Next &raquo;', 'Next');

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">Projects</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Projects
                        </h2>
                    </div>

                    {options.can.create && (
                        <Button asChild>
                            <Link href={route('admin.projects.create')}>
                                <PlusIcon className="size-4" />
                                Add project
                            </Link>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Projects" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BriefcaseIcon className="size-4 text-muted-foreground" />
                                    Total projects
                                </CardTitle>
                                <CardDescription>
                                    Current records in the system.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {projects.total}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Project directory</CardTitle>
                                <CardDescription>
                                    Search, review, and update project records.
                                </CardDescription>
                            </div>
                            <form
                                onSubmit={submit}
                                className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
                            >
                                <div className="relative">
                                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search projects"
                                        className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
                                    />
                                </div>
                                <select
                                    value={status}
                                    onChange={(event) =>
                                        setStatus(event.target.value)
                                    }
                                    className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm"
                                >
                                    <option value="">All statuses</option>
                                    {options.statuses.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                                <Button type="submit" variant="outline">
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-hidden rounded-lg border border-border">
                                <div className="hidden grid-cols-[minmax(14rem,1.4fr)_minmax(12rem,1fr)_minmax(12rem,1.1fr)_8rem_9.5rem] items-center gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                                    <div>Project</div>
                                    <div>General contractor</div>
                                    <div>Scope</div>
                                    <div>Status</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {projects.data.length > 0 ? (
                                    projects.data.map((project) => (
                                        <div
                                            id={`project-row-${project.id}`}
                                            key={project.id}
                                            className={cn(
                                                'grid gap-3 border-b border-border px-4 py-4 last:border-b-0 md:min-h-20 md:grid-cols-[minmax(14rem,1.4fr)_minmax(12rem,1fr)_minmax(12rem,1.1fr)_8rem_9.5rem] md:items-center md:gap-4',
                                                highlightedProjectId ===
                                                    project.id &&
                                                    'bg-emerald-50 dark:bg-emerald-950/30',
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-foreground">
                                                    {project.name}
                                                </p>
                                                <p className="truncate text-sm text-muted-foreground">
                                                    {project.customer?.name ||
                                                        'No customer'}
                                                </p>
                                            </div>
                                            <div className="min-w-0 truncate text-sm text-muted-foreground">
                                                {project.contractors?.length
                                                    ? project.contractors
                                                          .map(
                                                              (contractor) =>
                                                                  contractor.name,
                                                          )
                                                          .join(', ')
                                                    : 'Not added yet'}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {project.scopes?.length > 0 ? (
                                                    project.scopes
                                                        .slice(0, 2)
                                                        .map((scope) => (
                                                            <Badge
                                                                key={
                                                                    scope.id ??
                                                                    scope.type
                                                                }
                                                                variant="outline"
                                                            >
                                                                {optionLabel(
                                                                    scope.type,
                                                                )}
                                                            </Badge>
                                                        ))
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        None
                                                    </span>
                                                )}
                                                {project.scopes?.length > 2 && (
                                                    <Badge variant="outline">
                                                        +
                                                        {project.scopes.length -
                                                            2}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center">
                                                <Badge
                                                    variant="outline"
                                                    className={statusBadgeClassName(
                                                        project.status_slug,
                                                    )}
                                                >
                                                    {project.status ||
                                                        'Not set'}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-2 md:justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link
                                                        href={route(
                                                            'admin.projects.show',
                                                            project.id,
                                                        )}
                                                    >
                                                        <EyeIcon className="size-4" />
                                                        View
                                                    </Link>
                                                </Button>
                                                {options.can.update && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={route(
                                                                'admin.projects.edit',
                                                                project.id,
                                                            )}
                                                        >
                                                            <EditIcon className="size-4" />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-12 text-center">
                                        <BriefcaseIcon className="mx-auto size-10 text-muted-foreground" />
                                        <p className="mt-3 font-medium">
                                            No projects found
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Try another search or create the
                                            first project.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Showing {projects.from ?? 0} to{' '}
                                    {projects.to ?? 0} of {projects.total}{' '}
                                    projects
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {projects.links.length > 3 &&
                                        projects.links.map((link, index) =>
                                            link.url ? (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant={
                                                        link.active
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link href={link.url}>
                                                        {paginationLabel(
                                                            link.label,
                                                        )}
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant="outline"
                                                    size="sm"
                                                    disabled
                                                >
                                                    {paginationLabel(
                                                        link.label,
                                                    )}
                                                </Button>
                                            ),
                                        )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

