import FollowUpTaskList from '@/Components/ContactDirectory/FollowUpTaskList';
import { notesToHtml } from '@/lib/notesHtml';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router } from '@inertiajs/react';
import { BanIcon, PencilIcon, CalendarClockIcon, CheckIcon, LinkIcon, UserCheckIcon } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

type FollowUp = {
    id: number;
    uuid: string;
    title: string;
    description: string | null;
    tasks?: { id: number; title: string }[];
    due_at: string;
    reminder_at: string | null;
    priority: string;
    status: string;
    completed_at: string | null;
    completed_by_user?: { id: number; name: string } | null;
    snoozed_until: string | null;
    snoozed_reason: string | null;
    creator?: { id: number; name: string } | null;
    contact?: { id: number; uuid: string; first_name: string; last_name: string | null } | null;
    inquiry?: { id: number; uuid: string; title: string; status: string } | null;
    assigned_user?: { id: number; name: string } | null;
};

type Props = PageProps<{ followUp: FollowUp }>;

const PRIORITY_STYLES: Record<string, string> = {
    low: 'bg-muted text-muted-foreground',
    normal: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    high: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    urgent: 'bg-destructive text-white',
};

const formatWhen = (value: string, long = false) =>
    new Date(value).toLocaleString([], {
        weekday: long ? 'long' : undefined,
        month: long ? 'long' : 'short',
        day: 'numeric',
        year: long ? 'numeric' : undefined,
        hour: 'numeric',
        minute: '2-digit',
    });

const TONES = {
    sky: 'border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30',
    violet: 'border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30',
    amber: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30',
    emerald: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30',
} as const;
const tone = (c: keyof typeof TONES) => TONES[c];

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
            <div className="mt-0.5 text-sm text-foreground">{children}</div>
        </div>
    );
}

export default function FollowUpsShow({ followUp }: Props) {
    const isOverdue = followUp.status === 'pending' && new Date(followUp.due_at) < new Date();
    const act = (name: 'complete' | 'cancel') =>
        router.post(route(`contact-directory.follow-ups.${name}`, followUp.uuid), {}, { preserveScroll: true });
    const contactName = followUp.contact
        ? `${followUp.contact.first_name} ${followUp.contact.last_name ?? ''}`.trim()
        : null;

    return (
        <AuthenticatedLayout stickyTitle={followUp.title}>
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge
                            variant={followUp.status === 'completed' ? 'secondary' : followUp.status === 'cancelled' ? 'outline' : 'default'}
                            className="capitalize"
                        >
                            {followUp.status}
                        </Badge>
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', PRIORITY_STYLES[followUp.priority])}>
                            {followUp.priority}
                        </span>
                        {isOverdue && <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-medium text-white">Overdue</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" asChild>
                            <Link href={route('contact-directory.follow-ups.index')}>Back to follow-ups</Link>
                        </Button>
                        {followUp.status === 'pending' && (
                            <>
                                <Button variant="outline" asChild>
                                    <Link href={route('contact-directory.follow-ups.edit', followUp.uuid)}>
                                        <PencilIcon className="size-4" aria-hidden="true" />
                                        Edit
                                    </Link>
                                </Button>
                                <Button variant="outline" className="text-destructive" onClick={() => act('cancel')}>
                                    <BanIcon className="size-4" aria-hidden="true" />
                                    Cancel
                                </Button>
                                <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => act('complete')}>
                                    <CheckIcon className="size-4" aria-hidden="true" />
                                    Complete
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                    <Card className={tone('sky')}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <CalendarClockIcon className="size-5 text-sky-700 dark:text-sky-300" aria-hidden="true" />
                                Schedule
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Field label="Due">
                                <span className={isOverdue ? 'font-semibold text-destructive' : ''}>{formatWhen(followUp.due_at, true)}</span>
                            </Field>
                            <Field label="Assigned user">{followUp.assigned_user?.name ?? '—'}</Field>
                            <Field label="Reminder">{followUp.reminder_at ? formatWhen(followUp.reminder_at) : 'No reminder is scheduled.'}</Field>
                            <Field label="Snoozed">
                                {followUp.snoozed_until
                                    ? `Until ${formatWhen(followUp.snoozed_until)}${followUp.snoozed_reason ? ` · ${followUp.snoozed_reason}` : ''}`
                                    : 'Not snoozed.'}
                            </Field>
                        </CardContent>
                    </Card>

                    <Card className={tone('violet')}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <LinkIcon className="size-5 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                                Related
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Field label="Contact">
                                {followUp.contact && contactName ? (
                                    <Link href={route('contact-directory.contacts.show', followUp.contact.uuid)} className="text-violet-700 underline-offset-4 hover:underline dark:text-violet-300">
                                        {contactName}
                                    </Link>
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Inquiry">
                                {followUp.inquiry ? (
                                    <Link href={route('contact-directory.inquiries.show', followUp.inquiry.uuid)} className="text-violet-700 underline-offset-4 hover:underline dark:text-violet-300">
                                        {followUp.inquiry.title}
                                    </Link>
                                ) : (
                                    '—'
                                )}
                            </Field>
                        </CardContent>
                    </Card>

                    <Card className={tone('amber')}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <UserCheckIcon className="size-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                                History
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Field label="Created by">{followUp.creator?.name ?? '—'}</Field>
                            <Field label="Completed">
                                {followUp.completed_at
                                    ? `${formatWhen(followUp.completed_at)}${followUp.completed_by_user ? ` by ${followUp.completed_by_user.name}` : ''}`
                                    : 'Not completed.'}
                            </Field>
                        </CardContent>
                    </Card>

                    {(followUp.tasks?.length ?? 0) > 0 && (
                        <Card className={tone('violet')}>
                            <CardHeader><CardTitle className="text-base">Tasks</CardTitle></CardHeader>
                            <CardContent>
                                <FollowUpTaskList tasks={followUp.tasks ?? []} />
                            </CardContent>
                        </Card>
                    )}

                    <Card className={tone('emerald')}>
                        <CardHeader>
                            <CardTitle className="text-base">Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {followUp.description ? (
                                <div className="rich-text-content text-sm text-foreground" dangerouslySetInnerHTML={{ __html: notesToHtml(followUp.description) }} />
                            ) : (
                                <p className="text-sm text-muted-foreground">No notes added.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
