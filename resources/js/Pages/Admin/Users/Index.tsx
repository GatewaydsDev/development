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
    ArchiveIcon,
    ArchiveRestoreIcon,
    BriefcaseBusinessIcon,
    ChevronDownIcon,
    CircleHelpIcon,
    CrownIcon,
    EditIcon,
    EyeIcon,
    BuildingIcon,
    HardHatIcon,
    LogInIcon,
    MailIcon,
    MonitorIcon,
    SmartphoneIcon,
    TabletIcon,
    PhoneIcon,
    SearchIcon,
    ShieldIcon,
    SlidersHorizontalIcon,
    UserPlusIcon,
    UsersIcon,
    ShieldAlertIcon,
    ShieldCheckIcon,
    UserRoundIcon,
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
    last_login_device?: 'website' | 'mobile' | 'tablet' | null;
    status?: string;
    can_change_status?: boolean;
    can_archive?: boolean;
    archived?: boolean;
    block_history?: BlockLog[];
    client_role?: 'master' | 'manager' | 'viewer';
    company_name?: string | null;
};

type ClientGroup = { uuid: string; name: string; members: UserRow[] };

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

type BlockLogRow = BlockLog & { user_status?: string | null; can_change_status?: boolean };

type IndexProps = {
    clientGroups?: ClientGroup[];
    canArchiveUsers?: boolean;
    filters: {
        search?: string;
        archived?: boolean;
    };
    users: UsersPaginator;
    blockLogs?: BlockLogRow[];
    registrationRequests?: RegistrationRequestRow[];
    registrationLevels?: { role: string; label: string }[];
};

type RegistrationRequestRow = {
    id: number;
    name: string;
    email: string;
    status: string;
    level: string | null;
    role: string | null;
    ip_address: string | null;
    requested_at: string | null;
    approve_url: string;
    deny_url: string;
    reopen_url: string;
};

