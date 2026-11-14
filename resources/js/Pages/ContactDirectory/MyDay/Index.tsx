import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router, usePage } from '@inertiajs/react';
import CreateContactButton from '@/Components/ContactDirectory/CreateContactButton';
import CreateFollowUpButton, { type FollowUpContact, type FollowUpUser } from '@/Components/ContactDirectory/CreateFollowUpButton';
import InputError from '@/Components/InputError';
import { useState } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';
import {
    AlarmClockIcon,
    CalendarCheckIcon,
    CalendarClockIcon,
    CheckCircle2Icon,
    HourglassIcon,
    InfoIcon,
    MessageSquareMoreIcon,
    ShieldAlertIcon,
    TruckIcon,
    UsersIcon,
} from 'lucide-react';

type FollowUp = {
    id: number;
    uuid: string;
    title: string;
    description: string | null;
    due_at: string;
    reminder_at: string | null;
    priority: string;
    status: string;
    snoozed_until: string | null;
    contact?: { id: number; uuid: string; first_name: string; last_name: string | null } | null;
    inquiry?: { id: number; uuid: string; title: string } | null;
    assigned_user?: { id: number; name: string } | null;
};

type Inquiry = {
    id: number;
    uuid: string;
    title: string;
    status: string;
    waiting_on: string | null;
    waiting_since: string | null;
    expected_response_date: string | null;
    contact?: { id: number; uuid: string; first_name: string; last_name: string | null } | null;
    current_quote?: {
        id: number;
        revision_number: number;
        currency: string;
        grand_total: string;
    } | null;
    assigned_user?: { id: number; name: string } | null;
};

type ExpiringQuote = {
    id: number;
    uuid: string;
    revision_number: number;
    currency: string;
    grand_total: string;
    expires_at: string;
    inquiry?: { id: number; uuid: string; title: string; contact?: { first_name: string; last_name: string | null } | null } | null;
};

type Suggestion = {
    inquiry_id: number;
    reason: string;
    action: string;
    severity: 'warning' | 'error';
};

type MyDayProps = PageProps<{
    contacts: FollowUpContact[];
    users: FollowUpUser[];
    timezone: string;
    filters: { assigned_to_me: boolean };
    today: string;
    overdueFollowUps: FollowUp[];
    todayFollowUps: FollowUp[];
    upcomingFollowUps: FollowUp[];
    waitingInquiries: Inquiry[];
    waitingOnSupplier: Inquiry[];
    waitingOnInternalTeam: Inquiry[];
    quotesExpiringSoon: ExpiringQuote[];
    completedTodayCount: number;
    needsAttentionSuggestions: Suggestion[];
}>;

const WAITING_ON_LABELS: Record<string, string> = {
    supplier: 'Supplier',
    internal_team: 'Internal team',
    me: 'Me',
    none: 'None',
};

const PRIORITY_STYLES: Record<string, string> = {
    low: 'bg-muted text-muted-foreground',
    normal: 'bg-secondary text-secondary-foreground',
    high: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    urgent: 'bg-destructive text-white',
};

