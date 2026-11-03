import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FormActionFab from '@/Components/FormActionFab';
import { Link, router, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

type User = { id: number; name: string };

type Project = { id: number; uuid: string; name: string; project_number: string | null };

type Contact = { id: number; uuid: string; first_name: string; last_name: string | null };

type Inquiry = {
    id: number;
    uuid: string;
    title: string;
    status: string;
    priority: string;
    waiting_on: string | null;
    response_due_date: string | null;
    pending_follow_ups_count: number;
    contact?: Contact | null;
    assigned_user?: { id: number; name: string } | null;
    current_quote?: {
        id: number;
        revision_number: number;
        currency: string;
        grand_total: string;
        supplier_reference_number: string | null;
    } | null;
};

type PriceRequestItem = {
    id: number;
    description: string;
    quantity: string;
    unit_of_measure: string;
    specifications: string | null;
    notes: string | null;
};

type PreferredQuoteSelection = {
    supplier_quote?: {
        id: number;
        revision_number: number;
        currency: string;
        grand_total: string;
        supplier_reference_number: string | null;
    } | null;
    selection_reason: string;
    selected_by?: { id: number; name: string } | null;
    selected_at: string;
} | null;

type PriceRequest = {
    id: number;
    uuid: string;
    title: string;
    description: string | null;
    currency: string;
    required_by: string | null;
    status: string;
    owner?: { id: number; name: string } | null;
    project?: { id: number; uuid: string; name: string } | null;
    items: PriceRequestItem[];
    preferred_quote_selection: PreferredQuoteSelection;
};

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
              new Date(value),
          )
        : '';

type Props = PageProps<{
    priceRequest: PriceRequest;
    inquiries: Paginated<Inquiry>;
    users: User[];
    projects: Project[];
    contacts: Contact[];
}>;

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    open: 'Open',
    under_review: 'Under review',
    closed: 'Closed',
    cancelled: 'Cancelled',
};

const WAITING_ON_LABELS: Record<string, string> = {
    supplier: 'Supplier',
    internal_team: 'Internal team',
    me: 'Me',
    none: 'None',
};

