import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CreateFollowUpButton from '@/Components/ContactDirectory/CreateFollowUpButton';
import { Link, router, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import TextInput from '@/Components/TextInput';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import type { PageProps as BasePageProps } from '@/types';
import { cn } from '@/lib/utils';

type User = { id: number; name: string };

type Contact = {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string | null;
    job_title: string | null;
    contact_type: string;
    is_active: boolean;
    notes: string | null;
    company?: { id: number; name: string } | null;
    owner?: { id: number; name: string } | null;
    phone_numbers: Array<{
        id: number;
        phone_number: string;
        label: string;
        extension: string | null;
        is_primary: boolean;
    }>;
    email_addresses: Array<{
        id: number;
        email_address: string;
        label: string;
        is_primary: boolean;
    }>;
};

type Inquiry = {
    id: number;
    uuid: string;
    title: string;
    status: string;
    priority: string;
    waiting_on: string | null;
    expected_response_date: string | null;
    response_due_date: string | null;
    assigned_user?: { id: number; name: string } | null;
    price_request?: { id: number; title: string; status: string } | null;
    pending_follow_ups_count: number;
    quote_count: number;
};

type Activity = {
    id: number;
    activity_type: string;
    direction: string;
    subject: string;
    content: string | null;
    occurred_at: string;
    mail_provider_status: string | null;
    mail_delivered: boolean;
    creator?: { id: number; name: string } | null;
    inquiry?: { id: number; title: string } | null;
};

type FollowUp = {
    id: number;
    uuid: string;
    title: string;
    description: string | null;
    due_at: string;
    reminder_at: string | null;
    priority: string;
    status: string;
    completed_at: string | null;
    snoozed_until: string | null;
    assigned_user?: { id: number; name: string } | null;
    completed_by_user?: { id: number; name: string } | null;
    inquiry?: { id: number; title: string } | null;
};

type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
};

type ShowProps = BasePageProps<{
    contact: Contact;
    tab: string;
    inquiries: Paginated<Inquiry>;
    activities: Paginated<Activity>;
    followUps: Paginated<FollowUp>;
    nextFollowUp: FollowUp | null;
    users: User[];
}> & {
    contact: Contact;
    tab: string;
    inquiries: Paginated<Inquiry>;
    activities: Paginated<Activity>;
    followUps: Paginated<FollowUp>;
    nextFollowUp: FollowUp | null;
};

const ACTIVITY_LABELS: Record<string, string> = {
    email: 'Email',
    phone_call: 'Phone call',
    meeting: 'Meeting',
    text_message: 'Text message',
    note: 'Note',
};

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    open: 'Open',
    waiting_for_response: 'Waiting for response',
    response_received: 'Response received',
    closed: 'Closed',
    cancelled: 'Cancelled',
};

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

