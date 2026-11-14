import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FormActionFab from '@/Components/FormActionFab';
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
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
import { cn } from '@/lib/utils';
import { notesToHtml } from '@/lib/notesHtml';
import type { PageProps } from '@/types';

type User = { id: number; name: string };

type Contact = {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string | null;
    company?: { id: number; name: string } | null;
    phone_numbers: Array<{ phone_number: string; label: string; extension: string | null }>;
    email_addresses: Array<{ email_address: string; label: string }>;
};

type QuoteItem = {
    id: number;
    description: string;
    quantity: string;
    unit_of_measure: string;
    unit_price: string | null;
    line_total: string;
};

type Quote = {
    id: number;
    uuid: string;
    revision_number: number;
    is_current_revision: boolean;
    supplier_reference_number: string | null;
    received_at: string | null;
    expires_at: string | null;
    currency: string;
    discount_amount: string;
    discount_mode: string;
    freight_amount: string;
    tax_amount: string;
    other_charges_amount: string;
    grand_total: string;
    lead_time_value: string | null;
    lead_time_unit: string;
    lead_time_text: string | null;
    payment_terms: string | null;
    availability_notes: string | null;
    specification_compliance: string | null;
    exclusions: string | null;
    notes: string | null;
    review_status: string;
    items: QuoteItem[];
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
};

type Suggestion = { reason: string; action: string; severity: string };

type Inquiry = {
    id: number;
    uuid: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    waiting_on: string | null;
    waiting_on_user_id: number | null;
    waiting_since: string | null;
    expected_response_date: string | null;
    waiting_explanation: string | null;
    requested_date: string | null;
    response_due_date: string | null;
    closed_at: string | null;
    supplier_reference_number: string | null;
    contact?: Contact | null;
    assigned_user?: { id: number; name: string } | null;
    price_request?: { id: number; uuid: string; title: string; status: string; currency: string } | null;
    project?: { id: number; name: string } | null;
};

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

