import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ActionHint from '@/Components/ActionHint';
import DirectoryFieldLabel from '@/Components/DirectoryFieldLabel';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { BlockHistoryButton, fmt, RELEASE_METHODS, type BlockLog } from './Partials/BlockHistory';
import PaginationNav from '@/Components/PaginationNav';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ChevronDownIcon,
    EditIcon,
    LogInIcon,
    MailIcon,
    PhoneIcon,
    SearchIcon,
    ShieldIcon,
    SlidersHorizontalIcon,
    UserPlusIcon,
    UsersIcon,
    ShieldAlertIcon,
} from 'lucide-react';
import { FormEvent, useState } from 'react';

type UserRow = {
    id: number;
    uuid: string;
    name: string;
    email: string;
    microsoft_mailbox?: string | null;
    microsoft_app_ready?: boolean;
    primary_email?: string | null;
    primary_phone?: string | null;
    job_title?: string | null;
    date_of_birth: string | null;
    preferred_language: {
        id: number;
        name: string;
        abbreviation: string;
    } | null;
    level: {
        id: number;
        uuid: string;
        name: string;
    } | null;
    created_at: string | null;
    last_login_at: string | null;
    status?: string;
    can_change_status?: boolean;
    block_history?: BlockLog[];
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
    blockLogs?: BlockLog[];
    registrationRequests?: RegistrationRequestRow[];
    registrationLevels?: { role: string; label: string }[];
};

type RegistrationRequestRow = {
    id: number;
    name: string;
    email: string;
    ip_address: string | null;
    requested_at: string | null;
    approve_url: string;
    deny_url: string;
};

