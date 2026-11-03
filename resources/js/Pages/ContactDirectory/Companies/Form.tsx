import ContactMethodFields, { contactMethodsPayload, emailRows, phoneRow, withPrimary, type PhoneRecord, type EmailRecord } from '@/Components/ContactDirectory/ContactMethodFields';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import FormSection from '@/Components/ContactDirectory/FormSection';
import { Building2Icon, MapPinIcon, NotebookPenIcon } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

type Company = {
    id: number; uuid: string; name: string; website: string | null;
    address_line_1: string | null; address_line_2: string | null;
    city: string | null; state: string | null; postal_code: string | null; country: string | null;
    notes: string | null; is_active: boolean; phone_numbers: PhoneRecord[]; email_addresses: EmailRecord[];
};

export default function CompanyForm({ company }: PageProps<{ company: Company | null }>) {
    const editing = company !== null;
    const cancelHref = company ? route('contact-directory.companies.show', company.uuid) : route('contact-directory.companies.index');
    const form = useForm({
        name: company?.name ?? '', website: company?.website ?? '',
        address_line_1: company?.address_line_1 ?? '', address_line_2: company?.address_line_2 ?? '',
        city: company?.city ?? '', state: company?.state ?? '', postal_code: company?.postal_code ?? '', country: company?.country ?? '',
        notes: company?.notes ?? '', is_active: company?.is_active ?? true,
        phones: withPrimary(company?.phone_numbers.map(phoneRow) ?? []),
        emails: emailRows(company?.email_addresses ?? []),
    });
    const errors = form.errors as Record<string, string | undefined>;
    const inputClass = 'h-11 w-full min-w-0 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const labelClass = 'text-foreground';
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform(({ phones, emails, ...data }) => ({ ...data, ...contactMethodsPayload(phones, emails) }));
        const options = { onError: () => requestAnimationFrame(() => document.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })) };
        if (company) form.patch(route('contact-directory.companies.update', company.uuid), options);
        else form.post(route('contact-directory.companies.store'), options);
    };
    return (
        <AuthenticatedLayout fullWidth header={<div>
            <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>People</span><span>/</span><Link href={route('contact-directory.companies.index')} className="hover:text-foreground">Companies</Link><span>/</span><span className="text-foreground">{editing ? 'Edit' : 'Add new'}</span>
            </nav>
            <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">{editing ? 'Edit company' : 'Add new company'}</h2>
        </div>}>
            <Head title={company ? `Edit ${company.name}` : 'Add company'} />
            <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                        <form id="directory-company-form" onSubmit={submit} className="flex w-full min-w-0 max-w-full flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6">
                            <FormActionFab form="directory-company-form" cancelHref={cancelHref} saveLabel={editing ? 'Save changes' : 'Create company'} disabled={form.processing} />
                            {Object.keys(errors).length > 0 && <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">Please correct the highlighted fields before saving.</div>}
                            <FormSection title="Company information" description="Save the company’s details, then add its phone numbers and email addresses below." icon={Building2Icon}>
                            <div className="grid min-w-0 gap-5 md:grid-cols-2">
                                <div className="space-y-2"><InputLabel htmlFor="company-name" value="Company name" className={labelClass} />
                                    <TextInput id="company-name" required maxLength={255} isFocused value={form.data.name} className={inputClass} onChange={(event) => form.setData('name', event.target.value)} /><InputError message={errors.name} />
                                </div>
                                <div className="space-y-2"><InputLabel htmlFor="company-website" value="Website (optional)" className={labelClass} />
                                    <TextInput id="company-website" type="url" maxLength={255} placeholder="https://example.com" value={form.data.website} className={inputClass} onChange={(event) => form.setData('website', event.target.value)} /><InputError message={errors.website} />
                                </div>
                            </div>
                            </FormSection>
                            <ContactMethodFields phones={form.data.phones} emails={form.data.emails} setRows={(field, rows) => form.setData(field, rows)} errors={errors} />
                            <FormSection title="Company address" icon={MapPinIcon} tone="violet">
                            <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                {([
                                    ['address_line_1', 'Address line 1 (optional)', 'street-address'],
                                    ['address_line_2', 'Address line 2 (optional)', 'address-line2'],
                                    ['city', 'City (optional)', 'address-level2'],
                                    ['state', 'State / province (optional)', 'address-level1'],
                                    ['postal_code', 'Postal code (optional)', 'postal-code'],
                                    ['country', 'Address country (optional)', 'country-name'],
                                ] as const).map(([field, label, autoComplete]) => <div key={field} className="space-y-2">
                                    <InputLabel htmlFor={`company-${field}`} value={label} className={labelClass} />
                                    <TextInput id={`company-${field}`} maxLength={255} autoComplete={autoComplete} value={form.data[field]} className={inputClass} onChange={(event) => form.setData(field, event.target.value)} /><InputError message={errors[field]} />
                                </div>)}
                            </div>
                            </FormSection>
                            <FormSection title="Notes and status" icon={NotebookPenIcon}>
                            <div className="space-y-2"><InputLabel htmlFor="company-notes" value="Notes (optional)" className={labelClass} />
                                <textarea id="company-notes" className={`${inputClass} min-h-24 py-3`} value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} /><InputError message={errors.notes} />
                            </div>
                            <label className="mt-4 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" className="accent-emerald-600" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />Active company</label>
                            <InputError message={errors.is_active} />
                            </FormSection>
                        </form>
            </div>
        </AuthenticatedLayout>
    );
}
