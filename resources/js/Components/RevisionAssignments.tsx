import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { getEcho, isEchoConnected } from '@/lib/echo';
import { cn } from '@/lib/utils';
import { PageProps, RevisionAssignment } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import {
    BellRingIcon,
    CheckIcon,
    ClipboardCheckIcon,
    XIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type Response = 'accepted' | 'declined';

const notificationsSupported = () =>
    typeof window !== 'undefined' && 'Notification' in window;

function revisionLabel(assignment: RevisionAssignment): string {
    return assignment.title
        ? `Revision ${assignment.number} · ${assignment.title}`
        : `Revision ${assignment.number}`;
}

function quotationLabel(assignment: RevisionAssignment): string {
    const quotation = assignment.quotation;

    if (!quotation) {
        return 'Quotation';
    }

    return [quotation.number && `Quotation ${quotation.number}`, quotation.title]
        .filter(Boolean)
        .join(' — ');
}

function timeAgo(value: string | null): string {
    if (!value) {
        return '';
    }

    const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
    const formatter = new Intl.RelativeTimeFormat(undefined, {
        numeric: 'auto',
    });

    if (seconds < 60) {
        return formatter.format(-seconds, 'second');
    }

    if (seconds < 3600) {
        return formatter.format(-Math.round(seconds / 60), 'minute');
    }

    if (seconds < 86400) {
        return formatter.format(-Math.round(seconds / 3600), 'hour');
    }

    return formatter.format(-Math.round(seconds / 86400), 'day');
}

export function respondToRevision(
    assignment: RevisionAssignment,
    response: Response,
    options: { onFinish?: () => void } = {},
) {
    router.post(
        route('admin.quotation-revisions.respond', assignment.uuid),
        { response },
        {
            preserveScroll: true,
            preserveState: true,
            onFinish: options.onFinish,
            onError: () =>
                toast.error(
                    `Could not ${response === 'accepted' ? 'accept' : 'decline'} the revision.`,
                ),
        },
    );
}

function showDesktopNotification(
    title: string,
    body: string,
    tag: string,
    url?: string,
) {
    if (!notificationsSupported() || Notification.permission !== 'granted') {
        return;
    }

    try {
        // The tag lets the OS collapse duplicates when several tabs are open.
        const notification = new Notification(title, {
            body,
            tag,
            icon: '/favicon.ico',
        });

        notification.onclick = () => {
            window.focus();

            if (url) {
                router.visit(url);
            }

            notification.close();
        };
    } catch {
        // Some browsers only allow notifications from a service worker.
    }
}

const fallbackPollInterval = 15_000;

function refreshAssignments() {
    router.reload({
        only: ['auth'],
        showProgress: false,
        async: true,
    } as never);
}

function announceAssignment(assignment: RevisionAssignment) {
    const title = 'New revision assigned to you';
    const description = `${revisionLabel(assignment)} — ${quotationLabel(assignment)}${
        assignment.assigned_by ? ` (from ${assignment.assigned_by})` : ''
    }`;

    showDesktopNotification(
        title,
        description,
        `revision-assigned-${assignment.uuid}`,
        assignment.quotation?.url,
    );

    toast(title, {
        id: `revision-assigned-${assignment.uuid}`,
        description,
        duration: 30_000,
        icon: <ClipboardCheckIcon className="size-4" />,
        action: assignment.quotation
            ? {
                  label: 'Review quote',
                  onClick: () => router.visit(assignment.quotation!.url),
              }
            : undefined,
    });
}

/**
 * Keeps the signed-in user's revision assignments live in every open tab.
 * Reverb pushes changes instantly; while the socket is unavailable the tab
 * falls back to a light background refresh so updates still arrive.
 */
export function RevisionAssignmentListener({ userId }: { userId: number }) {
    const { auth, realtime } = usePage<PageProps>().props;
    const items = auth.revisionAssignments?.items;
    const announced = useRef<Set<string> | null>(null);

    useEffect(() => {
        const current = items ?? [];

        // Existing assignments at page load show in the menu without a popup.
        if (announced.current === null) {
            announced.current = new Set(current.map((item) => item.uuid));

            return;
        }

        current.forEach((assignment) => {
            if (!announced.current!.has(assignment.uuid)) {
                announced.current!.add(assignment.uuid);
                announceAssignment(assignment);
            }
        });
    }, [items]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible' && !isEchoConnected()) {
                refreshAssignments();
            }
        }, fallbackPollInterval);
        const refreshOnFocus = () => {
            if (document.visibilityState === 'visible' && !isEchoConnected()) {
                refreshAssignments();
            }
        };

        document.addEventListener('visibilitychange', refreshOnFocus);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', refreshOnFocus);
        };
    }, []);

    const realtimeKey = realtime?.key;

    useEffect(() => {
        const echo = getEcho(realtime);

        if (!echo || !userId) {
            return;
        }

        const channelName = `App.Models.User.${userId}`;
        const channel = echo.private(channelName);

        channel.listen(
            '.quotation-revision.assigned',
            (assignment: RevisionAssignment) => {
                announced.current?.add(assignment.uuid);
                announceAssignment(assignment);
                refreshAssignments();
            },
        );

        channel.listen(
            '.quotation-revision.responded',
            (assignment: RevisionAssignment) => {
                const accepted = assignment.response === 'accepted';
                const title = `${assignment.responsible ?? 'The responsible user'} ${
                    accepted ? 'accepted' : 'declined'
                } a revision`;
                const description = `${revisionLabel(assignment)} — ${quotationLabel(assignment)}`;

                showDesktopNotification(
                    title,
                    description,
                    `revision-responded-${assignment.uuid}`,
                    assignment.quotation?.url,
                );

                (accepted ? toast.success : toast.warning)(title, {
                    id: `revision-responded-${assignment.uuid}`,
                    description,
                    duration: 15_000,
                    action: assignment.quotation
                        ? {
                              label: 'Open',
                              onClick: () =>
                                  router.visit(assignment.quotation!.url),
                          }
                        : undefined,
                });
            },
        );

        return () => {
            channel.stopListening('.quotation-revision.assigned');
            channel.stopListening('.quotation-revision.responded');
            echo.leave(channelName);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, realtimeKey]);

    return null;
}