function RegistrationRequests({
    requests,
    levels,
}: {
    requests: RegistrationRequestRow[];
    levels: { role: string; label: string }[];
}) {
    const [roles, setRoles] = useState<Record<number, string>>({});
    const [busy, setBusy] = useState<number | null>(null);

    const act = (request: RegistrationRequestRow, approve: boolean) => {
        setBusy(request.id);
        router.post(
            approve ? request.approve_url : request.deny_url,
            approve
                ? { role: roles[request.id], return: 'users' }
                : { return: 'users' },
            { preserveScroll: true, onFinish: () => setBusy(null) },
        );
    };

    return (
        <Card className="border-amber-300 dark:border-amber-500/40">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserPlusIcon className="size-5 text-amber-500" />
                    Sign-up requests
                    <Badge variant="secondary">{requests.length}</Badge>
                </CardTitle>
                <CardDescription>
                    Choose an access level to approve. The person gets a
                    sign-up link by email.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {requests.map((request) => (
                    <div
                        key={request.id}
                        className="flex flex-col gap-3 rounded-md border border-border p-3 lg:flex-row lg:items-center lg:justify-between"
                    >
                        <div className="min-w-0">
                            <p className="font-medium">{request.name}</p>
                            <p className="truncate text-sm text-muted-foreground">
                                {request.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {request.requested_at}
                                {request.ip_address
                                    ? ` · ${request.ip_address}`
                                    : ''}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                aria-label={`Access level for ${request.name}`}
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                                value={roles[request.id] ?? ''}
                                onChange={(event) =>
                                    setRoles({
                                        ...roles,
                                        [request.id]: event.target.value,
                                    })
                                }
                            >
                                <option value="">Select level…</option>
                                {levels.map((level) => (
                                    <option key={level.role} value={level.role}>
                                        {level.label}
                                    </option>
                                ))}
                            </select>
                            <Button
                                size="sm"
                                disabled={busy === request.id || !roles[request.id]}
                                onClick={() => act(request, true)}
                            >
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === request.id}
                                onClick={() => act(request, false)}
                            >
                                Deny
                            </Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function BlockLogTable({ logs }: { logs: BlockLog[] }) {
    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldAlertIcon className="size-5 text-red-500" />
                    Login block log
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Every time an account was blocked (failed sign-ins or by an administrator). Latest 25.
                </p>
            </CardHeader>
            <CardContent>
                {logs.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        No blocked logins yet.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left text-sm">
                            <thead className="text-xs uppercase text-muted-foreground">
                                <tr className="border-b border-border">
                                    <th className="py-2 pr-3 font-medium">Blocked at</th>
                                    <th className="py-2 pr-3 font-medium">User</th>
                                    <th className="py-2 pr-3 font-medium">Attempts</th>
                                    <th className="py-2 pr-3 font-medium">IP / device</th>
                                    <th className="py-2 pr-3 font-medium">Admin email</th>
                                    <th className="py-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id} className="border-b border-border/60 align-top last:border-0">
                                        <td className="py-3 pr-3 whitespace-nowrap">{fmt(log.blocked_at)}</td>
                                        <td className="py-3 pr-3">
                                            <p className="font-medium">{log.name}</p>
                                            <p className="text-xs text-muted-foreground">{log.email}</p>
                                            {log.reason && <p className="mt-1 max-w-[220px] text-xs italic text-muted-foreground">“{log.reason}”</p>}
                                        </td>
                                        <td className="py-3 pr-3">{log.source === 'manual' ? `Manual${log.blocked_by ? ` · ${log.blocked_by}` : ''}` : log.attempts}</td>
                                        <td className="py-3 pr-3">
                                            <p>{log.ip_address ?? '—'}</p>
                                            <p className="max-w-[220px] truncate text-xs text-muted-foreground" title={log.user_agent ?? ''}>
                                                {log.user_agent ?? ''}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-3">
                                            <Badge variant="outline" className={log.emails_sent > 0 ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300' : 'border-amber-300 text-amber-700 dark:text-amber-300'}>
                                                {log.emails_sent > 0 ? 'Sent' : 'Not sent'}
                                            </Badge>
                                        </td>
                                        <td className="py-3">
                                            {log.released_at ? (
                                                <>
                                                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                        Released
                                                    </Badge>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {fmt(log.released_at)}
                                                        <br />
                                                        {RELEASE_METHODS[log.release_method ?? ''] ?? log.release_method}
                                                        {log.released_by ? ` · ${log.released_by}` : ''}
                                                    </p>
                                                </>
                                            ) : (
                                                <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                                                    Still blocked
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

const STATUS_STYLES: Record<string, { label: string; dot: string; badge: string }> = {
    active: {
        label: 'Active',
        dot: 'bg-emerald-500',
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    },
    deactivated: {
        label: 'Deactivated',
        dot: 'bg-slate-400',
        badge: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300',
    },
    blocked: {
        label: 'Blocked',
        dot: 'bg-red-500',
        badge: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
    },
};

function UserStatusControl({
    user,
}: {
    user: { id: number; name: string; status?: string; can_change_status?: boolean };
}) {
    const [pending, setPending] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const current = user.status ?? 'active';
    const style = STATUS_STYLES[current] ?? STATUS_STYLES.active;
    const badge = (
        <Badge className={`gap-1.5 ${style.badge}`}>
            <span className={`size-1.5 rounded-full ${style.dot}`} />
            {style.label}
            {user.can_change_status ? <ChevronDownIcon className="size-3" /> : null}
        </Badge>
    );

    if (!user.can_change_status) {
        return badge;
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label={`Change status for ${user.name}`}
                    className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {badge}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuRadioGroup
                        value={current}
                        onValueChange={(status) => {
                            if (status !== current) {
                                setReason('');
                                setPending(status);
                            }
                        }}
                    >
                        {Object.entries(STATUS_STYLES).map(([value, option]) => (
                            <DropdownMenuRadioItem key={value} value={value}>
                                <span className={`size-2 rounded-full ${option.dot}`} />
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Change status to {STATUS_STYLES[pending ?? 'active']?.label}
                        </DialogTitle>
                        <DialogDescription>
                            {user.name} is now {style.label.toLowerCase()}. Tell us why you are changing it. Your name and
                            the time are saved with the reason.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2">
                        <label htmlFor={`reason-${user.id}`} className="text-sm font-medium">
                            Reason
                        </label>
                        <textarea
                            id={`reason-${user.id}`}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={3}
                            maxLength={500}
                            autoFocus
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            placeholder="Example: suspicious sign-in attempts, left the company…"
                        />
                        {error && <p className="text-xs text-destructive">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPending(null)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={saving || reason.trim().length < 3}
                            variant={pending === 'active' ? 'default' : 'destructive'}
                            onClick={() => {
                                setSaving(true);
                                router.patch(
                                    route('admin.users.status', user.id),
                                    { status: pending, reason },
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => setPending(null),
                                        onError: (errors) => setError(errors.reason ?? errors.status ?? 'Could not change the status.'),
                                        onFinish: () => setSaving(false),
                                    },
                                );
                            }}
                        >
                            Confirm change
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

const initials = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

const AVATAR_TONES = [
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
];

const avatarTone = (id: number) => AVATAR_TONES[id % AVATAR_TONES.length];

export default function Index({
    filters,
    users,
    blockLogs,
    registrationRequests = [],
    registrationLevels = [],
}: IndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreateUsers = Boolean(auth.can?.createUsers);
    const canUpdateUsers = Boolean(auth.can?.updateUsers);
    const canManageAccess = Boolean(auth.can?.manageAccess);
    const canImpersonate = Boolean(auth.can?.impersonateUsers);
    const [search, setSearch] = useState(filters.search ?? '');
    const [impersonationTarget, setImpersonationTarget] =
        useState<UserRow | null>(null);

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
                        <Button asChild variant="create">
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
                    {registrationRequests.length > 0 && (
                        <RegistrationRequests
                            requests={registrationRequests}
                            levels={registrationLevels}
                        />
                    )}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Card size="sm" className="border-l-4 border-l-emerald-500">
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

                        <Card size="sm" className="border-l-4 border-l-sky-500">
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

                        <Card size="sm" className="border-l-4 border-l-amber-500">
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
                                <Button type="submit" variant="outline" size="sm" className="self-center">
                                    <SearchIcon data-icon="inline-start" />
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="hidden grid-cols-[1.6fr_1.5fr_0.8fr_1fr_0.9fr_minmax(200px,auto)] gap-4 border-b border-border bg-muted/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
                                    <div>User</div>
                                    <div>Contact</div>
                                    <div>Level</div>
                                    <div>Status</div>
                                    <div>Last login</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {users.data.length > 0 ? (
                                    users.data.map((user) => (
                                        <div
                                            key={user.id}
                                            className="grid gap-3 border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/40 xl:grid-cols-[1.6fr_1.5fr_0.8fr_1fr_0.9fr_minmax(200px,auto)] xl:items-center xl:gap-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTone(user.id)}`}
                                                    aria-hidden="true"
                                                >
                                                    {initials(user.name)}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-foreground">
                                                        {user.name}
                                                    </p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {user.job_title ?? 'No job title'}
                                                    </p>
                                                    {user.preferred_language && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {user.preferred_language.name} ({user.preferred_language.abbreviation.toUpperCase()})
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="min-w-0 space-y-1 text-sm text-muted-foreground">
                                                <p className="flex items-center gap-1.5 truncate">
                                                    <MailIcon className="size-3.5 shrink-0" />
                                                    <span className="truncate">{user.primary_email ?? user.email}</span>
                                                </p>
                                                {user.primary_phone && (
                                                    <p className="flex items-center gap-1.5">
                                                        <PhoneIcon className="size-3.5 shrink-0" />
                                                        {user.primary_phone}
                                                    </p>
                                                )}
                                                {user.microsoft_mailbox && (
                                                    <p className="truncate text-xs">Mailbox: {user.microsoft_mailbox}</p>
                                                )}
                                            </div>
                                            <div>
                                                <DirectoryFieldLabel hideFrom="xl">Level</DirectoryFieldLabel>
                                                <Badge variant="outline">{user.level?.name ?? 'No level'}</Badge>
                                            </div>
                                            <div className="flex flex-col items-start gap-1">
                                                <DirectoryFieldLabel hideFrom="xl">Status</DirectoryFieldLabel>
                                                <UserStatusControl user={user} />
                                                {canUpdateUsers && (
                                                    <BlockHistoryButton name={user.name} logs={user.block_history ?? []} />
                                                )}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                <DirectoryFieldLabel hideFrom="xl">Last login</DirectoryFieldLabel>
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
                                                                    href={`${route('admin.access-control.edit')}?level=${user.level.uuid}`}
                                                                    aria-label="Edit permissions"
                                                                >
                                                                    <SlidersHorizontalIcon className="size-4" />
                                                                </Link>
                                                            </Button>
                                                        </ActionHint>
                                                    )}

                                                {canImpersonate &&
                                                    user.id !== auth.user.id && (
                                                        <ActionHint hint="Sign in as this user">
                                                            <Button
                                                                variant="outline"
                                                                size="icon-sm"
                                                                className="border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-800 dark:border-sky-800/60 dark:text-sky-300 dark:hover:bg-sky-950/40"
                                                                aria-label={`Sign in as ${user.name}`}
                                                                onClick={() =>
                                                                    setImpersonationTarget(
                                                                        user,
                                                                    )
                                                                }
                                                            >
                                                                <LogInIcon className="size-4" />
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
                                                                    user.uuid,
                                                                )}
                                                                aria-label="Edit this user"
                                                            >
                                                                <EditIcon className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </ActionHint>
                                                )}

                                                {!canManageAccess &&
                                                    !canUpdateUsers &&
                                                    !(
                                                        canImpersonate &&
                                                        user.id !== auth.user.id
                                                    ) && (
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

                    {canUpdateUsers && blockLogs && <BlockLogTable logs={blockLogs} />}
                </div>
            </div>

            <AlertDialog
                open={impersonationTarget !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setImpersonationTarget(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Sign in as {impersonationTarget?.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            You will use the site as {impersonationTarget?.name}
                            {impersonationTarget?.email
                                ? ` (${impersonationTarget.email})`
                                : ''}
                            . A bar at the top lets you return to your master
                            account at any time.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            onClick={() => {
                                if (!impersonationTarget) {
                                    return;
                                }

                                router.post(
                                    route(
                                        'admin.users.impersonate',
                                        impersonationTarget.uuid,
                                    ),
                                );
                            }}
                        >
                            Sign in as this user
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
