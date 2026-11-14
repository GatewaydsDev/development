import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PaginationNav from '@/Components/PaginationNav';
import DirectoryFieldLabel from '@/Components/DirectoryFieldLabel';
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
import {
    ActivityIcon,
    ArchiveIcon,
    DatabaseIcon,
    LogInIcon,
    MousePointerClickIcon,
    SearchIcon,
} from 'lucide-react';
import { FormEvent, useState } from 'react';

type ActivityUser = {
    id: number;
    name: string;
    email: string;
    last_login_at: string | null;
};

type UserActivityRow = {
    id: number;
    event_type: string;
    action: string;
    page_name: string | null;
    description: string | null;
    route_name: string | null;
    method: string | null;
    path: string | null;
    ip_address: string | null;
    subject_type: string | null;
    subject_id: number | null;
    occurred_at: string | null;
    metadata: Record<string, unknown> | null;
    user: ActivityUser | null;
};

type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type UserActivitiesPaginator = {
    data: UserActivityRow[];
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    links: PaginationLink[];
};

type IndexProps = {
    filters: {
        search?: string;
        archive?: boolean;
    };
    archiveCount: number;
    retentionMonths: number;
    stats: {
        total: number;
        logins: number;
        pageViews: number;
        recordActions: number;
    };
    activities: UserActivitiesPaginator;
};

const eventLabels: Record<string, string> = {
    login: 'Login',
    page_view: 'Page view',
    record_created: 'Created',
    record_updated: 'Updated',
    record_deleted: 'Deleted',
};

