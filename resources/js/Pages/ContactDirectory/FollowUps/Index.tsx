import FollowUpTaskList from '@/Components/ContactDirectory/FollowUpTaskList';
import { notesToHtml } from '@/lib/notesHtml';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CreateFollowUpButton from '@/Components/ContactDirectory/CreateFollowUpButton';
import { Link, router } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { BanIcon, BellIcon, CalendarIcon, CheckIcon, ClockIcon, FileTextIcon, PencilIcon, UserIcon } from 'lucide-react';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import SplitDateTimeInput from '@/Components/SplitDateTimeInput';
import TextInput from '@/Components/TextInput';
import { toIsoInstant } from '@/lib/followUpTime';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

type User = { id: number; name: string };

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
    snoozed_until: string | null;
    contact?: { id: number; uuid: string; first_name: string; last_name: string | null } | null;
    inquiry?: { id: number; uuid: string; title: string; status: string } | null;
    assigned_user?: { id: number; name: string } | null;
};

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Props = PageProps<{
    filters: {
        search?: string;
        view?: string;
        assigned_user_id?: string;
        priority?: string;
        contact_id?: string;
        inquiry_id?: string;
        due_from?: string;
        due_to?: string;
        assigned_to_me?: boolean;
    };
    view: string;
    followUps: Paginated<FollowUp>;
    users: User[];
    contacts: Array<{ id: number; uuid: string; first_name: string; last_name: string | null }>;
}>;

