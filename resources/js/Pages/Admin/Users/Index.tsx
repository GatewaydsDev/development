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
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    EditIcon,
    SearchIcon,
    ShieldIcon,
    SlidersHorizontalIcon,
    UserPlusIcon,
    UsersIcon,
} from 'lucide-react';
import { FormEvent, useState } from 'react';

type UserRow = {
    id: number;
    name: string;
    email: string;
    date_of_birth: string | null;
    preferred_language: {
        id: number;
        name: string;
        abbreviation: string;
    } | null;
    level: {
        id: number;
        name: string;
    } | null;
    created_at: string | null;
    last_login_at: string | null;
};

type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type UsersPaginator = {
    data: UserRow[];
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
    users: UsersPaginator;
};

export default function Index({ filters, users }: IndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreateUsers = Boolean(auth.can?.createUsers);
    const canUpdateUsers = Boolean(auth.can?.updateUsers);
    const canManageAccess = Boolean(auth.can?.manageAccess);
    const [search, setSearch] = useState(filters.search ?? '');

    const paginationLabel = (label: string) =>
        label
            .replace('&laquo; Previous', 'Previous')
            .replace('Next &raquo;', 'Next');

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.users.index'),
            { search },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav
                            aria-label="Breadcrumb"
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                        >
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">Users</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            User management
                        </h2>
                    </div>
                    {canCreateUsers && (
                        <Button asChild>
                            <Link href={route('admin.users.create')}>
                                <UserPlusIcon className="size-4" />
                                Add new
                            </Link>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Users" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UsersIcon className="size-4 text-muted-foreground" />
                                    Total users
                                </CardTitle>
                                <CardDescription>
                                    Current records in the system.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {users.total}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldIcon className="size-4 text-muted-foreground" />
                                    Access levels
                                </CardTitle>
                                <CardDescription>
                                    Role-based control is applied by Laravel
                                    Gates.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Badge variant="outline">
                                    Super Admin protected
                                </Badge>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Directory range</CardTitle>
                                <CardDescription>
                                    Showing the current page of users.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {users.from ?? 0}-{users.to ?? 0}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Users</CardTitle>
                                <CardDescription>
                                    Search, review, and update team member
                                    access.
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
                                        placeholder="Search users"
                                        className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
                                    />
                                </div>
                                <Button type="submit" variant="outline">
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="hidden grid-cols-[1.1fr_1.2fr_1fr_0.9fr_1fr_minmax(220px,auto)] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
                                    <div>Name</div>
                                    <div>Email</div>
                                    <div>Profile</div>
                                    <div>Level</div>
                                    <div>Last login</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {users.data.length > 0 ? (
                                    users.data.map((user) => (
                                        <div
                                            key={user.id}
                                            className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 xl:grid-cols-[1.1fr_1.2fr_1fr_0.9fr_1fr_minmax(220px,auto)] xl:items-center xl:gap-4"
                                        >
                                            <div>
                                                <p className="font-medium text-foreground">
                                                    {user.name}
                                                </p>
                                                <p className="text-sm text-muted-foreground md:hidden">
                                                    {user.email}
                                                </p>
                                                <p className="text-sm text-muted-foreground md:hidden">
                                                    Last login:{' '}
                                                    {user.last_login_at ??
                                                        'Never'}
                                                </p>
                                            </div>
                                            <div className="hidden text-sm text-muted-foreground md:block">
                                                {user.email}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                <span className="block">
                                                    DOB:{' '}
                                                    {user.date_of_birth ??
                                                        'Not added'}
                                                </span>
                                                <span className="block">
                                                    Language:{' '}
                                                    {user.preferred_language
                                                        ? `${user.preferred_language.name} (${user.preferred_language.abbreviation.toUpperCase()})`
                                                        : 'Not added'}
                                                </span>
                                            </div>
                                            <div>
                                                <Badge variant="outline">
                                                    {user.level?.name ??
                                                        'No level'}
                                                </Badge>
                                            </div>
                                            <div className="hidden text-sm text-muted-foreground md:block">
                                                {user.last_login_at ?? 'Never'}
                                            </div>
                                            <div className="flex flex-wrap gap-2 md:justify-end">
                                                {canManageAccess &&
                                                    user.level && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            asChild
                                                        >
                                                            <Link
                                                                href={`${route('admin.access-control.edit')}?level=${user.level.id}`}
                                                            >
                                                                <SlidersHorizontalIcon className="size-4" />
                                                                Permissions
                                                            </Link>
                                                        </Button>
                                                    )}

                                                {canUpdateUsers && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={route(
                                                                'admin.users.edit',
                                                                user.id,
                                                            )}
                                                        >
                                                            <EditIcon className="size-4" />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                )}

                                                {!canManageAccess &&
                                                    !canUpdateUsers && (
                                                    <Badge variant="outline">
                                                        View only
                                                    </Badge>
                                                    )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-12 text-center">
                                        <UsersIcon className="mx-auto size-10 text-muted-foreground" />
                                        <p className="mt-3 font-medium">
                                            No users found
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Try another search or create the
                                            first user.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Showing {users.from ?? 0} to{' '}
                                    {users.to ?? 0} of {users.total} users,{' '}
                                    {users.per_page} per page
                                </p>

                                <div className="flex flex-wrap gap-2">
                                    {users.links.length > 3 &&
                                        users.links.map((link, index) =>
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
