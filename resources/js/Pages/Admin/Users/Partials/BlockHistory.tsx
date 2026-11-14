import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import {
    CheckCircle2Icon,
    HandIcon,
    HistoryIcon,
    LockIcon,
    MailCheckIcon,
    MailXIcon,
    ShieldAlertIcon,
    UserXIcon,
} from 'lucide-react';
import { useState } from 'react';

export type BlockLog = {
    id: number;
    user_id: number;
    name: string;
    email: string;
    kind: string;
    source: string;
    blocked_by: string | null;
    reason: string | null;
    release_reason: string | null;
    attempts: number;
    ip_address: string | null;
    user_agent: string | null;
    emails_sent: number;
    blocked_at: string | null;
    released_at: string | null;
    released_by: string | null;
    release_method: string | null;
};

export const RELEASE_METHODS: Record<string, string> = {
    email_link: 'Email link',
    dashboard: 'Review page',
    user_management: 'User management',
    status_change: 'Status changed',
    login: 'Login',
};

export const fmt = (value: string | null) =>
    value ? new Date(value).toLocaleString() : '—';

const kindLabel = (log: BlockLog) =>
    log.kind === 'deactivated' ? 'Deactivated' : 'Blocked';

function Entry({ log }: { log: BlockLog }) {
    const manual = log.source === 'manual';
    const red = log.kind !== 'deactivated';

    return (
        <li className="relative pl-9">
            <span
                className={`absolute left-0 top-0 flex size-7 items-center justify-center rounded-full ${
                    red
                        ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300'
                }`}
            >
                {manual ? <HandIcon className="size-3.5" /> : <LockIcon className="size-3.5" />}
            </span>

            <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{kindLabel(log)}</p>
                        <Badge variant="outline" className="text-[10px]">
                            {manual
                                ? `Manual${log.blocked_by ? ` · ${log.blocked_by}` : ''}`
                                : `${log.attempts} failed attempts`}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmt(log.blocked_at)}</p>
                </div>

                {manual && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        Changed by <span className="font-medium text-foreground">{log.blocked_by ?? 'Unknown'}</span> on{' '}
                        {fmt(log.blocked_at)}
                    </p>
                )}

                {log.reason && (
                    <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
                        <span className="font-semibold">Reason: </span>
                        {log.reason}
                    </p>
                )}

                {!manual && (
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>IP: {log.ip_address ?? '—'}</span>
                        <span className="truncate" title={log.user_agent ?? ''}>
                            Device: {log.user_agent ?? '—'}
                        </span>
                        <span className="flex items-center gap-1">
                            {log.emails_sent > 0 ? (
                                <MailCheckIcon className="size-3.5 text-emerald-500" />
                            ) : (
                                <MailXIcon className="size-3.5 text-amber-500" />
                            )}
                            Admin email {log.emails_sent > 0 ? 'sent' : 'not sent'}
                        </span>
                    </div>
                )}

                <div className="mt-3 border-t border-border pt-2 text-xs">
                    {log.released_at ? (
                        <>
                            <p className="flex flex-wrap items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2Icon className="size-3.5" />
                                <span className="font-medium">Released {fmt(log.released_at)}</span>
                                <span className="text-muted-foreground">
                                    · {RELEASE_METHODS[log.release_method ?? ''] ?? log.release_method}
                                    {log.released_by ? ` · ${log.released_by}` : ''}
                                </span>
                            </p>
                            {log.release_reason && (
                                <p className="mt-1.5 rounded-md bg-muted px-2.5 py-1.5">
                                    <span className="font-semibold">Reason: </span>
                                    {log.release_reason}
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-300">
                            <UserXIcon className="size-3.5" />
                            Still {kindLabel(log).toLowerCase()}
                        </p>
                    )}
                </div>
            </div>
        </li>
    );
}

export function BlockHistoryButton({ name, logs }: { name: string; logs: BlockLog[] }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-6 gap-1 px-1.5 text-xs text-muted-foreground"
                onClick={() => setOpen(true)}
                aria-label={`Block history for ${name}`}
            >
                <HistoryIcon className="size-3" />
                History{logs.length > 0 ? ` (${logs.length})` : ''}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShieldAlertIcon className="size-5 text-red-500" />
                            Block history
                        </DialogTitle>
                        <DialogDescription>{name}</DialogDescription>
                    </DialogHeader>

                    {logs.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            This user has never been blocked or deactivated.
                        </p>
                    ) : (
                        <ol className="relative flex flex-col gap-3 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-border">
                            {logs.map((log) => (
                                <Entry key={log.id} log={log} />
                            ))}
                        </ol>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
