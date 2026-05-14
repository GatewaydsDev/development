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
import {
    ActivityIcon,
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
    };
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

export default function Index({ filters, stats, activities }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');

    const paginationLabel = (label: string) =>
        label
            .replace('&laquo; Previous', 'Previous')
            .replace('Next &raquo;', 'Next');

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.user-activities.index'),
            { search },
            {
                preserveState: true,
                replace: true,
            },
        );
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
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <span>Security</span>
                        <span>/</span>
                        <span className="text-foreground">User Activity</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        User activity audit
                    </h2>
                </div>
            }
        >
            <Head title="User Activity" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ActivityIcon className="size-4 text-muted-foreground" />
                                    Total events
                                </CardTitle>
                                <CardDescription>
                                    All captured user activity.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {stats.total}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <LogInIcon className="size-4 text-muted-foreground" />
                                    Logins
                                </CardTitle>
                                <CardDescription>
                                    Successful sign-ins.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {stats.logins}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MousePointerClickIcon className="size-4 text-muted-foreground" />
                                    Page views
                                </CardTitle>
                                <CardDescription>
                                    Authenticated page access.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {stats.pageViews}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <DatabaseIcon className="size-4 text-muted-foreground" />
                                    Record actions
                                </CardTitle>
                                <CardDescription>
                                    Inserts, updates, and deletes.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {stats.recordActions}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Activity log</CardTitle>
                                <CardDescription>
                                    Search by user, page, action, route, or path.
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
                                        placeholder="Search activity"
                                        className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
                                    />
                                </div>
                                <Button type="submit" variant="outline">
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-hidden rounded-lg border border-border">
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
                                            className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 lg:grid-cols-[1.1fr_1.3fr_1.2fr_1.3fr_1fr] lg:items-center lg:gap-4"
                                        >
                                            <div className="min-w-0">
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
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline">
                                                        {eventLabels[
                                                            activity.event_type
                                                        ] ?? activity.event_type}
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
                                                <span className="block">
                                                    {activity.subject_type
                                                        ? `${activity.subject_type} #${activity.subject_id}`
                                                        : 'No record linked'}
                                                </span>
                                                <span className="block">
                                                    {activity.method
                                                        ? `${activity.method} ${activity.path}`
                                                        : activity.path ??
                                                          'No request path'}
                                                </span>
                                                <span className="block">
                                                    IP:{' '}
                                                    {activity.ip_address ??
                                                        'Unknown'}
                                                </span>
                                            </div>

                                            <div className="text-sm text-muted-foreground">
                                                {activity.occurred_at ??
                                                    'Not recorded'}
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
                                            Try another search or wait for new
                                            user activity.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Showing {activities.from ?? 0} to{' '}
                                    {activities.to ?? 0} of {activities.total}{' '}
                                    events, {activities.per_page} per page
                                </p>

                                <div className="flex flex-wrap gap-2">
                                    {activities.links.length > 3 &&
                                        activities.links.map((link, index) =>
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