export default function PriceRequestsShow({
    priceRequest,
    inquiries,
    users,
    projects,
    contacts,
}: Props) {
    const page = usePage<Props>();
    const flash = page.props.flash;
    const can = (page.props.auth.can ?? {}) as Record<string, boolean>;
    const canManagePriceRequests = Boolean(can.managePriceRequests);
    const canManageContacts = Boolean(can.manageContactsDirectory);

    const [inquiryContact, setInquiryContact] = useState('');
    const [inquiryTitle, setInquiryTitle] = useState('');
    const [inquiryAssignedUser, setInquiryAssignedUser] = useState('');
    const [inquiryResponseDue, setInquiryResponseDue] = useState('');
    const [inquiryOpen, setInquiryOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const closeEditor = () => {
        setInquiryOpen(false);
        setErrors({});
        setInquiryContact('');
        setInquiryTitle('');
        setInquiryAssignedUser('');
        setInquiryResponseDue('');
    };

    const submitInquiry = (event: FormEvent) => {
        event.preventDefault();

        if (!inquiryContact) {
            return;
        }

        router.post(
            route('contact-directory.price-requests.inquiries.store', priceRequest.uuid),
            {
                contact_id: inquiryContact,
                title: inquiryTitle,
                assigned_user_id: inquiryAssignedUser || null,
                response_due_date: inquiryResponseDue || null,
                priority: 'normal',
                status: 'open',
            },
            { preserveScroll: true, onStart: () => { setSaving(true); setErrors({}); }, onError: setErrors, onFinish: () => setSaving(false), onSuccess: closeEditor },
        );
    };

    return (
        <AuthenticatedLayout stickyTitle={priceRequest.title}>
            <div className="space-y-6 px-4 py-6 lg:px-8">
                {flash?.success && (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        {flash.success}
                    </div>
                )}

                {canManagePriceRequests && (
                    <div className="flex justify-end">
                        <Button asChild variant="outline">
                            <Link href={route('contact-directory.price-requests.edit', priceRequest.uuid)}>Edit price request</Link>
                        </Button>
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                        {STATUS_LABELS[priceRequest.status] ?? priceRequest.status}
                    </Badge>
                    <Badge variant="outline">{priceRequest.currency}</Badge>
                    {priceRequest.required_by && (
                        <Badge variant="outline">Required by {formatDate(priceRequest.required_by)}</Badge>
                    )}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Project
                            </span>
                            {priceRequest.project ? (
                                <Link
                                    href={route('admin.projects.show', priceRequest.project.uuid)}
                                    className="text-foreground underline-offset-4 hover:underline"
                                >
                                    {priceRequest.project.name}
                                </Link>
                            ) : (
                                'No project'
                            )}
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Owner
                            </span>
                            {priceRequest.owner?.name ?? '—'}
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Open supplier inquiries
                            </span>
                            {inquiries.data.filter(
                                (inquiry) => !['closed', 'cancelled'].includes(inquiry.status),
                            ).length}{' '}
                            of {inquiries.total}
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Preferred quote
                            </span>
                            {priceRequest.preferred_quote_selection?.supplier_quote ? (
                                <span>
                                    Revision{' '}
                                    {
                                        priceRequest.preferred_quote_selection.supplier_quote
                                            .revision_number
                                    }{' '}
                                    · selected{' '}
                                    {new Date(
                                        priceRequest.preferred_quote_selection.selected_at,
                                    ).toLocaleDateString([], {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </span>
                            ) : (
                                'No preferred quote selected'
                            )}
                        </div>
                        {priceRequest.description && (
                            <div className="sm:col-span-2 lg:col-span-4">
                                <span className="block text-xs uppercase text-muted-foreground">
                                    Description
                                </span>
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                    {priceRequest.description}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Tabs defaultValue="items">
                    <TabsList className="flex-wrap">
                        <TabsTrigger value="items">Requested items</TabsTrigger>
                        <TabsTrigger value="inquiries">Supplier inquiries</TabsTrigger>
                        <TabsTrigger value="comparison">Quote comparison</TabsTrigger>
                    </TabsList>

                    <TabsContent value="items" className="mt-4 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Requested line items</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {priceRequest.items.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        No requested line items have been added yet.
                                    </p>
                                )}
                                {priceRequest.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-md border border-border px-3 py-2"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-medium">{item.description}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {Number(item.quantity)} {item.unit_of_measure}
                                            </p>
                                        </div>
                                        {item.specifications && (
                                            <p className="text-xs text-muted-foreground">
                                                Specifications: {item.specifications}
                                            </p>
                                        )}
                                        {item.notes && (
                                            <p className="text-xs text-muted-foreground">
                                                Notes: {item.notes}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="inquiries" className="mt-4 space-y-4">
                        {inquiries.data.length === 0 && (
                            <Card>
                                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                    No supplier inquiries have been sent for this price request
                                    yet.
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
                                            <Badge variant="secondary">{inquiry.status}</Badge>
                                            {inquiry.waiting_on && inquiry.waiting_on !== 'none' && (
                                                <Badge variant="outline">
                                                    Waiting on{' '}
                                                    {WAITING_ON_LABELS[inquiry.waiting_on]}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <CardDescription>
                                        {inquiry.contact
                                            ? `${inquiry.contact.first_name} ${inquiry.contact.last_name ?? ''} · `
                                            : ''}
                                        {inquiry.response_due_date
                                            ? `Response due ${inquiry.response_due_date}`
                                            : 'No response due date'}
                                        {inquiry.pending_follow_ups_count > 0
                                            ? ` · ${inquiry.pending_follow_ups_count} pending follow-ups`
                                            : ''}
                                        {inquiry.current_quote
                                            ? ` · Current quote: ${inquiry.current_quote.currency} ${Number(
                                                  inquiry.current_quote.grand_total,
                                              ).toLocaleString(undefined, {
                                                  minimumFractionDigits: 2,
                                              })} (rev ${inquiry.current_quote.revision_number})`
                                            : ' · No quote recorded'}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        ))}

                        {canManageContacts && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Add a supplier inquiry
                                    </CardTitle>
                                    {!inquiryOpen && <div><Button type="button" onClick={() => setInquiryOpen(true)}>New supplier inquiry</Button></div>}
                                </CardHeader>
                                {inquiryOpen && <CardContent>
                                    <form
                                        id="directory-supplier-inquiry-form"
                                        onSubmit={submitInquiry}
                                        className="grid min-w-0 gap-5 pr-4 pb-28 sm:grid-cols-2 sm:pr-20 lg:pb-6"
                                    >
                                        <FormActionFab form="directory-supplier-inquiry-form" cancelHref={route('contact-directory.price-requests.show', priceRequest.uuid)} saveLabel="Add supplier inquiry" onCancel={closeEditor} disabled={saving} />
                                        {Object.keys(errors).length > 0 && <div role="alert" className="text-sm text-destructive sm:col-span-2">{Object.values(errors).join(' ')}</div>}
                                        <SimpleSelect
                                            label="Contact"
                                            value={inquiryContact}
                                            onChange={setInquiryContact}
                                            options={contacts.map((contact) => ({
                                                value: String(contact.id),
                                                label: `${contact.first_name} ${contact.last_name ?? ''}`,
                                            }))}
                                            placeholder="Select a contact"
                                            required
                                        />
                                        <div>
                                            <label htmlFor="supplier-inquiry-title" className="mb-2 block text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                                Title
                                            </label>
                                            <TextInput
                                                id="supplier-inquiry-title"
                                                className="h-11 w-full min-w-0 border-border"
                                                value={inquiryTitle}
                                                onChange={(event) =>
                                                    setInquiryTitle(event.target.value)
                                                }
                                                required
                                            />
                                        </div>
                                        <SimpleSelect
                                            label="Assigned user"
                                            value={inquiryAssignedUser}
                                            onChange={setInquiryAssignedUser}
                                            options={users.map((user) => ({
                                                value: String(user.id),
                                                label: user.name,
                                            }))}
                                            placeholder="Select a user"
                                        />
                                        <div>
                                            <label htmlFor="supplier-inquiry-response-due" className="mb-2 block text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                                Response due
                                            </label>
                                            <TextInput
                                                id="supplier-inquiry-response-due"
                                                className="h-11 w-full min-w-0 border-border"
                                                type="date"
                                                value={inquiryResponseDue}
                                                onChange={(event) =>
                                                    setInquiryResponseDue(event.target.value)
                                                }
                                            />
                                        </div>
                                    </form>
                                </CardContent>}
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="comparison" className="mt-4 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Quote comparison</CardTitle>
                                <CardDescription>
                                    Compare the current quote revision from each supplier
                                    inquiry on this price request.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {canManagePriceRequests ? (
                                    <Button asChild>
                                        <Link
                                            href={route('contact-directory.price-requests.compare-quotes', priceRequest.uuid)}
                                        >
                                            Compare quotes
                                        </Link>
                                    </Button>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        You do not have permission to compare quotes.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AuthenticatedLayout>
    );
}
