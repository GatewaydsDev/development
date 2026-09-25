import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
                                        className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground sm:w-64"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    className="h-11 min-w-[8.5rem] bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                                >
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
                                                <DirectoryFieldLabel hideFrom="xl">
                                                    Name
                                                </DirectoryFieldLabel>
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
                                                <DirectoryFieldLabel hideFrom="xl">
                                                    Email
                                                </DirectoryFieldLabel>
                                                {user.email}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                <DirectoryFieldLabel hideFrom="xl">
                                                    Profile
                                                </DirectoryFieldLabel>
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
                                                <DirectoryFieldLabel hideFrom="xl">
                                                    Level
                                                </DirectoryFieldLabel>
                                                <Badge variant="outline">
                                                    {user.level?.name ??
                                                        'No level'}
                                                </Badge>
                                            </div>
                                            <div className="hidden text-sm text-muted-foreground md:block">
                                                <DirectoryFieldLabel hideFrom="xl">
                                                    Last login
                                                </DirectoryFieldLabel>
                                                {user.last_login_at ?? 'Never'}
                                            </div>
                                            <div className="flex min-w-0 flex-col gap-1 md:items-end">
                                                <DirectoryFieldLabel hideFrom="xl">
                                                    Actions
                                                </DirectoryFieldLabel>
                                                <div className="flex flex-wrap gap-1.5 md:justify-end">
                                                {canManageAccess &&
                                                    user.level && (
                                                        <ActionHint hint="Edit permissions">
                                                            <Button
                                                                variant="outline"
                                                                size="icon-sm"
                                                                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-800/60 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={`${route('admin.access-control.edit')}?level=${user.level.id}`}
                                                                    aria-label="Edit permissions"
                                                                >
                                                                    <SlidersHorizontalIcon className="size-4" />
                                                                </Link>
                                                            </Button>
                                                        </ActionHint>
                                                    )}

                                                {canUpdateUsers && (
                                                    <ActionHint hint="Edit this user">
                                                        <Button
                                                            variant="outline"
                                                            size="icon-sm"
                                                            className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                                            asChild
                                                        >
                                                            <Link
                                                                href={route(
                                                                    'admin.users.edit',
                                                                    user.id,
                                                                )}
                                                                aria-label="Edit this user"
                                                            >
                                                                <EditIcon className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </ActionHint>
                                                )}

                                                {!canManageAccess &&
                                                    !canUpdateUsers && (
                                                    <Badge variant="outline">
                                                        View only
                                                    </Badge>
                                                    )}
                                                </div>
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

                            <PaginationNav
                                paginator={users}
                                itemLabel="users"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
