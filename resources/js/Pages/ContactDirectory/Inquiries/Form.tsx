import FormActionFab from '@/Components/FormActionFab';
import FormSection from '@/Components/ContactDirectory/FormSection';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import RichTextEditor from '@/Components/RichTextEditor';
import { notesToHtml } from '@/lib/notesHtml';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { CalendarClockIcon, ClipboardListIcon, FileTextIcon } from 'lucide-react';
import type { FormEvent } from 'react';

type EditableInquiry = {
    uuid: string;
    contact_id: number;
    price_request_id: number | null;
    project_id: number | null;
    assigned_user_id: number | null;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    requested_date: string | null;
    response_due_date: string | null;
    supplier_reference_number: string | null;
};

type Props = PageProps<{
    inquiry: EditableInquiry | null;
    defaults: { contact_id?: string; price_request_id?: string };
    contacts: { id: number; first_name: string; last_name: string | null; company?: { name: string } | null }[];
    users: { id: number; name: string }[];
    projects: { id: number; name: string }[];
    priceRequests: { id: number; title: string; project_id: number | null }[];
    statuses: string[];
    priorities: string[];
}>;

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    open: 'Open',
    waiting_for_response: 'Waiting for response',
    response_received: 'Response received',
    closed: 'Closed',
    cancelled: 'Cancelled',
};

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const dateValue = (value?: string | null) => (value ? value.slice(0, 10) : '');

