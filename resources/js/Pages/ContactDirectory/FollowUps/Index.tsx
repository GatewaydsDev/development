import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

type User = { id: number; name: string };

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
    normal: 'bg-secondary text-secondary-foreground',
    high: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    urgent: 'bg-destructive text-white',
};

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
            until = snoozeCustom[followUp.id] ?? '';
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
                <div className="flex flex-wrap gap-2">
                    {VIEWS.map((item) => (
                        <Link
                            key={item.value}
                            href={route('contact-directory.follow-ups.index', {
                                view: item.value,
                            })}
                            className={cn(
                                'rounded-full border border-border px-3 py-1.5 text-sm',
                                view === item.value
                                    ? 'bg-foreground text-background'
                                    : 'text-foreground hover:border-ring',
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-sm font-medium text-foreground">
                            Search
                        </label>
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
                        options={users.map((user) => ({
                            value: String(user.id),
                            label: user.name,
                        }))}
                        placeholder="All users"
                        onChange={(value) => applyFilters({ assigned_user_id: value })}
                        className="w-[170px]"
                    />
                    <SimpleSelect
                        label="Priority"
                        value={filters.priority ?? ''}
                        options={Object.keys(PRIORITY_STYLES).map((value) => ({
                            value,
                            label: value,
                        }))}
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
                        <label className="mb-1 block text-sm font-medium text-foreground">
                            Due from
                        </label>
                        <TextInput
                            type="date"
                            value={filters.due_from ?? ''}
                            onChange={(event) => applyFilters({ due_from: event.target.value })}
                            className="w-[150px]"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">
                            Due to
                        </label>
                        <TextInput
                            type="date"
                            value={filters.due_to ?? ''}
                            onChange={(event) => applyFilters({ due_to: event.target.value })}
                            className="w-[150px]"
                        />
                    </div>
                    <Button type="submit">Search</Button>
                </form>

                <div className="space-y-4">
                    {followUps.data.length === 0 && (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                No follow-up tasks match these filters.
                            </CardContent>
                        </Card>
                    )}
                    {followUps.data.map((followUp) => {
                        const isOverdue =
                            followUp.status === 'pending' &&
                            new Date(followUp.due_at) < new Date();

                        return (
                            <Card key={followUp.id}>
                                <CardContent className="space-y-3 py-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <Link
                                                href={route('contact-directory.follow-ups.show', followUp.uuid)}
                                                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                                            >
                                                {followUp.title}
                                            </Link>
                                            <p
                                                className={cn(
                                                    'text-xs',
                                                    isOverdue
                                                        ? 'font-semibold text-destructive'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                Due{' '}
                                                {new Date(followUp.due_at).toLocaleString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                })}
                                                {isOverdue ? ' · overdue' : ''}
                                                {followUp.reminder_at
                                                    ? ' · reminder scheduled'
                                                    : ''}
                                                {followUp.snoozed_until
                                                    ? ` · snoozed until ${new Date(followUp.snoozed_until).toLocaleString(
                                                          [],
                                                          {
                                                              month: 'short',
                                                              day: 'numeric',
                                                              hour: 'numeric',
                                                              minute: '2-digit',
                                                          },
                                                      )}`
                                                    : ''}
                                                {followUp.inquiry ? ` · ${followUp.inquiry.title}` : ''}
                                            </p>
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
                                        <div className="flex flex-wrap items-center gap-2">
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
                                            {followUp.status === 'pending' && (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        onClick={() => complete(followUp)}
                                                    >
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
                                                        onChange={(value) =>
                                                            setSnoozeChoice((current) => ({
                                                                ...current,
                                                                [followUp.id]: value,
                                                            }))
                                                        }
                                                        className="w-[160px]"
                                                    />
                                                    {snoozeChoice[followUp.id] === 'custom' && (
                                                        <TextInput
                                                            type="datetime-local"
                                                            value={snoozeCustom[followUp.id] ?? ''}
                                                            onChange={(event) =>
                                                                setSnoozeCustom((current) => ({
                                                                    ...current,
                                                                    [followUp.id]: event.target.value,
                                                                }))
                                                            }
                                                        />
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => snooze(followUp)}
                                                    >
                                                        Snooze
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => cancel(followUp)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {followUp.description && (
                                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                            {followUp.description}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
