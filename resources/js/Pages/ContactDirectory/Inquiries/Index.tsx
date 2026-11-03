import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

type User = { id: number; name: string };

type Contact = {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string | null;
};

type Project = { id: number; uuid: string; name: string; project_number: string | null };

type Inquiry = {
    id: number;
    uuid: string;
    title: string;
    status: string;
    priority: string;
    waiting_on: string | null;
    expected_response_date: string | null;
    response_due_date: string | null;
    last_activity_at: string | null;
    pending_follow_ups_count: number;
    quote_count: number;
    contact?: Contact | null;
    assigned_user?: { id: number; name: string } | null;
    price_request?: { id: number; title: string; status: string } | null;
    project?: { id: number; name: string } | null;
    current_quote?: {
        id: number;
        revision_number: number;
        currency: string;
        grand_total: string;
    } | null;
};

type Suggestion = {
    inquiry_id: number;
    reason: string;
    action: string;
    severity: string;
};

type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
};

type Props = PageProps<{
    filters: {
        search?: string;
        status?: string;
        priority?: string;
        waiting_on?: string;
        assigned_user_id?: string;
        project_id?: string;
        contact_id?: string;
        assigned_to_me?: boolean;
        needs_attention?: boolean;
        waiting_for_response?: boolean;
    };
    inquiries: Paginated<Inquiry>;
    users: User[];
    projects: Project[];
    needsAttention: Suggestion[];
}>;

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

export default function InquiriesIndex({
    filters,
    inquiries,
    users,
    projects,
    needsAttention,
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const page = usePage<Props>();
    const canManage = Boolean(page.props.auth.can.manageContactsDirectory);
    const flash = page.props.flash;
    const [contactFilter, setContactFilter] = useState(filters.contact_id ?? '');

    const applyFilters = (updates: Record<string, string | boolean | undefined>) => {
        router.get(
            route('contact-directory.inquiries.index'),
            {
                ...filters,
                ...updates,
            },
            { preserveState: true, replace: true },
        );
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        applyFilters({ search });
    };

    return (
        <AuthenticatedLayout stickyTitle="Inquiries">
            <div className="space-y-6 px-4 py-6 lg:px-8">
                {flash?.success && (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        {flash.success}
                    </div>
                )}

                {canManage && (
                    <div className="flex justify-end">
                        <Button asChild>
                            <Link href={route('contact-directory.inquiries.create')}>New inquiry</Link>
                        </Button>
                    </div>
                )}

                <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-sm font-medium text-foreground">
                            Search
                        </label>
                        <TextInput
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by title, contact or supplier reference"
                            aria-label="Search inquiries"
                        />
                    </div>
                    <SimpleSelect
                        label="Status"
                        value={filters.status ?? ''}
                        options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
                            value,
                            label,
                        }))}
                        placeholder="All statuses"
                        onChange={(value) => applyFilters({ status: value })}
                        className="w-[180px]"
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
                        label="Waiting on"
                        value={filters.waiting_on ?? ''}
                        options={Object.entries(WAITING_ON_LABELS).map(([value, label]) => ({
                            value,
                            label,
                        }))}
                        placeholder="Any"
                        onChange={(value) => applyFilters({ waiting_on: value })}
                        className="w-[150px]"
                    />
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
                        label="Project"
                        value={filters.project_id ?? ''}
                        options={projects.map((project) => ({
                            value: String(project.id),
                            label: project.name,
                        }))}
                        placeholder="All projects"
                        onChange={(value) => applyFilters({ project_id: value })}
                        className="w-[180px]"
                    />
                    <Button type="submit">Search</Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            applyFilters({ needs_attention: filters.needs_attention ? '' : '1' })
                        }
                    >
                        {filters.needs_attention ? 'Clear needs attention' : 'Needs attention'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            applyFilters({ waiting_for_response: filters.waiting_for_response ? '' : '1' })
                        }
                    >
                        {filters.waiting_for_response
                            ? 'Clear waiting filter'
                            : 'Waiting for response'}
                    </Button>
                </form>

                {needsAttention.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Needs attention</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {needsAttention.map((suggestion, index) => (
                                <div
                                    key={`${suggestion.inquiry_id}-${index}`}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                                >
                                    <p className="text-sm text-foreground">{suggestion.reason}</p>
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

                <div className="space-y-4">
                    {inquiries.data.length === 0 && (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                No supplier inquiries match these filters.
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
                                        {inquiry.waiting_on && inquiry.waiting_on !== 'none' && (
                                            <Badge variant="outline">
                                                Waiting on {WAITING_ON_LABELS[inquiry.waiting_on]}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <span className="block text-xs uppercase">Contact</span>
                                    {inquiry.contact ? (
                                        <Link
                                            href={route('contact-directory.contacts.show', inquiry.contact.uuid)}
                                            className="text-foreground underline-offset-4 hover:underline"
                                        >
                                            {inquiry.contact.first_name}{' '}
                                            {inquiry.contact.last_name ?? ''}
                                        </Link>
                                    ) : (
                                        '—'
                                    )}
                                </div>
                                <div>
                                    <span className="block text-xs uppercase">Price request</span>
                                    {inquiry.price_request ? (
                                        <Link
                                            href={route('contact-directory.price-requests.show', inquiry.price_request.id)}
                                            className="text-foreground underline-offset-4 hover:underline"
                                        >
                                            {inquiry.price_request.title}
                                        </Link>
                                    ) : (
                                        'Standalone inquiry'
                                    )}
                                </div>
                                <div>
                                    <span className="block text-xs uppercase">Assigned</span>
                                    {inquiry.assigned_user?.name ?? '—'}
                                </div>
                                <div>
                                    <span className="block text-xs uppercase">Response due</span>
                                    {inquiry.response_due_date ?? '—'}
                                </div>
                                <div>
                                    <span className="block text-xs uppercase">Pending follow-ups</span>
                                    {inquiry.pending_follow_ups_count}
                                </div>
                                <div>
                                    <span className="block text-xs uppercase">Quote revisions</span>
                                    {inquiry.quote_count}
                                </div>
                                <div>
                                    <span className="block text-xs uppercase">Current quote</span>
                                    {inquiry.current_quote
                                        ? `${inquiry.current_quote.currency} ${Number(
                                              inquiry.current_quote.grand_total,
                                          ).toLocaleString(undefined, {
                                              minimumFractionDigits: 2,
                                          })} (rev ${inquiry.current_quote.revision_number})`
                                        : 'None recorded'}
                                </div>
                                <div>
                                    <span className="block text-xs uppercase">Last activity</span>
                                    {inquiry.last_activity_at
                                        ? new Date(inquiry.last_activity_at).toLocaleDateString(
                                              [],
                                              { month: 'short', day: 'numeric', year: 'numeric' },
                                          )
                                        : '—'}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