type ShowProps = PageProps<{
    inquiry: Inquiry;
    activities: Paginated<Activity>;
    followUps: Paginated<FollowUp>;
    quotes: Quote[];
    suggestions: Suggestion[];
    users: User[];
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

const SNOOZE_OPTIONS = [
    { value: '', label: 'Keep the current due date' },
    { value: '1', label: 'Tomorrow' },
    { value: '3', label: 'In 3 days' },
    { value: '7', label: 'In 1 week' },
    { value: 'custom', label: 'Custom date/time' },
];

export default function InquiriesShow({
    inquiry,
    activities,
    followUps,
    quotes,
    suggestions,
    users,
}: ShowProps) {
    const page = usePage<ShowProps>();
    const flash = page.props.flash;
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [statusDraft, setStatusDraft] = useState(inquiry.status);
    const [waitingOnDraft, setWaitingOnDraft] = useState(inquiry.waiting_on ?? 'none');
    const [waitingOnUserDraft, setWaitingOnUserDraft] = useState(
        inquiry.waiting_on_user_id ? String(inquiry.waiting_on_user_id) : '',
    );
    const [expectedResponseDraft, setExpectedResponseDraft] = useState(
        inquiry.expected_response_date?.slice(0, 10) ?? '',
    );
    const [waitingExplanationDraft, setWaitingExplanationDraft] = useState(
        inquiry.waiting_explanation ?? '',
    );
    const [snoozeDraft, setSnoozeDraft] = useState('');
    const [activeEditor, setActiveEditor] = useState<'status' | 'waiting' | null>(null);
    const [saving, setSaving] = useState(false);
    const canManage = Boolean(page.props.auth.can.manageContactsDirectory);
    const closeEditor = () => {
        setActiveEditor(null);
        setErrors({});
        setStatusDraft(inquiry.status);
        setWaitingOnDraft(inquiry.waiting_on ?? 'none');
        setWaitingOnUserDraft(inquiry.waiting_on_user_id ? String(inquiry.waiting_on_user_id) : '');
        setExpectedResponseDraft(inquiry.expected_response_date?.slice(0, 10) ?? '');
        setWaitingExplanationDraft(inquiry.waiting_explanation ?? '');
    };

    const updateStatus = (event: FormEvent) => {
        event.preventDefault();
        router.patch(
            route('contact-directory.inquiries.update', inquiry.uuid),
            { status: statusDraft },
            { preserveScroll: true, onStart: () => { setSaving(true); setErrors({}); }, onError: setErrors, onFinish: () => setSaving(false), onSuccess: () => setActiveEditor(null) },
        );
    };

    const updateWaitingOn = (event: FormEvent) => {
        event.preventDefault();
        router.patch(
            route('contact-directory.inquiries.waiting-on.update', inquiry.uuid),
            {
                waiting_on: waitingOnDraft,
                waiting_on_user_id: waitingOnDraft === 'internal_team' ? waitingOnUserDraft : null,
                expected_response_date: expectedResponseDraft || null,
                waiting_explanation: waitingExplanationDraft || null,
            },
            { preserveScroll: true, onStart: () => { setSaving(true); setErrors({}); }, onError: setErrors, onFinish: () => setSaving(false), onSuccess: () => setActiveEditor(null) },
        );
    };

    return (
        <AuthenticatedLayout stickyTitle={inquiry.title}>
            <div className="space-y-6 px-4 py-6 lg:px-8">
                {flash?.success && (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        {flash.success}
                    </div>
                )}

                {canManage && (
                    <div className="flex justify-end">
                        <Button asChild variant="outline">
                            <Link href={route('contact-directory.inquiries.edit', inquiry.uuid)}>Edit inquiry</Link>
                        </Button>
                    </div>
                )}

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
                            {inquiry.waiting_since
                                ? ` since ${new Date(inquiry.waiting_since).toLocaleDateString(
                                      [],
                                      { month: 'short', day: 'numeric' },
                                  )}`
                                : ''}
                        </Badge>
                    )}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                                <span className="block text-xs uppercase text-muted-foreground">
                                    Contact
                                </span>
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
                                <span className="block text-xs uppercase text-muted-foreground">
                                    Price request
                                </span>
                                {inquiry.price_request ? (
                                    <Link
                                        href={route('contact-directory.price-requests.show', inquiry.price_request.uuid)}
                                        className="text-foreground underline-offset-4 hover:underline"
                                    >
                                        {inquiry.price_request.title}
                                    </Link>
                                ) : (
                                    'Standalone inquiry'
                                )}
                            </div>
                            <div>
                                <span className="block text-xs uppercase text-muted-foreground">
                                    Assigned user
                                </span>
                                {inquiry.assigned_user?.name ?? '—'}
                            </div>
                            <div>
                                <span className="block text-xs uppercase text-muted-foreground">
                                    Requested date
                                </span>
                                {inquiry.requested_date ?? '—'}
                            </div>
                            <div>
                                <span className="block text-xs uppercase text-muted-foreground">
                                    Response due
                                </span>
                                {inquiry.response_due_date ?? '—'}
                            </div>
                            <div>
                                <span className="block text-xs uppercase text-muted-foreground">
                                    Supplier reference
                                </span>
                                {inquiry.supplier_reference_number ?? '—'}
                            </div>
                            {inquiry.description && (
                                <div className="sm:col-span-2">
                                    <span className="block text-xs uppercase text-muted-foreground">
                                        Description
                                    </span>
                                    <div className="rich-text-content text-foreground" dangerouslySetInnerHTML={{ __html: notesToHtml(inquiry.description) }} />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Current quote</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {quotes.filter((quote) => quote.is_current_revision).length ===
                                0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No supplier quote has been recorded yet.
                                    </p>
                                ) : (
                                    (() => {
                                        const quote = quotes.find(
                                            (quote) => quote.is_current_revision,
                                        )!;

                                        return (
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="text-sm font-medium">
                                                        Revision {quote.revision_number}
                                                    </span>
                                                    <Badge variant="outline">
                                                        {quote.currency}
                                                    </Badge>
                                                </div>
                                                <p className="text-xl font-semibold">
                                                    {quote.currency}{' '}
                                                    {Number(quote.grand_total).toLocaleString(
                                                        undefined,
                                                        { minimumFractionDigits: 2 },
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {quote.received_at
                                                        ? `Received ${quote.received_at}`
                                                        : 'No received date'}
                                                    {quote.expires_at ? ` · Expires ${quote.expires_at}` : ''}
                                                    {quote.payment_terms ? ` · ${quote.payment_terms}` : ''}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Review status: {quote.review_status}
                                                </p>
                                            </div>
                                        );
                                    })()
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Suggested next actions</CardTitle>
                                <CardDescription>
                                    Rule-based suggestions. Nothing is sent automatically.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {suggestions.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        Nothing needs attention for this inquiry.
                                    </p>
                                )}
                                {suggestions.map((suggestion, index) => (
                                    <p
                                        key={index}
                                        className={cn(
                                            'text-sm',
                                            suggestion.severity === 'error'
                                                ? 'text-destructive'
                                                : 'text-foreground',
                                        )}
                                    >
                                        {suggestion.reason}
                                    </p>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Tabs defaultValue="overview">
                    <TabsList className="flex-wrap">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="quotes">Quotes</TabsTrigger>
                        <TabsTrigger value="activity">Communication timeline</TabsTrigger>
                        <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-4 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Update status</CardTitle>
                                {canManage && activeEditor !== 'status' && <div><Button type="button" disabled={saving} onClick={() => { closeEditor(); setActiveEditor('status'); }}>Edit status</Button></div>}
                            </CardHeader>
                            <CardContent>
                                {canManage && activeEditor === 'status' ? <form id="directory-inquiry-status-form" onSubmit={updateStatus} className="flex min-w-0 flex-wrap items-end gap-5 pr-4 pb-28 sm:pr-20 lg:pb-6">
                                    <FormActionFab form="directory-inquiry-status-form" cancelHref={route('contact-directory.inquiries.show', inquiry.uuid)} saveLabel="Save status" onCancel={closeEditor} disabled={saving} />
                                    {errors && Object.keys(errors).length > 0 && <p role="alert" className="basis-full text-sm text-destructive">{Object.values(errors).join(' ')}</p>}
                                    <SimpleSelect
                                        label="Status"
                                        value={statusDraft}
                                        onChange={setStatusDraft}
                                        options={Object.entries(STATUS_LABELS).map(
                                            ([value, label]) => ({ value, label }),
                                        )}
                                    />
                                </form> : <p className="text-sm text-muted-foreground">{STATUS_LABELS[inquiry.status] ?? inquiry.status}</p>}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Waiting responsibility</CardTitle>
                                <CardDescription>
                                    Waiting on is separate from the inquiry status. “Me”
                                    always means the inquiry's assigned user, not whoever is
                                    viewing this page.
                                </CardDescription>
                                {canManage && activeEditor !== 'waiting' && <div><Button type="button" disabled={saving} onClick={() => { closeEditor(); setActiveEditor('waiting'); }}>Edit waiting responsibility</Button></div>}
                            </CardHeader>
                            <CardContent>
                                {canManage && activeEditor === 'waiting' ? <form
                                    id="directory-inquiry-waiting-form"
                                    onSubmit={updateWaitingOn}
                                    className="grid min-w-0 gap-5 pr-4 pb-28 sm:grid-cols-2 sm:pr-20 lg:pb-6"
                                >
                                    <FormActionFab form="directory-inquiry-waiting-form" cancelHref={route('contact-directory.inquiries.show', inquiry.uuid)} saveLabel="Save waiting responsibility" onCancel={closeEditor} disabled={saving} />
                                    {errors && Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-destructive sm:col-span-2">{Object.values(errors).join(' ')}</p>}
                                    <SimpleSelect
                                        label="Waiting on"
                                        value={waitingOnDraft}
                                        onChange={(value) => setWaitingOnDraft(value)}
                                        options={Object.entries(WAITING_ON_LABELS).map(
                                            ([value, label]) => ({ value, label }),
                                        )}
                                    />
                                    {waitingOnDraft === 'internal_team' && (
                                        <SimpleSelect
                                            label="Responsible internal user"
                                            value={waitingOnUserDraft}
                                            onChange={setWaitingOnUserDraft}
                                            options={users.map((user) => ({
                                                value: String(user.id),
                                                label: user.name,
                                            }))}
                                            placeholder="Select a user"
                                        />
                                    )}
                                    <div>
                                        <label htmlFor="inquiry-expected-response" className="mb-2 block text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                            Expected response date
                                        </label>
                                        <TextInput
                                            id="inquiry-expected-response"
                                            className="h-11 w-full min-w-0 border-border"
                                            type="date"
                                            value={expectedResponseDraft}
                                            onChange={(event) =>
                                                setExpectedResponseDraft(event.target.value)
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="inquiry-waiting-explanation" className="mb-2 block text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                            What is needed
                                        </label>
                                        <TextInput
                                            id="inquiry-waiting-explanation"
                                            className="h-11 w-full min-w-0 border-border"
                                            value={waitingExplanationDraft}
                                            onChange={(event) =>
                                                setWaitingExplanationDraft(event.target.value)
                                            }
                                            placeholder="Brief explanation of what is needed"
                                        />
                                    </div>
                                </form> : <p className="text-sm text-muted-foreground">{WAITING_ON_LABELS[inquiry.waiting_on ?? 'none'] ?? inquiry.waiting_on}{inquiry.waiting_explanation ? `: ${inquiry.waiting_explanation}` : ''}</p>}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="quotes" className="mt-4 space-y-4">
                        {quotes.length === 0 && (
                            <Card>
                                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                    No supplier quotes have been recorded for this inquiry yet.
                                </CardContent>
                            </Card>
                        )}
                        {quotes.map((quote) => (
                            <Card key={quote.id}>
                                <CardHeader>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <CardTitle className="text-base">
                                            Revision {quote.revision_number}
                                            {quote.is_current_revision ? ' (current)' : ''}
                                        </CardTitle>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline">{quote.currency}</Badge>
                                            <Badge variant="secondary">
                                                Review: {quote.review_status}
                                            </Badge>
                                        </div>
                                    </div>
                                    <CardDescription>
                                        {quote.received_at ? `Received ${quote.received_at}` : ''}
                                        {quote.expires_at ? ` · Expires ${quote.expires_at}` : ''}
                                        {quote.supplier_reference_number
                                            ? ` · Ref ${quote.supplier_reference_number}`
                                            : ''}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <h4 className="mb-2 text-sm font-semibold">Line items</h4>
                                        <ul className="space-y-2">
                                            {quote.items.map((item) => (
                                                <li
                                                    key={item.id}
                                                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                                                >
                                                    <span className="min-w-0 text-sm">
                                                        {item.description}
                                                        <span className="ml-2 text-xs text-muted-foreground">
                                                            {Number(item.quantity)}{' '}
                                                            {item.unit_of_measure} ×{' '}
                                                            {item.unit_price === null
                                                                ? 'no price'
                                                                : `${quote.currency} ${Number(
                                                                      item.unit_price,
                                                                  ).toLocaleString(undefined, {
                                                                      minimumFractionDigits: 2,
                                                                  })}`}
                                                        </span>
                                                    </span>
                                                    <span className="text-sm font-medium">
                                                        {quote.currency}{' '}
                                                        {Number(item.line_total).toLocaleString(
                                                            undefined,
                                                            { minimumFractionDigits: 2 },
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                            {quote.items.length === 0 && (
                                                <li className="text-sm text-muted-foreground">
                                                    No line items were recorded.
                                                </li>
                                            )}
                                        </ul>
                                    </div>

                                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                                        <div>
                                            <dt className="text-xs uppercase text-muted-foreground">
                                                Discount
                                            </dt>
                                            <dd>
                                                {Number(quote.discount_amount).toLocaleString(
                                                    undefined,
                                                    { minimumFractionDigits: 2 },
                                                )}
                                                {quote.discount_mode === 'percent' ? ' %' : ` ${quote.currency}`}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs uppercase text-muted-foreground">
                                                Freight
                                            </dt>
                                            <dd>
                                                {quote.currency}{' '}
                                                {Number(quote.freight_amount).toLocaleString(
                                                    undefined,
                                                    { minimumFractionDigits: 2 },
                                                )}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs uppercase text-muted-foreground">
                                                Tax
                                            </dt>
                                            <dd>
                                                {quote.currency}{' '}
                                                {Number(quote.tax_amount).toLocaleString(
                                                    undefined,
                                                    { minimumFractionDigits: 2 },
                                                )}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs uppercase text-muted-foreground">
                                                Other charges
                                            </dt>
                                            <dd>
                                                {quote.currency}{' '}
                                                {Number(
                                                    quote.other_charges_amount,
                                                ).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs uppercase text-muted-foreground">
                                                Grand total
                                            </dt>
                                            <dd className="text-base font-semibold">
                                                {quote.currency}{' '}
                                                {Number(quote.grand_total).toLocaleString(
                                                    undefined,
                                                    { minimumFractionDigits: 2 },
                                                )}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs uppercase text-muted-foreground">
                                                Lead time
                                            </dt>
                                            <dd>
                                                {quote.lead_time_value
                                                    ? `${quote.lead_time_value} ${quote.lead_time_unit}`
                                                    : quote.lead_time_text
                                                      ? quote.lead_time_text
                                                      : '—'}
                                            </dd>
                                        </div>
                                    </dl>

                                    {(quote.availability_notes ||
                                        quote.specification_compliance ||
                                        quote.exclusions ||
                                        quote.notes ||
                                        quote.payment_terms) && (
                                        <div className="space-y-2 text-sm">
                                            {quote.payment_terms && (
                                                <p className="text-muted-foreground">
                                                    Payment terms: {quote.payment_terms}
                                                </p>
                                            )}
                                            {quote.availability_notes && (
                                                <p className="text-muted-foreground">
                                                    Availability: {quote.availability_notes}
                                                </p>
                                            )}
                                            {quote.specification_compliance && (
                                                <p className="text-muted-foreground">
                                                    Specification compliance:{' '}
                                                    {quote.specification_compliance}
                                                </p>
                                            )}
                                            {quote.exclusions && (
                                                <p className="text-muted-foreground">
                                                    Exclusions: {quote.exclusions}
                                                </p>
                                            )}
                                            {quote.notes && (
                                                <p className="text-muted-foreground">
                                                    Notes: {quote.notes}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="activity" className="mt-4 space-y-4">
                        {activities.data.length === 0 && (
                            <Card>
                                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                    No communications have been logged for this inquiry yet.
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
                                            <Badge variant="secondary">{activity.activity_type}</Badge>
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
                                        {activity.activity_type === 'email' &&
                                            activity.mail_provider_status ===
                                                'provider_accepted' &&
                                            ' · provider accepted'}
                                        {activity.activity_type === 'email' &&
                                            activity.mail_provider_status === 'failed' &&
                                            ' · provider rejected'}
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
                                    No follow-up tasks are scheduled for this inquiry yet.
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
                                        {followUp.reminder_at ? ' · reminder scheduled' : ''}
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
