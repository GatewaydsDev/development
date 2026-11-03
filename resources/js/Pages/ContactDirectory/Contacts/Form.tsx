import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import ContactMethodFields, { contactMethodsPayload, emailRows, phoneRow, withPrimary } from '@/Components/ContactDirectory/ContactMethodFields';
import TextInput from '@/Components/TextInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

type Option = { id: number; name: string };
type Contact = {
    id: number; uuid: string; first_name: string; last_name: string | null;
    company_id: number | null; job_title: string | null; contact_type: string;
    owner_id: number; notes: string | null; is_active: boolean;
    phone_numbers: { id: number; country: string | null; phone_number: string; label: string; extension: string | null; is_primary: boolean }[];
    email_addresses: { id: number; email_address: string; label: string; is_primary: boolean }[];
};

export default function ContactForm({ contact, companies, users, auth }: PageProps<{
    contact: Contact | null; companies: Option[]; users: Option[];
}>) {
    const editing = contact !== null;
    const title = editing ? `Edit ${contact.first_name} ${contact.last_name ?? ''}`.trim() : 'Add contact';
    const cancelHref = contact ? route('contact-directory.contacts.show', contact.uuid) : route('contact-directory.contacts.index');
    const form = useForm({
        first_name: contact?.first_name ?? '',
        last_name: contact?.last_name ?? '',
        job_title: contact?.job_title ?? '',
        company_id: contact?.company_id ? String(contact.company_id) : '',
        contact_type: contact?.contact_type ?? 'supplier',
        owner_id: String(contact?.owner_id ?? auth.user.id),
        notes: contact?.notes ?? '',
        is_active: contact?.is_active ?? true,
        phones: withPrimary(contact?.phone_numbers.map(phoneRow) ?? []),
        emails: emailRows(contact?.email_addresses ?? []),
    });
    const errors = form.errors as Record<string, string | undefined>;
    const submit = (event: FormEvent) => {
        event.preventDefault();
        // Keep row indexes aligned with server validation. Added rows must be
        // completed or removed rather than silently discarded.
        form.transform(({ phones, emails, ...data }) => ({
            ...data,
            company_id: data.company_id || null,
            ...contactMethodsPayload(phones, emails),
        }));
        const options = { onError: () => requestAnimationFrame(() => document.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })) };
        if (contact) form.patch(route('contact-directory.contacts.update', contact.uuid), options);
        else form.post(route('contact-directory.contacts.store'), options);
    };
    const inputClass = 'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const labelClass = 'text-emerald-700 dark:text-emerald-300';

    return (
        <AuthenticatedLayout header={<div>
            <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>People</span><span>/</span><Link href={route('contact-directory.contacts.index')} className="hover:text-foreground">Contacts</Link><span>/</span><span className="text-foreground">{editing ? 'Edit' : 'Add new'}</span>
            </nav>
            <h2 className={`text-xl font-semibold leading-tight ${labelClass}`}>{editing ? 'Edit contact' : 'Add new contact'}</h2>
        </div>}>
            <Head title={title} />
            <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>{editing ? `${contact.first_name} ${contact.last_name ?? ''}`.trim() : 'Contact information'}</CardTitle>
                        <CardDescription>Save the person’s details and all their phone numbers and email addresses. Choose one primary entry in each list.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form id="directory-contact-form" onSubmit={submit} className="flex w-full min-w-0 max-w-full flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6">
                            <FormActionFab form="directory-contact-form" cancelHref={cancelHref} saveLabel={editing ? 'Save changes' : 'Create contact'} disabled={form.processing} />
                            {Object.keys(errors).length > 0 && <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">Please correct the highlighted fields before saving.</div>}
                            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                {([
                                    ['first_name', 'First name'], ['last_name', 'Last name (optional)'], ['job_title', 'Job title (optional)'],
                                ] as const).map(([field, label]) => <div key={field} className="space-y-2">
                                    <InputLabel htmlFor={`contact-${field}`} value={label} className={labelClass} />
                                    <TextInput id={`contact-${field}`} required={field === 'first_name'} maxLength={255} isFocused={field === 'first_name'} value={form.data[field]} className={inputClass} onChange={(event) => form.setData(field, event.target.value)} />
                                    <InputError message={errors[field]} />
                                </div>)}
                                <div className="space-y-2">
                                    <InputLabel htmlFor="contact-type" value="Contact type" className={labelClass} />
                                    <select id="contact-type" className={inputClass} value={form.data.contact_type} onChange={(event) => form.setData('contact_type', event.target.value)}>
                                        {['supplier', 'customer', 'subcontractor', 'other'].map((type) => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
                                    </select>
                                    <InputError message={errors.contact_type} />
                                </div>
                                <div className="space-y-2">
                                    <InputLabel htmlFor="contact-company" value="Company (optional)" className={labelClass} />
                                    <select id="contact-company" className={inputClass} value={form.data.company_id} onChange={(event) => form.setData('company_id', event.target.value)}>
                                        <option value="">No company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                                    </select>
                                    <InputError message={errors.company_id} />
                                </div>
                                <div className="space-y-2">
                                    <InputLabel htmlFor="contact-owner" value="Contact owner" className={labelClass} />
                                    <select id="contact-owner" required className={inputClass} value={form.data.owner_id} onChange={(event) => form.setData('owner_id', event.target.value)}>
                                        {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                                    </select>
                                    <InputError message={errors.owner_id} />
                                </div>
                            </section>
                            <ContactMethodFields phones={form.data.phones} emails={form.data.emails} setRows={(field, rows) => form.setData(field, rows)} errors={errors} />
                            <div className="space-y-2">
                                <InputLabel htmlFor="contact-notes" value="Notes (optional)" className={labelClass} />
                                <textarea id="contact-notes" className={`${inputClass} min-h-24 py-3`} value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} />
                                <InputError message={errors.notes} />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-foreground">
                                <input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />Active contact
                            </label>
                            <InputError message={errors.is_active} />
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