export function RevisionAssignmentsMenu({ className }: { className?: string }) {
    const { auth } = usePage<PageProps>().props;
    const assignments = auth.revisionAssignments ?? { count: 0, items: [] };
    const hasPending = assignments.count > 0;
    const [permission, setPermission] = useState<NotificationPermission | null>(
        () => (notificationsSupported() ? Notification.permission : null),
    );
    const [shake, setShake] = useState(false);
    const previousCount = useRef(assignments.count);

    useEffect(() => {
        if (assignments.count > previousCount.current) {
            setShake(true);
            const timeout = window.setTimeout(() => setShake(false), 1400);
            previousCount.current = assignments.count;

            return () => window.clearTimeout(timeout);
        }

        previousCount.current = assignments.count;
    }, [assignments.count]);

    const enableDesktopAlerts = async () => {
        if (!notificationsSupported()) {
            return;
        }

        setPermission(await Notification.requestPermission());
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'relative inline-flex size-9 items-center justify-center rounded-md border bg-background transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                        hasPending
                            ? 'border-destructive/50 text-destructive shadow-sm shadow-destructive/20'
                            : 'border-border text-muted-foreground',
                        shake && 'animate-bell-shake',
                        className,
                    )}
                    aria-label={
                        hasPending
                            ? `${assignments.count} revisions waiting for your review`
                            : 'Revision assignments'
                    }
                >
                    <ClipboardCheckIcon
                        className={cn(
                            'size-4',
                            hasPending && !shake && 'animate-bell-ring-loop',
                        )}
                    />
                    {hasPending && (
                        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[0.65rem] font-semibold leading-5 text-white ring-2 ring-background">
                            {assignments.count}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-[min(22rem,calc(100vw-2rem))]"
            >
                <DropdownMenuLabel className="flex items-center justify-between gap-3">
                    Revisions assigned to you
                    {hasPending && (
                        <Badge variant="destructive">
                            {assignments.count} waiting
                        </Badge>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {assignments.items.length > 0 ? (
                    <DropdownMenuGroup className="max-h-[22rem] overflow-y-auto">
                        {assignments.items.map((assignment) => (
                            <DropdownMenuItem
                                key={assignment.uuid}
                                asChild
                                className="items-start"
                            >
                                <Link
                                    href={
                                        assignment.quotation?.url ??
                                        route('admin.quotations.index')
                                    }
                                    className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left"
                                >
                                    <ClipboardCheckIcon className="mt-0.5 size-4 text-muted-foreground" />
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="truncate font-medium text-foreground">
                                            {revisionLabel(assignment)}
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {quotationLabel(assignment)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {[
                                                assignment.assigned_by &&
                                                    `From ${assignment.assigned_by}`,
                                                timeAgo(assignment.assigned_at),
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                        <span className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                            Open quote to review
                                        </span>
                                    </span>
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuGroup>
                ) : (
                    <p className="px-2 py-4 text-sm text-muted-foreground">
                        No revisions are waiting for you.
                    </p>
                )}
                {permission === 'default' && (
                    <>
                        <DropdownMenuSeparator />
                        <button
                            type="button"
                            onClick={enableDesktopAlerts}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs font-medium text-primary hover:bg-muted"
                        >
                            <BellRingIcon className="size-3.5" />
                            Turn on desktop alerts for new assignments
                        </button>
                    </>
                )}
                {permission === 'denied' && (
                    <>
                        <DropdownMenuSeparator />
                        <p className="px-2 py-2 text-xs text-muted-foreground">
                            Desktop alerts are blocked in this browser. Allow
                            notifications for this site to get them.
                        </p>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Shown on the quotation page so the responsible user reviews the quote
 * before accepting or declining the revision assigned to them.
 */
export function RevisionReviewPanel({
    assignments,
}: {
    assignments: RevisionAssignment[];
}) {
    const [pendingUuid, setPendingUuid] = useState<string | null>(null);

    if (assignments.length === 0) {
        return null;
    }

    const respond = (assignment: RevisionAssignment, response: Response) => {
        setPendingUuid(assignment.uuid);
        respondToRevision(assignment, response, {
            onFinish: () => setPendingUuid(null),
        });
    };

    return (
        <section
            aria-label="Revisions waiting for your review"
            className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 shadow-sm sm:p-5"
        >
            <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                    <ClipboardCheckIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground">
                        {assignments.length === 1
                            ? 'A revision is waiting for your review'
                            : `${assignments.length} revisions are waiting for your review`}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Review the quotation below, then accept or decline.
                    </p>
                </div>
            </div>
            <ul className="mt-4 flex flex-col gap-3">
                {assignments.map((assignment) => (
                    <li
                        key={assignment.uuid}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="min-w-0">
                            <p className="font-medium text-foreground">
                                {revisionLabel(assignment)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {[
                                    assignment.status &&
                                        `Status: ${assignment.status}`,
                                    assignment.assigned_by &&
                                        `Assigned by ${assignment.assigned_by}`,
                                    timeAgo(assignment.assigned_at),
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </p>
                            {assignment.notes && (
                                <p className="mt-1 text-sm text-foreground/80">
                                    {assignment.notes}
                                </p>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={pendingUuid === assignment.uuid}
                                onClick={() => respond(assignment, 'declined')}
                            >
                                <XIcon className="size-4" />
                                Decline
                            </Button>
                            <Button
                                type="button"
                                disabled={pendingUuid === assignment.uuid}
                                onClick={() => respond(assignment, 'accepted')}
                            >
                                <CheckIcon className="size-4" />
                                Accept
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