export default function ContactsShow({
    contact,
    tab,
    inquiries,
    activities,
    followUps,
    nextFollowUp,
    users,
}: ShowProps) {
    const pageProps = usePage<ShowProps>();
    const can = (pageProps.props.auth.can ?? {}) as Record<string, boolean>;
    const flash = pageProps.props.flash;
    const errors = pageProps.props.errors as Record<string, string> | undefined;
    const canLogCommunications = Boolean(can.logCommunications);

    const [logOpen, setLogOpen] = useState(false);
    const [logType, setLogType] = useState('phone_call');
    const [logDirection, setLogDirection] = useState('outgoing');
    const [logSubject, setLogSubject] = useState('');
    const [logContent, setLogContent] = useState('');

    const submitLog = (event: FormEvent) => {
        event.preventDefault();

        router.post(
            route('contact-directory.contacts.activities.store', contact.uuid),
            {
                activity_type: logType,
                direction: logDirection,
                subject: logSubject,
                content: logContent,
                occurred_at: new Date().toISOString(),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setLogOpen(false);
                    setLogSubject('');
                    setLogContent('');
                },
            },
        );
    };

    return (
        <AuthenticatedLayout stickyTitle={`${contact.first_name} ${contact.last_name ?? ''}`}>
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">Schedule a task for this contact to track it in My Day.</p>
                    <CreateFollowUpButton contacts={[contact]} users={users} contactId={contact.id} />
                </div>
                {flash?.success && (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        {flash.success}
                    </div>
                )}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">
                                {contact.first_name} {contact.last_name ?? ''}
                            </CardTitle>
                            <CardDescription>
                                {contact.job_title ?? 'No job title'} ·{' '}
                                {contact.company?.name ?? 'No company'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{contact.contact_type}</Badge>
                                {contact.is_active ? (
                                    <Badge>Active</Badge>
                                ) : (
                                    <Badge variant="outline">Inactive</Badge>
                                )}
                                <Badge variant="outline">
                                    Owner: {contact.owner?.name ?? '—'}
                                </Badge>
                            </div>

                            {contact.phone_numbers.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold">Phone numbers</h3>
                                    {contact.phone_numbers.map((phone) => (
                                        <div
                                            key={phone.id}
                                            className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                                        >
                                            <span className="text-sm">
                                                <a
                                                    href={`tel:${phone.phone_number}`}
                                                    className="text-foreground underline-offset-4 hover:underline"
                                                >
                                                    {phone.phone_number}
                                                    {phone.extension
                                                        ? ` x${phone.extension}`
                                                        : ''}
                                                </a>
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    {phone.label}
                                                    {phone.is_primary ? ' · primary' : ''}
                                                </span>
                                            </span>
                                            <a
                                                href={`tel:${phone.phone_number}`}
                                                className="text-sm text-foreground underline-offset-4 hover:underline"
                                            >
                                                Call
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {contact.email_addresses.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold">Email addresses</h3>
                                    {contact.email_addresses.map((email) => (
                                        <div
                                            key={email.id}
                                            className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                                        >
                                            <span className="text-sm">
                                                <a
                                                    href={`mailto:${email.email_address}`}
                                                    className="text-foreground underline-offset-4 hover:underline"
                                                >
                                                    {email.email_address}
                                                </a>
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    {email.label}
                                                    {email.is_primary ? ' · primary' : ''}
                                                </span>
                                            </span>
                                            <Link
                                                href={route('contact-directory.contacts.email.compose', contact.uuid)}
                                                className="text-sm text-foreground underline-offset-4 hover:underline"
                                            >
                                                Email
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {contact.notes && (
                                <div>
                                    <h3 className="mb-1 text-sm font-semibold">Notes</h3>
                                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                        {contact.notes}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Next follow-up</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {nextFollowUp ? (
                                    <div className="space-y-2">
                                        <p className="font-medium">{nextFollowUp.title}</p>
                                        <p
                                            className={cn(
                                                'text-sm',
                                                new Date(nextFollowUp.due_at) < new Date() &&
                                                    nextFollowUp.status === 'pending'
                                                    ? 'font-semibold text-destructive'
                                                    : 'text-muted-foreground',
                                            )}
                                        >
                                            {new Date(nextFollowUp.due_at).toLocaleString([], {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Assigned to {nextFollowUp.assigned_user?.name ?? '—'}
                                        </p>
                                        <Link
                                            href={route('contact-directory.follow-ups.show', nextFollowUp.uuid)}
                                            className="text-sm text-foreground underline-offset-4 hover:underline"
                                        >
                                            Open follow-up
                                        </Link>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No pending follow-up is scheduled.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {canLogCommunications && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Quick actions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => setLogOpen((open) => !open)}
                                    >
                                        Log a communication
                                    </Button>
                                    <Button asChild variant="outline" className="w-full justify-start">
                                        <Link
                                            href={route(
                                                'contact-directory.contacts.email.compose',
                                                contact.uuid,
                                            )}
                                        >
                                            Record an email
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline" className="w-full justify-start">
                                        <Link
                                            href={route('contact-directory.inquiries.index', {
                                                contact_id: contact.id,
                                            })}
                                        >
                                            Create an inquiry
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                {canLogCommunications && logOpen && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Log a communication</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitLog} className="grid gap-3 md:grid-cols-2">
                                <SimpleSelect
                                    label="Type"
                                    value={logType}
                                    onChange={setLogType}
                                    options={Object.entries(ACTIVITY_LABELS).map(
                                        ([value, label]) => ({ value, label }),
                                    )}
                                />
                                <SimpleSelect
                                    label="Direction"
                                    value={logDirection}
                                    onChange={setLogDirection}
                                    options={[
                                        { value: 'outgoing', label: 'Outgoing' },
                                        { value: 'incoming', label: 'Incoming' },
                                        { value: 'internal', label: 'Internal' },
                                    ]}
                                />
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-foreground">
                                        Subject
                                    </label>
                                    <TextInput
                                        value={logSubject}
                                        onChange={(event) => setLogSubject(event.target.value)}
                                        required
                                    />
                                    {errors?.subject && (
                                        <p className="mt-1 text-xs text-destructive">
                                            {errors?.subject}
                                        </p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="mb-1 block text-sm font-medium text-foreground">
                                        Notes or communication content
                                    </label>
                                    <textarea
                                        value={logContent}
                                        onChange={(event) => setLogContent(event.target.value)}
                                        rows={5}
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
                                    />
                                </div>
                                <div className="flex gap-2 md:col-span-2">
                                    <Button type="submit">Save communication</Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setLogOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <Tabs defaultValue={tab === 'inquiries' ? 'inquiries' : tab === 'activity' ? 'activity' : tab === 'follow-ups' ? 'follow-ups' : 'overview'}>
                    <TabsList className="flex-wrap">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
                        <TabsTrigger value="activity">Activity timeline</TabsTrigger>
                        <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-4 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Open inquiries</p>
                                    <p className="text-2xl font-semibold">
                                        {inquiries.data.filter(
                                            (inquiry) =>
                                                !['closed', 'cancelled'].includes(inquiry.status),
                                        ).length}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Pending follow-ups</p>
                                    <p className="text-2xl font-semibold">
                                        {followUps.data.filter(
                                            (followUp) => followUp.status === 'pending',
                                        ).length}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Recorded communications</p>
                                    <p className="text-2xl font-semibold">{activities.total}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="inquiries" className="mt-4 space-y-4">
                        {inquiries.data.length === 0 && (
                            <Card>
                                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                    No supplier inquiries have been logged for this contact yet.
                                </CardContent>
                            </Card>
                        )}
                        {inquiries.data.map((inquiry) => (
                            <Card key={inquiry.id}>
                                <CardHeader>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <CardTitle className="text-base">
                                            <Link
                                                href={route('contact-directory.inquiries.show', inquiry.uuid)}
                                                className="text-foreground underline-offset-4 hover:underline"
                                            >
                                                {inquiry.title}
                                            </Link>
                                        </CardTitle>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="secondary">
                                                {STATUS_LABELS[inquiry.status] ?? inquiry.status}
                                            </Badge>
                                            <span
                                                className={cn(
                                                    'rounded-full px-2 py-0.5 text-xs font-medium',
                                                    PRIORITY_STYLES[inquiry.priority],
                                                )}
                                            >
                                                {inquiry.priority}
                                            </span>
                                        </div>
                                    </div>
                                    <CardDescription>
                                        {inquiry.price_request
                                            ? `Price request: ${inquiry.price_request.title}`
                                            : 'Standalone inquiry'}
                                        {inquiry.response_due_date
                                            ? ` · Response due ${inquiry.response_due_date}`
                                            : ''}
                                        {inquiry.waiting_on && inquiry.waiting_on !== 'none'
                                            ? ` · Waiting on ${WAITING_ON_LABELS[inquiry.waiting_on]}`
                                            : ''}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                    <span>
                                        Assigned to {inquiry.assigned_user?.name ?? '—'}
                                    </span>
                                    <span>
                                        {inquiry.pending_follow_ups_count} pending follow-ups
                                    </span>
                                    <span>{inquiry.quote_count} quote revisions</span>
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="activity" className="mt-4 space-y-4">
                        {activities.data.length === 0 && (
                            <Card>
                                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                    No communications have been logged for this contact yet.
                                </CardContent>
                            </Card>
                        )}
                        {activities.data.map((activity) => (
                            <Card key={activity.id}>
                                <CardHeader>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <CardTitle className="text-base">
                                            {activity.subject}
                                        </CardTitle>
                                        <div className="flex gap-2">
                                            <Badge variant="secondary">
                                                {ACTIVITY_LABELS[activity.activity_type] ??
                                                    activity.activity_type}
                                            </Badge>
                                            <Badge variant="outline">{activity.direction}</Badge>
                                        </div>
                                    </div>
                                    <CardDescription>
                                        {new Date(activity.occurred_at).toLocaleString([], {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        })}
                                        {activity.creator ? ` · by ${activity.creator.name}` : ''}
                                        {activity.inquiry ? ` · ${activity.inquiry.title}` : ''}
                                        {activity.activity_type === 'email' &&
                                            activity.mail_provider_status ===
                                                'provider_accepted' &&
                                            ' · provider accepted'}
                                        {activity.activity_type === 'email' &&
                                            activity.mail_provider_status === 'failed' &&
                                            ' · provider rejected, not recorded as sent'}
                                        {activity.activity_type === 'email' &&
                                            activity.mail_provider_status ===
                                                'logged_manually' &&
                                            ' · logged manually'}
                                    </CardDescription>
                                </CardHeader>
                                {activity.content && (
                                    <CardContent>
                                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                            {activity.content}
                                        </p>
                                    </CardContent>
                                )}
                            </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="follow-ups" className="mt-4 space-y-4">
                        {followUps.data.length === 0 && (
                            <Card>
                                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                    No follow-up tasks have been scheduled for this contact yet.
                                </CardContent>
                            </Card>
                        )}
                        {followUps.data.map((followUp) => (
                            <Card key={followUp.id}>
                                <CardHeader>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <CardTitle className="text-base">
                                            <Link
                                                href={route('contact-directory.follow-ups.show', followUp.uuid)}
                                                className="text-foreground underline-offset-4 hover:underline"
                                            >
                                                {followUp.title}
                                            </Link>
                                        </CardTitle>
                                        <div className="flex gap-2">
                                            <Badge
                                                variant={
                                                    followUp.status === 'completed'
                                                        ? 'secondary'
                                                        : followUp.status === 'cancelled'
                                                          ? 'outline'
                                                          : 'default'
                                                }
                                            >
                                                {followUp.status}
                                            </Badge>
                                            <span
                                                className={cn(
                                                    'rounded-full px-2 py-0.5 text-xs font-medium',
                                                    PRIORITY_STYLES[followUp.priority],
                                                )}
                                            >
                                                {followUp.priority}
                                            </span>
                                        </div>
                                    </div>
                                    <CardDescription>
                                        Due{' '}
                                        {new Date(followUp.due_at).toLocaleString([], {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        })}
                                        {followUp.status === 'pending' &&
                                        new Date(followUp.due_at) < new Date()
                                            ? ' · overdue'
                                            : ''}
                                        {followUp.reminder_at
                                            ? ' · reminder scheduled'
                                            : ''}
                                        {followUp.snoozed_until
                                            ? ` · snoozed until ${new Date(followUp.snoozed_until).toLocaleString([], {
                                                  month: 'short',
                                                  day: 'numeric',
                                                  hour: 'numeric',
                                                  minute: '2-digit',
                                              })}`
                                            : ''}
                                        {followUp.inquiry ? ` · ${followUp.inquiry.title}` : ''}
                                    </CardDescription>
                                </CardHeader>
                                {followUp.description && (
                                    <CardContent>
                                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                            {followUp.description}
                                        </p>
                                    </CardContent>
                                )}
                            </Card>
                        ))}
                    </TabsContent>
                </Tabs>
            </div>
        </AuthenticatedLayout>
    );
}