const REQUEST_STATUS: Record<string, { label: string; dot: string; badge: string }> = {
    pending: {
        label: 'Pending',
        dot: 'bg-amber-500',
        badge: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    },
    approved: {
        label: 'Approved',
        dot: 'bg-emerald-500',
        badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
    denied: {
        label: 'Denied',
        dot: 'bg-red-500',
        badge: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    },
    expired: {
        label: 'Link expired',
        dot: 'bg-slate-400',
        badge: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    },
};

function RegistrationStatusControl({
    request,
    levels,
}: {
    request: RegistrationRequestRow;
    levels: { role: string; label: string }[];
}) {
    const [approving, setApproving] = useState<RegistrationRequestRow | null>(null);
    const [role, setRole] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const style = REQUEST_STATUS[request.status] ?? REQUEST_STATUS.pending;

    const post = (url: string, data: Record<string, string>, onSuccess?: () => void) => {
        setBusy(true);
        router.post(
            url,
            { ...data, return: 'users' },
            {
                preserveScroll: true,
                onSuccess,
                onError: (errors) => setError(errors.role ?? 'Could not complete this action.'),
                onFinish: () => setBusy(false),
            },
        );
    };

    const change = (status: string) => {
        if (status === 'approved') {
            setRole(request.role ?? '');
            setError('');
            setApproving(request);
        } else if (status === 'denied') {
            post(request.deny_url, {});
        } else if (status === 'pending') {
            post(request.reopen_url, {});
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    disabled={busy}
                    aria-label={`Change status for ${request.name}`}
                    className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Badge className={`h-6 gap-1.5 px-2.5 text-xs font-semibold ${style.badge}`}>
                        <span className={`size-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                        <ChevronDownIcon className="size-3" />
                    </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuRadioGroup value={request.status} onValueChange={change}>
                        {['pending', 'approved', 'denied'].map((value) => (
                            <DropdownMenuRadioItem key={value} value={value}>
                                <span className={`size-2 rounded-full ${REQUEST_STATUS[value].dot}`} />
                                {REQUEST_STATUS[value].label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={approving !== null} onOpenChange={(open) => !open && setApproving(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Approve {approving?.name}</DialogTitle>
                        <DialogDescription>
                            Choose the access level. A sign-up link will be emailed to {approving?.email}.
                        </DialogDescription>
                    </DialogHeader>
                    <select
                        aria-label="Access level"
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={role}
                        onChange={(event) => setRole(event.target.value)}
                    >
                        <option value="">Select level…</option>
                        {levels.map((level) => (
                            <option key={level.role} value={level.role}>
                                {level.label}
                            </option>
                        ))}
                    </select>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApproving(null)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={busy || !role}
                            onClick={() =>
                                approving && post(approving.approve_url, { role }, () => setApproving(null))
                            }
                        >
                            Approve and send email
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function NotifyUserButton({ log }: { log: BlockLogRow }) {
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [email, setEmail] = useState(log.email);
    const [error, setError] = useState<string | null>(null);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
    const sent = log.emails_sent > 0;
    const badge = (
        <Badge
            variant="outline"
            className={sent ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300' : 'border-amber-300 text-amber-700 dark:text-amber-300'}
        >
            {sent ? 'Sent' : 'Not sent'}
            {log.can_change_status ? <MailIcon className="ml-1 size-3" /> : null}
        </Badge>
    );

    if (!log.can_change_status) {
        return badge;
    }

    return (
        <>
            <button
                type="button"
                aria-label={`Send email to ${log.name}`}
                className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                    setEmail(log.email);
                    setError(null);
                    setOpen(true);
                }}
            >
                {badge}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Email {log.name}</DialogTitle>
                        <DialogDescription>
                            Send an email about their current account status
                            {log.user_status ? ` (${log.user_status})` : ''}. If the account is active, the email
                            tells them they can sign in.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <label htmlFor={`notify-email-${log.id}`} className="text-sm font-medium">Send to</label>
                        <input
                            className="h-10 w-full rounded-md border border-border bg-background px-3 text-base md:text-sm"
                            id={`notify-email-${log.id}`}
                            type="email"
                            value={email}
                            onChange={(event) => {
                                setEmail(event.target.value);
                                setError(null);
                            }}
                            aria-invalid={email.trim() !== '' && !emailValid}
                            placeholder={log.email}
                        />
                        <p className="text-xs text-muted-foreground">
                            Defaults to {log.email}. Enter a different address to send it there instead.
                        </p>
                        {email.trim() !== '' && !emailValid ? (
                            <p className="text-sm text-red-600 dark:text-red-400">Enter a valid email address, like name@example.com.</p>
                        ) : error ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={sending || !emailValid}
                            onClick={() => {
                                setSending(true);
                                setError(null);
                                router.post(
                                    route('admin.users.block-logs.notify', log.id),
                                    { email: email.trim() },
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => setOpen(false),
                                        onError: (errors) => setError(errors.email ?? 'Could not send the email.'),
                                        onFinish: () => setSending(false),
                                    },
                                );
                            }}
                        >
                            Send email
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function BlockLogTable({
    logs,
    requests,
    levels,
}: {
    logs: BlockLogRow[];
    requests: RegistrationRequestRow[];
    levels: { role: string; label: string }[];
}) {
    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldAlertIcon className="size-5 text-red-500" />
                    Login block log
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Sign-up requests from people who want access, and every time an account was blocked (failed sign-ins or by an administrator). Latest 25 blocks.
                </p>
            </CardHeader>
            <CardContent>
                {logs.length === 0 && requests.length === 0 ? (
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
                                {requests.map((request) => (
                                    <tr key={`request-${request.id}`} className="border-b border-border/60 align-top">
                                        <td className="py-3 pr-3 whitespace-nowrap">{request.requested_at}</td>
                                        <td className="py-3 pr-3">
                                            <p className="font-medium">{request.name}</p>
                                            <p className="text-xs text-muted-foreground">{request.email}</p>
                                        </td>
                                        <td className="py-3 pr-3">Sign-up request</td>
                                        <td className="py-3 pr-3">{request.ip_address ?? '—'}</td>
                                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                                            {request.level ? `Level: ${request.level}` : '—'}
                                        </td>
                                        <td className="py-3">
                                            <RegistrationStatusControl request={request} levels={levels} />
                                        </td>
                                    </tr>
                                ))}
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
                                            <NotifyUserButton log={log} />
                                        </td>
                                        <td className="py-3">
                                            <UserStatusControl
                                                user={{
                                                    id: log.user_id,
                                                    name: log.name,
                                                    status: log.user_status ?? (log.released_at ? 'active' : log.kind),
                                                    can_change_status: log.can_change_status,
                                                }}
                                            />
                                            {log.released_at && (
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Released {fmt(log.released_at)}
                                                    <br />
                                                    {RELEASE_METHODS[log.release_method ?? ''] ?? log.release_method}
                                                    {log.released_by ? ` · ${log.released_by}` : ''}
                                                </p>
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
        badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
    deactivated: {
        label: 'Deactivated',
        dot: 'bg-slate-400',
        badge: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    },
    blocked: {
        label: 'Blocked',
        dot: 'bg-red-500',
        badge: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
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
    const [notifyUser, setNotifyUser] = useState(true);
    const current = user.status ?? 'active';
    const style = STATUS_STYLES[current] ?? STATUS_STYLES.active;
    const badge = (
        <Badge className={`h-6 gap-1.5 px-2.5 text-xs font-semibold ${style.badge}`}>
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
                                setError('');
                                setNotifyUser(true);
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
                            {user.name} is currently {style.label.toLowerCase()}. Tell us why you are changing it. Your name and
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
                        <label className="mt-1 flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={notifyUser}
                                onChange={(event) => setNotifyUser(event.target.checked)}
                            />
                            {pending === 'active'
                                ? 'Email the user that they can sign in again'
                                : 'Email the user about this change'}
                        </label>
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
                                    { status: pending, reason, notify_user: notifyUser },
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

function UserLevelBadge({ name }: { name?: string | null }) {
    const normalized = name?.trim().toLowerCase() ?? '';
    let Icon = CircleHelpIcon;
    let tone =
        'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300';

    if (['super admin', 'superadmin', 'super-admin'].includes(normalized)) {
        Icon = CrownIcon;
        tone =
            'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
    } else if (normalized === 'administrator') {
        Icon = ShieldCheckIcon;
        tone =
            'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-300';
    } else if (normalized === 'admin') {
        Icon = ShieldIcon;
        tone =
            'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
    } else if (normalized === 'project manager') {
        Icon = BriefcaseBusinessIcon;
        tone =
            'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300';
    } else if (normalized === 'foreman') {
        Icon = HardHatIcon;
        tone =
            'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-300';
    } else if (normalized === 'employee') {
        Icon = UserRoundIcon;
        tone =
            'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
    } else if (normalized === 'client manager') {
        Icon = BuildingIcon;
        tone =
            'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300';
    } else if (normalized === 'client') {
        Icon = BuildingIcon;
        tone =
            'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-300';
    } else if (normalized === 'visitor') {
        Icon = EyeIcon;
    } else if (normalized === 'user') {
        Icon = UserRoundIcon;
    }

    return (
        <Badge variant="outline" className={`gap-1.5 font-semibold ${tone}`}>
            <Icon className="size-3.5" />
            {name ?? 'No level'}
        </Badge>
    );
}

const loginDevices = {
    website: { label: 'Website', Icon: MonitorIcon },
    mobile: { label: 'Mobile', Icon: SmartphoneIcon },
    tablet: { label: 'Tablet', Icon: TabletIcon },
} as const;

function LoginDeviceBadge({ device }: { device?: UserRow['last_login_device'] }) {
    if (!device) {
        return <span className="text-sm text-muted-foreground">—</span>;
    }

    const { label, Icon } = loginDevices[device];

    return (
        <Badge variant="outline" className="gap-1.5">
            <Icon className="size-3.5" />
            {label}
        </Badge>
    );
}

export default function Index({
    filters,
    canArchiveUsers,
    users,
    clientGroups = [],
    blockLogs,
    registrationRequests = [],
    registrationLevels = [],
}: IndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreateUsers = Boolean(auth.can?.createUsers);
    const canUpdateUsers = Boolean(auth.can?.updateUsers);
    const canManageAccess = Boolean(auth.can?.manageAccess);
    const canImpersonate = Boolean(auth.can?.impersonateUsers);
    const isSuperAdminUser = Boolean(canArchiveUsers);
    const [search, setSearch] = useState(filters.search ?? '');
    const [openGroups, setOpenGroups] = useState<string[]>([]);
    const [archiveTarget, setArchiveTarget] = useState<UserRow | null>(null);
    const [impersonationTarget, setImpersonationTarget] =
        useState<UserRow | null>(null);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.users.index'),
            { search, ...(filters.archived ? { archived: 1 } : {}) },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const renderUser = (user: UserRow) => (
                                        <div
                                            key={user.id}
                                            className="grid gap-3 border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/40 xl:grid-cols-[1.6fr_1.5fr_1.1fr_0.8fr_1fr_0.9fr_0.8fr_minmax(200px,auto)] xl:items-center xl:gap-4"
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
                                            <div className="min-w-0 text-sm text-muted-foreground">
                                                <DirectoryFieldLabel hideFrom="xl">Company</DirectoryFieldLabel>
                                                <span className="block truncate text-foreground">{user.company_name ?? '—'}</span>
                                            </div>
                                            <div>
                                                <DirectoryFieldLabel hideFrom="xl">Level</DirectoryFieldLabel>
                                                <div className="flex flex-wrap gap-1">
<UserLevelBadge name={user.level?.name} />
{user.client_role === 'master' && <Badge>Master</Badge>}
</div>
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
                                            <div>
                                                <DirectoryFieldLabel hideFrom="xl">Login type</DirectoryFieldLabel>
                                                <LoginDeviceBadge device={user.last_login_device} />
                                            </div>
                                            <div className="flex min-w-0 flex-col gap-1 md:items-end">
                                                <DirectoryFieldLabel hideFrom="xl">
                                                    Actions
                                                </DirectoryFieldLabel>
                                                <div className="flex flex-wrap gap-1.5 md:justify-end">
                                                {user.archived && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => router.patch(route('admin.users.restore', user.uuid), {}, { preserveScroll: true })}
                                                    >
                                                        <ArchiveRestoreIcon data-icon="inline-start" />
                                                        Restore
                                                    </Button>
                                                )}

                                                {!user.archived && canManageAccess &&
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

                                                {!user.archived && canImpersonate &&
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

                                                {!user.archived && canUpdateUsers && (
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

                                                {user.can_archive && (
                                                    <ActionHint hint="Archive this user">
                                                        <Button
                                                            variant="outline"
                                                            size="icon-sm"
                                                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-950/40"
                                                            aria-label={`Archive ${user.name}`}
                                                            onClick={() => setArchiveTarget(user)}
                                                        >
                                                            <ArchiveIcon className="size-4" />
                                                        </Button>
                                                    </ActionHint>
                                                )}

                                                {!user.archived && !canManageAccess &&
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
    );

    const toggleGroup = (uuid: string) =>
        setOpenGroups((current) =>
            current.includes(uuid) ? current.filter((id) => id !== uuid) : [...current, uuid],
        );

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
                <div className="flex w-full flex-col gap-6 px-4 sm:px-6 lg:px-8">
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
                                {isSuperAdminUser && (
                                    <Button
                                        type="button"
                                        variant={filters.archived ? 'default' : 'outline'}
                                        size="sm"
                                        className="self-center"
                                        onClick={() =>
                                            router.get(
                                                route('admin.users.index'),
                                                filters.archived ? {} : { archived: 1 },
                                            )
                                        }
                                    >
                                        <ArchiveIcon data-icon="inline-start" />
                                        {filters.archived ? 'Show active users' : 'Archived users'}
                                    </Button>
                                )}
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="hidden grid-cols-[1.6fr_1.5fr_1.1fr_0.8fr_1fr_0.9fr_0.8fr_minmax(200px,auto)] gap-4 border-b border-border bg-muted/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
                                    <div>User</div>
                                    <div>Contact</div>
                                    <div>Company</div>
                                    <div>Level</div>
                                    <div>Status</div>
                                    <div>Last login</div>
                                    <div>Login type</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {clientGroups.map((group) => {
                                    const open = openGroups.includes(group.uuid) || search.trim() !== '';
                                    const master = group.members.find((member) => member.client_role === 'master');

                                    return (
                                        <div key={group.uuid} className="border-b border-border">
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(group.uuid)}
                                                aria-expanded={open}
                                                className="flex w-full items-center justify-between gap-3 bg-muted/30 px-4 py-4 text-left transition-colors hover:bg-muted/50"
                                            >
                                                <span className="flex min-w-0 items-center gap-3">
                                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                        <BuildingIcon className="size-5" />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-semibold text-foreground">{group.name}</span>
                                                        <span className="block truncate text-xs text-muted-foreground">
                                                            Client company · {group.members.length} user{group.members.length === 1 ? '' : 's'}
                                                            {master ? ` · Master: ${master.name}` : ''}
                                                        </span>
                                                    </span>
                                                </span>
                                                <ChevronDownIcon className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                                            </button>
                                            {open && (
                                                <div className="ml-6 border-l-2 border-emerald-200 dark:border-emerald-900">
                                                    {group.members.map((member) => renderUser(member))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {users.data.length > 0 ? (
                                    users.data.map((user) => renderUser(user))
                                ) : clientGroups.length === 0 ? (
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
                                ) : null}
                            </div>

                            <PaginationNav
                                paginator={users}
                                itemLabel="users"
                            />
                        </CardContent>
                    </Card>

                    {canUpdateUsers && blockLogs && (
                        <BlockLogTable
                            logs={blockLogs}
                            requests={registrationRequests}
                            levels={registrationLevels}
                        />
                    )}
                </div>
            </div>

            <AlertDialog
                open={archiveTarget !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setArchiveTarget(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This user can no longer sign in and disappears from the lists. Their
                            emails and phone numbers are archived with them, and any employee record is set to inactive.
                            Nothing is permanently deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={() => {
                                if (archiveTarget) {
                                    router.delete(route('admin.users.destroy', archiveTarget.uuid), {
                                        preserveScroll: true,
                                    });
                                }
                            }}
                        >
                            Archive user
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