export default function InquiryForm({ auth, inquiry, defaults, contacts, users, projects, priceRequests, statuses, priorities }: Props) {
    const editing = inquiry !== null;
    const form = useForm({
        contact_id: inquiry ? String(inquiry.contact_id) : (defaults.contact_id ?? ''),
        price_request_id: inquiry?.price_request_id ? String(inquiry.price_request_id) : (defaults.price_request_id ?? ''),
        project_id: inquiry?.project_id ? String(inquiry.project_id) : '',
        assigned_user_id: inquiry ? (inquiry.assigned_user_id ? String(inquiry.assigned_user_id) : '') : String(auth.user.id),
        title: inquiry?.title ?? '',
        description: inquiry?.description ?? '',
        priority: inquiry?.priority ?? 'normal',
        status: inquiry?.status ?? 'open',
        requested_date: dateValue(inquiry?.requested_date),
        response_due_date: dateValue(inquiry?.response_due_date),
        supplier_reference_number: inquiry?.supplier_reference_number ?? '',
        return_to_show: true,
    });

    const linkedRequest = priceRequests.find((request) => String(request.id) === form.data.price_request_id);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            price_request_id: data.price_request_id || null,
            // An inquiry linked to a price request must share its project.
            project_id: linkedRequest ? (linkedRequest.project_id ?? null) : (data.project_id || null),
            assigned_user_id: data.assigned_user_id || null,
            description: data.description || null,
            requested_date: data.requested_date || null,
            response_due_date: data.response_due_date || null,
            supplier_reference_number: data.supplier_reference_number || null,
        }));
        const options = {
            onError: () => requestAnimationFrame(() => document.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center' })),
        };
        if (inquiry) form.patch(route('contact-directory.inquiries.update', inquiry.uuid), options);
        else form.post(route('contact-directory.inquiries.store'), options);
    };

    const inputClass = 'h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-foreground focus:border-ring focus:ring-ring';
    const labelClass = 'text-emerald-700 dark:text-emerald-300';
    const cancelHref = inquiry ? route('contact-directory.inquiries.show', inquiry.uuid) : route('contact-directory.inquiries.index');

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span>People</span>
                        <span>/</span>
                        <Link href={route('contact-directory.inquiries.index')} className="transition hover:text-foreground">Inquiries</Link>
                        <span>/</span>
                        <span className="text-foreground">{editing ? 'Edit' : 'Add'}</span>
                    </nav>
                    <h2 className={`text-xl font-semibold leading-tight ${labelClass}`}>{editing ? 'Edit inquiry' : 'New inquiry'}</h2>
                </div>
            }
        >
            <Head title={editing ? 'Edit inquiry' : 'New inquiry'} />
            <div className="py-6 sm:py-8">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <Card className="border-0 bg-transparent p-0 shadow-none ring-0">
                        <CardHeader className="px-0">
                            <CardTitle>Inquiry information</CardTitle>
                            <CardDescription>Track a question or quote request sent to a contact.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-0">
                            <form id="inquiry-form" onSubmit={submit} className="flex w-full min-w-0 flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6">
                                <FormActionFab form="inquiry-form" cancelHref={cancelHref} saveLabel={editing ? 'Save changes' : 'Create inquiry'} disabled={form.processing} />
                                {Object.keys(form.errors).length > 0 && (
                                    <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
                                        Please correct the highlighted fields before saving.
                                    </div>
                                )}

                                <FormSection title="Inquiry details" description="Who it is with and what it is about." icon={ClipboardListIcon} tone="emerald">
                                    <div className="grid min-w-0 gap-5 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="inq-contact" value="Contact" className={labelClass} />
                                            <select id="inq-contact" required className={inputClass} value={form.data.contact_id} onChange={(e) => form.setData('contact_id', e.target.value)}>
                                                <option value="">Choose a contact</option>
                                                {contacts.map((contact) => (
                                                    <option key={contact.id} value={contact.id}>
                                                        {contact.first_name} {contact.last_name}{contact.company ? ` — ${contact.company.name}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <InputError message={form.errors.contact_id} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="inq-title" value="Title" className={labelClass} />
                                            <input id="inq-title" required className={inputClass} value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} placeholder="e.g. Quote for 20 hollow metal doors" />
                                            <InputError message={form.errors.title} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="inq-price-request" value="Price request (optional)" className={labelClass} />
                                            <select id="inq-price-request" className={inputClass} value={form.data.price_request_id} onChange={(e) => form.setData('price_request_id', e.target.value)}>
                                                <option value="">None</option>
                                                {priceRequests.map((request) => <option key={request.id} value={request.id}>{request.title}</option>)}
                                            </select>
                                            <InputError message={form.errors.price_request_id} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="inq-project" value="Project (optional)" className={labelClass} />
                                            {linkedRequest ? (
                                                <p className="flex h-11 items-center text-sm text-muted-foreground">
                                                    {projects.find((project) => project.id === linkedRequest.project_id)?.name ?? 'Uses the price request’s project'}
                                                </p>
                                            ) : (
                                                <select id="inq-project" className={inputClass} value={form.data.project_id} onChange={(e) => form.setData('project_id', e.target.value)}>
                                                    <option value="">No project</option>
                                                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                                                </select>
                                            )}
                                            <InputError message={form.errors.project_id} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="inq-reference" value="Supplier reference # (optional)" className={labelClass} />
                                            <input id="inq-reference" className={inputClass} value={form.data.supplier_reference_number} onChange={(e) => form.setData('supplier_reference_number', e.target.value)} />
                                            <InputError message={form.errors.supplier_reference_number} />
                                        </div>
                                    </div>
                                </FormSection>

                                <FormSection title="Schedule & status" description="Ownership, urgency and dates." icon={CalendarClockIcon} tone="sky">
                                    <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="inq-assignee" value="Assigned to" className={labelClass} />
                                            <select id="inq-assignee" className={inputClass} value={form.data.assigned_user_id} onChange={(e) => form.setData('assigned_user_id', e.target.value)}>
                                                <option value="">Unassigned</option>
                                                {users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.id === auth.user.id ? ' (me)' : ''}</option>)}
                                            </select>
                                            <InputError message={form.errors.assigned_user_id} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="inq-status" value="Status" className={labelClass} />
                                            <select id="inq-status" className={inputClass} value={form.data.status} onChange={(e) => form.setData('status', e.target.value)}>
                                                {statuses.map((status) => <option key={status} value={status}>{STATUS_LABELS[status] ?? cap(status)}</option>)}
                                            </select>
                                            <InputError message={form.errors.status} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="inq-priority" value="Priority" className={labelClass} />
                                            <select id="inq-priority" className={inputClass} value={form.data.priority} onChange={(e) => form.setData('priority', e.target.value)}>
                                                {priorities.map((priority) => <option key={priority} value={priority}>{cap(priority)}</option>)}
                                            </select>
                                            <InputError message={form.errors.priority} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="inq-requested" value="Requested date" className={labelClass} />
                                            <input id="inq-requested" type="date" className={inputClass} value={form.data.requested_date} onChange={(e) => form.setData('requested_date', e.target.value)} />
                                            <InputError message={form.errors.requested_date} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="inq-due" value="Response due" className={labelClass} />
                                            <input id="inq-due" type="date" className={inputClass} value={form.data.response_due_date} onChange={(e) => form.setData('response_due_date', e.target.value)} />
                                            <InputError message={form.errors.response_due_date} />
                                        </div>
                                    </div>
                                </FormSection>

                                <FormSection title="Description" description="Optional context for this inquiry." icon={FileTextIcon} tone="amber">
                                    <RichTextEditor id="inq-description" compact showPlaceholders={false} value={notesToHtml(form.data.description)} onChange={(html) => form.setData('description', html)} error={form.errors.description} />
                                    <InputError message={form.errors.description} />
                                </FormSection>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