const VIEWS = [
    { value: 'all', label: 'All' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Today' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_STYLES: Record<string, string> = {
    low: 'bg-muted text-muted-foreground',
    normal: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    high: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    urgent: 'bg-destructive text-white',
};

const formatWhen = (value: string) =>
    new Date(value).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

const cardTone = (status: string, overdue: boolean) =>
    status === 'completed'
        ? 'border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
        : status === 'cancelled'
          ? 'border-l-muted-foreground/40 opacity-75'
          : overdue
            ? 'border-l-destructive bg-red-50/50 dark:bg-red-950/20'
            : 'border-l-sky-500';

export default function FollowUpsIndex({
    filters,
    view,
    followUps,
    users,
    contacts,
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [snoozeChoice, setSnoozeChoice] = useState<Record<number, string>>({});
    const [snoozeCustom, setSnoozeCustom] = useState<Record<number, string>>({});

    const applyFilters = (updates: Record<string, string | boolean | undefined>) => {
        router.get(
            route('contact-directory.follow-ups.index'),
            { ...filters, ...updates },
            { preserveState: true, replace: true },
        );
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        applyFilters({ search });
    };

    const complete = (followUp: FollowUp) => {
        router.post(
            route('contact-directory.follow-ups.complete', followUp.uuid),
            {},
            { preserveScroll: true },
        );
    };

    const snooze = (followUp: FollowUp) => {
        const choice = snoozeChoice[followUp.id] ?? '';

        if (!choice) {
            return;
        }

        let until: string;

        if (choice === 'custom') {
            until = toIsoInstant(snoozeCustom[followUp.id] ?? '');
        } else {
            const date = new Date();
            date.setDate(date.getDate() + Number(choice));
            until = date.toISOString();
        }

        if (!until) {
            return;
        }

        router.post(
            route('contact-directory.follow-ups.snooze', followUp.uuid),
            { snoozed_until: until },
            { preserveScroll: true },
        );
    };

    const cancel = (followUp: FollowUp) => {
        router.post(
            route('contact-directory.follow-ups.cancel', followUp.uuid),
            {},
            { preserveScroll: true },
        );
    };

    return (
        <AuthenticatedLayout stickyTitle="Follow-ups">
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">Schedule contact-related tasks and keep track of their next steps.</p>
                    <CreateFollowUpButton contacts={contacts} users={users} />
                </div>

                <div className="flex flex-wrap gap-2">
                    {VIEWS.map((item) => (
                        <Link
                            key={item.value}
                            href={route('contact-directory.follow-ups.index', { view: item.value })}
                            className={cn(
                                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
                                view === item.value
                                    ? item.value === 'overdue'
                                        ? 'border-destructive bg-destructive text-white'
                                        : 'border-emerald-600 bg-emerald-600 text-white'
                                    : 'border-border bg-card text-foreground hover:border-emerald-400',
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                <form
                    onSubmit={submitSearch}
                    className="flex flex-wrap items-end gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/30"
                >
                    <div className="min-w-[14rem] flex-1">
                        <label className="mb-1 block text-sm font-medium text-sky-700 dark:text-sky-300">Search</label>
                        <TextInput
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search follow-ups by title or contact"
                            aria-label="Search follow-ups"
                        />
                    </div>
                    <SimpleSelect
                        label="Assigned user"
                        value={filters.assigned_user_id ?? ''}
                        options={users.map((user) => ({ value: String(user.id), label: user.name }))}
                        placeholder="All users"
                        onChange={(value) => applyFilters({ assigned_user_id: value })}
                        className="w-[170px]"
                    />
                    <SimpleSelect
                        label="Priority"
                        value={filters.priority ?? ''}
                        options={Object.keys(PRIORITY_STYLES).map((value) => ({ value, label: value }))}
                        placeholder="All priorities"
                        onChange={(value) => applyFilters({ priority: value })}
                        className="w-[140px]"
                    />
                    <SimpleSelect
                        label="Contact"
                        value={filters.contact_id ?? ''}
                        options={contacts.map((contact) => ({
                            value: String(contact.id),
                            label: `${contact.first_name} ${contact.last_name ?? ''}`,
                        }))}
                        placeholder="All contacts"
                        onChange={(value) => applyFilters({ contact_id: value })}
                        className="w-[170px]"
                    />
                    <div>
                        <label className="mb-1 block text-sm font-medium text-sky-700 dark:text-sky-300">Due from</label>
                        <TextInput
                            type="date"
                            value={filters.due_from ?? ''}
                            onChange={(event) => applyFilters({ due_from: event.target.value })}
                            className="w-[150px]"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-sky-700 dark:text-sky-300">Due to</label>
                        <TextInput
                            type="date"
                            value={filters.due_to ?? ''}
                            onChange={(event) => applyFilters({ due_to: event.target.value })}
                            className="w-[150px]"
                        />
                    </div>
                    <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700">
                        Search
                    </Button>
                </form>

                <div className="space-y-3">
                    {followUps.data.length === 0 && (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                No follow-up tasks match these filters.
                            </CardContent>
                        </Card>
                    )}
                    {followUps.data.map((followUp) => {
                        const isOverdue = followUp.status === 'pending' && new Date(followUp.due_at) < new Date();
                        const contactName = followUp.contact
                            ? `${followUp.contact.first_name} ${followUp.contact.last_name ?? ''}`.trim()
                            : null;

                        return (
                            <Card key={followUp.id} className={cn('border-l-4 shadow-sm', cardTone(followUp.status, isOverdue))}>
                                <CardContent className="space-y-3 py-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 space-y-2">
                                            <Link
                                                href={route('contact-directory.follow-ups.show', followUp.uuid)}
                                                className={cn(
                                                    'text-base font-semibold text-foreground underline-offset-4 hover:underline',
                                                    followUp.status === 'completed' && 'line-through decoration-1',
                                                )}
                                            >
                                                {followUp.title}
                                            </Link>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                <span className={cn('inline-flex items-center gap-1', isOverdue && 'font-semibold text-destructive')}>
                                                    <CalendarIcon className="size-3.5" aria-hidden="true" />
                                                    Due {formatWhen(followUp.due_at)}
                                                    {isOverdue ? ' · overdue' : ''}
                                                </span>
                                                {followUp.reminder_at && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <BellIcon className="size-3.5" aria-hidden="true" />
                                                        Reminder {formatWhen(followUp.reminder_at)}
                                                    </span>
                                                )}
                                                {followUp.snoozed_until && (
                                                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                                                        <ClockIcon className="size-3.5" aria-hidden="true" />
                                                        Snoozed until {formatWhen(followUp.snoozed_until)}
                                                    </span>
                                                )}
                                                {followUp.assigned_user && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <UserIcon className="size-3.5" aria-hidden="true" />
                                                        {followUp.assigned_user.name}
                                                    </span>
                                                )}
                                                {followUp.inquiry && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <FileTextIcon className="size-3.5" aria-hidden="true" />
                                                        {followUp.inquiry.title}
                                                    </span>
                                                )}
                                            </div>
                                            {followUp.contact && contactName && (
                                                <Link
                                                    href={route('contact-directory.contacts.show', followUp.contact.uuid)}
                                                    className="inline-block text-sm text-sky-700 underline-offset-4 hover:underline dark:text-sky-300"
                                                >
                                                    {contactName}
                                                </Link>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={
                                                    followUp.status === 'completed'
                                                        ? 'secondary'
                                                        : followUp.status === 'cancelled'
                                                          ? 'outline'
                                                          : 'default'
                                                }
                                                className="rounded-full capitalize"
                                            >
                                                {followUp.status}
                                            </Badge>
                                            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', PRIORITY_STYLES[followUp.priority])}>
                                                {followUp.priority}
                                            </span>
                                        </div>
                                    </div>

                                    <FollowUpTaskList tasks={followUp.tasks ?? []} limit={4} />

                                    {followUp.description && (
                                        <div className="rich-text-content line-clamp-3 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: notesToHtml(followUp.description) }} />
                                    )}

                                    {followUp.status === 'pending' && (
                                        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                                            <Button size="sm" className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => complete(followUp)}>
                                                <CheckIcon className="size-4" aria-hidden="true" />
                                                Complete
                                            </Button>
                                            <SimpleSelect
                                                value={snoozeChoice[followUp.id] ?? ''}
                                                options={[
                                                    { value: '1', label: 'Tomorrow' },
                                                    { value: '3', label: 'In 3 days' },
                                                    { value: '7', label: 'In 1 week' },
                                                    { value: 'custom', label: 'Custom' },
                                                ]}
                                                placeholder="Snooze reminder"
                                                onChange={(value) => setSnoozeChoice((current) => ({ ...current, [followUp.id]: value }))}
                                                className="w-[160px]"
                                            />
                                            {snoozeChoice[followUp.id] === 'custom' && (
                                                <div className="w-[20rem] max-w-full">
                                                    <SplitDateTimeInput
                                                        id={`snooze-${followUp.id}`}
                                                        value={snoozeCustom[followUp.id] ?? ''}
                                                        onChange={(value) => setSnoozeCustom((current) => ({ ...current, [followUp.id]: value }))}
                                                    />
                                                </div>
                                            )}
                                            <Button size="sm" variant="outline" className="rounded-full" onClick={() => snooze(followUp)}>
                                                <ClockIcon className="size-4" aria-hidden="true" />
                                                Snooze
                                            </Button>
                                            <Button size="sm" variant="outline" className="rounded-full" asChild>
                                                <Link href={route('contact-directory.follow-ups.edit', followUp.uuid)}>
                                                    <PencilIcon className="size-4" aria-hidden="true" />
                                                    Edit
                                                </Link>
                                            </Button>
                                            <Button size="sm" variant="outline" className="ml-auto rounded-full text-destructive" onClick={() => cancel(followUp)}>
                                                <BanIcon className="size-4" aria-hidden="true" />
                                                Cancel
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {followUps.last_page > 1 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Page {followUps.current_page} of {followUps.last_page} · {followUps.total} follow-ups</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={followUps.current_page <= 1} onClick={() => applyFilters({ page: String(followUps.current_page - 1) })}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={followUps.current_page >= followUps.last_page} onClick={() => applyFilters({ page: String(followUps.current_page + 1) })}>Next</Button>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