function FollowUpRow({ followUp }: { followUp: FollowUp }) {
    const { auth } = usePage<PageProps>().props;
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const complete = () => {
        setProcessing(true);
        router.post(route('contact-directory.follow-ups.complete', followUp.uuid), {}, {
            preserveScroll: true,
            onError: (errors) => setError(Object.values(errors)[0] || 'Unable to complete this follow-up.'),
            onFinish: () => setProcessing(false),
        });
    };
    return (
        <li className="rounded-md border border-border px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                    href={route('contact-directory.follow-ups.show', followUp.uuid)}
                    className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                    {followUp.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            PRIORITY_STYLES[followUp.priority],
                        )}
                    >
                        {followUp.priority}
                    </span>
                    {followUp.contact && (
                        <Link
                            href={route('contact-directory.contacts.show', followUp.contact.uuid)}
                            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                        >
                            {followUp.contact.first_name}{' '}
                            {followUp.contact.last_name ?? ''}
                        </Link>
                    )}
                </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
                Due{' '}
                {new Date(followUp.due_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                })}
                {followUp.snoozed_until
                    ? ` · snoozed until ${new Date(followUp.snoozed_until).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                      })}`
                    : ''}
                {followUp.inquiry ? ` · ${followUp.inquiry.title}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                    <Link href={route('contact-directory.follow-ups.show', followUp.uuid)}>View / reschedule</Link>
                </Button>
                {auth.can.manageFollowUps && (
                    <Button size="sm" disabled={processing} onClick={complete}>{processing ? 'Completing…' : 'Complete'}</Button>
                )}
            </div>
            <InputError message={error} />
        </li>
    );
}

function InquiryRow({ inquiry }: { inquiry: Inquiry }) {
    return (
        <li className="rounded-md border border-border px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                    href={route('contact-directory.inquiries.show', inquiry.uuid)}
                    className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                    {inquiry.title}
                </Link>
                {inquiry.waiting_on && (
                    <Badge variant="secondary">
                        Waiting on {WAITING_ON_LABELS[inquiry.waiting_on]}
                    </Badge>
                )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
                {inquiry.contact
                    ? `${inquiry.contact.first_name} ${inquiry.contact.last_name ?? ''} · `
                    : ''}
                {inquiry.expected_response_date
                    ? `Expected by ${inquiry.expected_response_date}`
                    : 'No expected response date'}
                {inquiry.current_quote
                    ? ` · Current quote: ${inquiry.current_quote.currency} ${Number(
                          inquiry.current_quote.grand_total,
                      ).toLocaleString(undefined, { minimumFractionDigits: 2 })} (rev ${
                          inquiry.current_quote.revision_number
                      })`
                    : ''}
            </p>
        </li>
    );
}

const SUMMARY_TONES: Record<string, string> = {
    red: 'border-red-200 bg-red-50/70 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
    emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
    amber: 'border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
    sky: 'border-sky-200 bg-sky-50/70 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300',
};

export default function MyDay({
    contacts,
    users,
    timezone,
    auth,
    filters,
    overdueFollowUps,
    todayFollowUps,
    upcomingFollowUps,
    waitingOnSupplier,
    waitingOnInternalTeam,
    quotesExpiringSoon,
    completedTodayCount,
    needsAttentionSuggestions,
}: MyDayProps) {
    const [assignedToMe, setAssignedToMe] = useState(filters.assigned_to_me ?? true);

    const summaryCards = [
        {
            label: 'Overdue',
            count: overdueFollowUps.length,
            href: route('contact-directory.follow-ups.index', { view: 'overdue' }),
            tone: 'red',
            icon: AlarmClockIcon,
        },
        {
            label: 'Due today',
            count: todayFollowUps.length,
            icon: CalendarCheckIcon,
            href: route('contact-directory.follow-ups.index', { view: 'today' }),
            tone: 'emerald',
        },
        {
            label: 'Waiting for response',
            count: waitingOnSupplier.length + waitingOnInternalTeam.length,
            href: route('contact-directory.inquiries.index', { waiting_for_response: '1' }),
            tone: 'amber',
            icon: MessageSquareMoreIcon,
        },
        {
            label: 'Completed today',
            count: completedTodayCount,
            href: route('contact-directory.follow-ups.index', { view: 'completed' }),
            tone: 'sky',
            icon: CheckCircle2Icon,
        },
    ];

    return (
        <AuthenticatedLayout stickyTitle="My Day">
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">My Day</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Your contact follow-ups, deadlines and next actions.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <CreateContactButton />
                        <CreateFollowUpButton contacts={contacts} users={users} timezone={timezone} />
                        <Button variant="outline" asChild><Link href={route('contact-directory.follow-ups.index')}>All follow-ups</Link></Button>
                    </div>
                </div>
                <Card className="border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base"><InfoIcon className="size-4 text-sky-600 dark:text-sky-300" aria-hidden="true" />How My Day works</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <p>My Day shows contact follow-ups assigned to you. Start with a contact, create a follow-up with a due date, then return here to complete or reschedule it.</p>
                        {auth.can.manageFollowUps ? (
                            <ol className="list-inside list-decimal space-y-1">
                                <li>{contacts.length === 0
                                    ? (auth.can.manageContactsDirectory ? 'Click New contact to add the person you need to follow up with.' : 'Ask an administrator to add a contact before scheduling a follow-up.')
                                    : (auth.can.manageContactsDirectory ? 'Choose an existing contact, or click New contact to add someone.' : 'Choose an existing contact to follow up with.')}</li>
                                <li>Click New follow-up, enter the task and due date, and leave Assigned to set to yourself.</li>
                                <li>Use Complete or View / reschedule on your tasks below.</li>
                            </ol>
                        ) : (
                            <p>Your account has read-only access to follow-ups. Ask an administrator to enable Manage follow-ups to create and complete tasks.</p>
                        )}
                        <p className="text-xs">Dates and times use the application timezone: {timezone}. Future tasks appear in Upcoming.</p>
                    </CardContent>
                </Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-3">
                        {summaryCards.map((card) => (
                            <Link
                                key={card.label}
                                href={card.href as string}
                                className={cn(
                                    'min-w-[150px] rounded-lg border p-4 shadow-sm transition hover:shadow-md',
                                    SUMMARY_TONES[card.tone],
                                )}
                            >
                                <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                                    <card.icon className="size-4" aria-hidden="true" />
                                    {card.label}
                                </p>
                                <p className="text-2xl font-semibold text-foreground">
                                    {card.count}
                                </p>
                            </Link>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                            type="checkbox"
                            checked={assignedToMe}
                            onChange={(event) => {
                                setAssignedToMe(event.target.checked);
                                router.get(
                                    route('contact-directory.my-day.index'),
                                    { assigned_to_me: event.target.checked ? '1' : '0' },
                                    { preserveState: true, replace: true },
                                );
                            }}
                        />
                        Assigned to me
                    </label>
                </div>

                {needsAttentionSuggestions.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base"><ShieldAlertIcon className="size-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />Needs attention</CardTitle>
                            <CardDescription>
                                Rule-based suggestions for open inquiries. Nothing is sent
                                automatically.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {needsAttentionSuggestions.map((suggestion, index) => (
                                <div
                                    key={`${suggestion.inquiry_id}-${index}`}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                                >
                                    <p
                                        className={cn(
                                            'text-sm',
                                            suggestion.severity === 'error'
                                                ? 'font-medium text-destructive'
                                                : 'text-foreground',
                                        )}
                                    >
                                        {suggestion.reason}
                                    </p>
                                    <Link
                                        href={route('contact-directory.inquiries.show', {
                                            inquiry: String(suggestion.inquiry_id),
                                        })}
                                        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                                    >
                                        Open inquiry
                                    </Link>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base"><AlarmClockIcon className="size-4 text-red-600 dark:text-red-300" aria-hidden="true" />Overdue follow-ups</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {overdueFollowUps.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Nothing is overdue. Nice work.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {overdueFollowUps.map((followUp) => (
                                        <FollowUpRow key={followUp.id} followUp={followUp} />
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base"><CalendarCheckIcon className="size-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />Due today</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {todayFollowUps.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No follow-ups are due today.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {todayFollowUps.map((followUp) => (
                                        <FollowUpRow key={followUp.id} followUp={followUp} />
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base"><CalendarClockIcon className="size-4 text-sky-600 dark:text-sky-300" aria-hidden="true" />Upcoming follow-ups</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {upcomingFollowUps.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No upcoming follow-ups are scheduled.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {upcomingFollowUps.map((followUp) => (
                                        <FollowUpRow key={followUp.id} followUp={followUp} />
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base"><TruckIcon className="size-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />Waiting on suppliers</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {waitingOnSupplier.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No inquiries are waiting on suppliers.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {waitingOnSupplier.map((inquiry) => (
                                        <InquiryRow key={inquiry.id} inquiry={inquiry} />
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base"><UsersIcon className="size-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />Waiting on the internal team</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {waitingOnInternalTeam.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No inquiries are waiting on the internal team.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {waitingOnInternalTeam.map((inquiry) => (
                                        <InquiryRow key={inquiry.id} inquiry={inquiry} />
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base"><HourglassIcon className="size-4 text-red-600 dark:text-red-300" aria-hidden="true" />Quotes expiring soon</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {quotesExpiringSoon.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No quotes are nearing expiration.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {quotesExpiringSoon.map((quote) => (
                                        <li
                                            key={quote.id}
                                            className="rounded-md border border-border px-3 py-2"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <Link
                                                    href={route('contact-directory.inquiries.show', quote.inquiry?.uuid ?? String(quote.id))}
                                                    className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                                                >
                                                    {quote.inquiry?.title ?? 'Quote'}
                                                </Link>
                                                <Badge variant="outline">
                                                    Revision {quote.revision_number}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Expires {quote.expires_at} ·{' '}
                                                {quote.currency}{' '}
                                                {Number(quote.grand_total).toLocaleString(
                                                    undefined,
                                                    { minimumFractionDigits: 2 },
                                                )}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