export default function Index({
    filters,
    archiveCount,
    retentionMonths,
    stats,
    activities,
}: IndexProps) {
    const viewingArchive = Boolean(filters.archive);
    const [search, setSearch] = useState(filters.search ?? '');

    const visit = (archive: boolean, nextSearch = search) => {
        router.get(
            route('admin.user-activities.index'),
            {
                search: nextSearch,
                ...(archive ? { archive: 1 } : {}),
            },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        visit(viewingArchive);
    };

    const metadataSummary = (metadata: Record<string, unknown> | null) => {
        if (!metadata || !('changes' in metadata)) {
            return null;
        }

        const changes = metadata.changes;

        if (!changes || typeof changes !== 'object') {
            return null;
        }

        const changedFields = Object.keys(changes);

        return changedFields.length > 0
            ? `Changed: ${changedFields.join(', ')}`
            : null;
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground sm:text-sm"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <span>Security</span>
                        <span>/</span>
                        <span className="text-foreground">
                            {viewingArchive
                                ? 'Activity archive'
                                : 'User Activity'}
                        </span>
                    </nav>
                    <h2 className="mt-1 text-lg font-semibold leading-tight text-emerald-700 sm:text-xl dark:text-emerald-300">
                        {viewingArchive
                            ? 'Activity archive'
                            : 'User activity audit'}
                    </h2>
                </div>
            }
        >
            <Head
                title={viewingArchive ? 'Activity archive' : 'User Activity'}
            />

            <div className="py-4 sm:py-8">
                <div className="flex w-full flex-col gap-4 px-3 sm:gap-6 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 gap-2 sm:gap-4 md:ml-auto md:w-full md:max-w-5xl xl:grid-cols-4">
                        <Card size="sm">
                            <CardHeader className="gap-1 p-3 sm:p-4">
                                <CardTitle className="flex items-center gap-1.5 text-sm sm:text-base">
                                    <ActivityIcon className="size-4 text-muted-foreground" />
                                    Total events
                                </CardTitle>
                                <CardDescription className="hidden sm:block">
                                    {viewingArchive
                                        ? `Archived activity older than ${retentionMonths} months.`
                                        : `Activity from the last ${retentionMonths} months.`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                                <p className="text-2xl font-semibold sm:text-3xl">
                                    {stats.total}
                                </p>
                            </CardContent>
                        </Card>

                        <Card size="sm">
                            <CardHeader className="gap-1 p-3 sm:p-4">
                                <CardTitle className="flex items-center gap-1.5 text-sm sm:text-base">
                                    <LogInIcon className="size-4 text-muted-foreground" />
                                    Logins
                                </CardTitle>
                                <CardDescription className="hidden sm:block">
                                    Successful sign-ins.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                                <p className="text-2xl font-semibold sm:text-3xl">
                                    {stats.logins}
                                </p>
                            </CardContent>
                        </Card>

                        <Card size="sm">
                            <CardHeader className="gap-1 p-3 sm:p-4">
                                <CardTitle className="flex items-center gap-1.5 text-sm sm:text-base">
                                    <MousePointerClickIcon className="size-4 text-muted-foreground" />
                                    Page views
                                </CardTitle>
                                <CardDescription className="hidden sm:block">
                                    Authenticated page access.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                                <p className="text-2xl font-semibold sm:text-3xl">
                                    {stats.pageViews}
                                </p>
                            </CardContent>
                        </Card>

                        <Card size="sm">
                            <CardHeader className="gap-1 p-3 sm:p-4">
                                <CardTitle className="flex items-center gap-1.5 text-sm sm:text-base">
                                    <DatabaseIcon className="size-4 text-muted-foreground" />
                                    Record actions
                                </CardTitle>
                                <CardDescription className="hidden sm:block">
                                    Inserts, updates, and deletes.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                                <p className="text-2xl font-semibold sm:text-3xl">
                                    {stats.recordActions}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 p-3 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>
                                    {viewingArchive
                                        ? 'Activity archive'
                                        : 'Activity log'}
                                </CardTitle>
                                <CardDescription>
                                    {viewingArchive
                                        ? 'Older activity kept out of the current log. Search by user, page, action, route, or path.'
                                        : `The current log keeps the last ${retentionMonths} months. Search by user, page, action, route, or path.`}
                                </CardDescription>
                            </div>
                            <form
                                onSubmit={submit}
                                className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
                            >
                                {viewingArchive ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => visit(false, '')}
                                    >
                                        Current log
                                    </Button>
                                ) : archiveCount > 0 ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => visit(true, '')}
                                    >
                                        <ArchiveIcon className="size-4" />
                                        View archive ({archiveCount})
                                    </Button>
                                ) : null}
                                <div className="relative w-full sm:w-auto">
                                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search activity"
                                        className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground sm:w-64"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    variant="outline"
                                    size="sm"
                                    className="w-full sm:w-auto"
                                >
                                    <SearchIcon data-icon="inline-start" />
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="hidden grid-cols-[1.1fr_1.3fr_1.2fr_1.3fr_1fr] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                                    <div>User</div>
                                    <div>Activity</div>
                                    <div>Page / Route</div>
                                    <div>Record / Request</div>
                                    <div>Time</div>
                                </div>

                                {activities.data.length > 0 ? (
                                    activities.data.map((activity) => (
                                        <div
                                            key={activity.id}
                                            className="border-b border-border last:border-b-0"
                                        >
                                            <article className="space-y-3 p-3 sm:p-4 lg:hidden">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-foreground">
                                                            {activity.user
                                                                ?.name ??
                                                                'Deleted user'}
                                                        </p>
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {activity.user
                                                                ?.email ??
                                                                'No email available'}
                                                        </p>
                                                    </div>
                                                    <time className="max-w-28 shrink-0 text-right text-[11px] leading-4 text-muted-foreground">
                                                        {activity.occurred_at ??
                                                            'Not recorded'}
                                                    </time>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline">
                                                        {eventLabels[
                                                            activity.event_type
                                                        ] ??
                                                            activity.event_type}
                                                    </Badge>
                                                    <span className="text-sm font-medium text-foreground">
                                                        {activity.action}
                                                    </span>
                                                </div>

                                                <p className="break-words text-sm leading-5 text-muted-foreground">
                                                    {activity.description ??
                                                        'No description recorded.'}
                                                </p>

                                                {metadataSummary(
                                                    activity.metadata,
                                                ) && (
                                                    <p className="break-words text-xs text-muted-foreground">
                                                        {metadataSummary(
                                                            activity.metadata,
                                                        )}
                                                    </p>
                                                )}

                                                <details className="group rounded-md border border-border bg-muted/30">
                                                    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-foreground">
                                                        <span className="group-open:hidden">
                                                            Show technical
                                                            details
                                                        </span>
                                                        <span className="hidden group-open:inline">
                                                            Hide technical
                                                            details
                                                        </span>
                                                    </summary>
                                                    <dl className="grid gap-3 border-t border-border px-3 py-3 text-xs">
                                                        <div>
                                                            <dt className="font-medium text-foreground">
                                                                Page / Route
                                                            </dt>
                                                            <dd className="mt-0.5 break-words text-muted-foreground">
                                                                {activity.page_name ??
                                                                    'Not available'}
                                                                <span className="block break-all">
                                                                    {activity.route_name ??
                                                                        'No route'}
                                                                </span>
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="font-medium text-foreground">
                                                                Record / Request
                                                            </dt>
                                                            <dd className="mt-0.5 text-muted-foreground">
                                                                <span className="block">
                                                                    {activity.subject_type
                                                                        ? `${activity.subject_type} #${activity.subject_id}`
                                                                        : 'No record linked'}
                                                                </span>
                                                                <span className="block break-all">
                                                                    {activity.method
                                                                        ? `${activity.method} ${activity.path}`
                                                                        : (activity.path ??
                                                                          'No request path')}
                                                                </span>
                                                            </dd>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <dt className="font-medium text-foreground">
                                                                    IP address
                                                                </dt>
                                                                <dd className="mt-0.5 break-all text-muted-foreground">
                                                                    {activity.ip_address ??
                                                                        'Unknown'}
                                                                </dd>
                                                            </div>
                                                            <div>
                                                                <dt className="font-medium text-foreground">
                                                                    Last login
                                                                </dt>
                                                                <dd className="mt-0.5 text-muted-foreground">
                                                                    {activity
                                                                        .user
                                                                        ?.last_login_at ??
                                                                        'Never'}
                                                                </dd>
                                                            </div>
                                                        </div>
                                                    </dl>
                                                </details>
                                            </article>

                                            <div className="hidden gap-4 px-4 py-4 lg:grid lg:grid-cols-[1.1fr_1.3fr_1.2fr_1.3fr_1fr] lg:items-center">
                                                <div className="min-w-0">
                                                    <DirectoryFieldLabel>
                                                        User
                                                    </DirectoryFieldLabel>
                                                    <p className="truncate font-medium text-foreground">
                                                        {activity.user?.name ??
                                                            'Deleted user'}
                                                    </p>
                                                    <p className="truncate text-sm text-muted-foreground">
                                                        {activity.user?.email ??
                                                            'No email available'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Last login:{' '}
                                                        {activity.user
                                                            ?.last_login_at ??
                                                            'Never'}
                                                    </p>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <DirectoryFieldLabel>
                                                        Activity
                                                    </DirectoryFieldLabel>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline">
                                                            {eventLabels[
                                                                activity
                                                                    .event_type
                                                            ] ??
                                                                activity.event_type}
                                                        </Badge>
                                                        <span className="text-sm font-medium text-foreground">
                                                            {activity.action}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {activity.description ??
                                                            'No description recorded.'}
                                                    </p>
                                                    {metadataSummary(
                                                        activity.metadata,
                                                    ) && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {metadataSummary(
                                                                activity.metadata,
                                                            )}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="text-sm text-muted-foreground">
                                                    <DirectoryFieldLabel>
                                                        Page / Route
                                                    </DirectoryFieldLabel>
                                                    <span className="block font-medium text-foreground">
                                                        {activity.page_name ??
                                                            'Not available'}
                                                    </span>
                                                    <span className="block">
                                                        {activity.route_name ??
                                                            'No route'}
                                                    </span>
                                                </div>

                                                <div className="text-sm text-muted-foreground">
                                                    <DirectoryFieldLabel>
                                                        Record / Request
                                                    </DirectoryFieldLabel>
                                                    <span className="block">
                                                        {activity.subject_type
                                                            ? `${activity.subject_type} #${activity.subject_id}`
                                                            : 'No record linked'}
                                                    </span>
                                                    <span className="block">
                                                        {activity.method
                                                            ? `${activity.method} ${activity.path}`
                                                            : (activity.path ??
                                                              'No request path')}
                                                    </span>
                                                    <span className="block">
                                                        IP:{' '}
                                                        {activity.ip_address ??
                                                            'Unknown'}
                                                    </span>
                                                </div>

                                                <div className="text-sm text-muted-foreground">
                                                    <DirectoryFieldLabel>
                                                        Time
                                                    </DirectoryFieldLabel>
                                                    {activity.occurred_at ??
                                                        'Not recorded'}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-12 text-center">
                                        <ActivityIcon className="mx-auto size-10 text-muted-foreground" />
                                        <p className="mt-3 font-medium">
                                            No activity found
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {viewingArchive
                                                ? 'Nothing in the archive matches this search.'
                                                : 'Try another search or wait for new user activity.'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <PaginationNav
                                paginator={activities}
                                itemLabel="events"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
