import ContactMethodFields, { contactMethodsPayload, emailRows, phoneRow, withPrimary, type PhoneRecord, type EmailRecord } from '@/Components/ContactDirectory/ContactMethodFields';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import CreatableSelect from '@/Components/CreatableSelect';
import TextInput from '@/Components/TextInput';
import FormSection from '@/Components/ContactDirectory/FormSection';
import RichTextEditor from '@/Components/RichTextEditor';
import { notesToHtml } from '@/lib/notesHtml';
import { Button } from '@/Components/ui/button';
import { Building2Icon, MapPinIcon, NotebookPenIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export type AddressRecord = {
    id: number; name: string | null; address_type_id: number | null; type?: { id: number; name: string } | null; is_headquarters: boolean;
    address_line_1: string | null; address_line_2: string | null;
    city: string | null; state: string | null; postal_code: string | null; country: string | null;
};

type AddressRow = {
    id?: number; name: string; address_type_id: string; is_headquarters: boolean;
    address_line_1: string; address_line_2: string; city: string; state: string; postal_code: string; country: string;
};

const ADDRESS_FIELDS = [
    ['address_line_1', 'Address line 1', 'street-address'],
    ['address_line_2', 'Address line 2', 'address-line2'],
    ['city', 'City', 'address-level2'],
    ['state', 'State / province', 'address-level1'],
    ['postal_code', 'Postal code', 'postal-code'],
    ['country', 'Country', 'country-name'],
] as const;

const blankAddress = (isHeadquarters: boolean, typeId: string): AddressRow => ({
    name: '', address_type_id: typeId, is_headquarters: isHeadquarters,
    address_line_1: '', address_line_2: '', city: '', state: '', postal_code: '', country: '',
});

type Company = {
    id: number; uuid: string; name: string; website: string | null;
    addresses: AddressRecord[];
    notes: string | null; is_active: boolean; phone_numbers: PhoneRecord[]; email_addresses: EmailRecord[];
};

export default function CompanyForm({ company, addressTypes }: PageProps<{ company: Company | null; addressTypes: { id: number; name: string }[] }>) {
    const editing = company !== null;
    const cancelHref = company ? route('contact-directory.companies.show', company.uuid) : route('contact-directory.companies.index');
    const form = useForm({
        name: company?.name ?? '', website: company?.website ?? '',
        addresses: (company?.addresses ?? []).map((address): AddressRow => ({
            id: address.id, name: address.name ?? '', address_type_id: address.address_type_id ? String(address.address_type_id) : '', is_headquarters: address.is_headquarters,
            address_line_1: address.address_line_1 ?? '', address_line_2: address.address_line_2 ?? '',
            city: address.city ?? '', state: address.state ?? '', postal_code: address.postal_code ?? '', country: address.country ?? '',
        })),
        notes: company?.notes ?? '', is_active: company?.is_active ?? true,
        phones: withPrimary(company?.phone_numbers.map(phoneRow) ?? []),
        emails: emailRows(company?.email_addresses ?? []),
    });
    const errors = form.errors as Record<string, string | undefined>;
    const inputClass = 'h-11 w-full min-w-0 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const labelClass = 'text-foreground';
    const updateAddress = (index: number, changes: Partial<AddressRow>) => form.setData('addresses', form.data.addresses.map((row, i) => (i === index ? { ...row, ...changes } : row)));
    const setMainOffice = (index: number, checked: boolean) => form.setData('addresses', form.data.addresses.map((row, i) => ({ ...row, is_headquarters: i === index ? checked || form.data.addresses.length === 1 : checked ? false : row.is_headquarters })));
    const addAddress = () => form.setData('addresses', [...form.data.addresses, blankAddress(form.data.addresses.length === 0, String(addressTypes.find((type) => type.name === (form.data.addresses.length === 0 ? 'Office' : 'Branch office'))?.id ?? ''))]);
    const removeAddress = (index: number) => form.setData('addresses', form.data.addresses.filter((_, i) => i !== index));
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
                            <div className="-mt-2 mb-3 flex flex-col items-end"><label className="flex items-center gap-2 text-sm font-medium text-foreground"><input type="checkbox" className="accent-emerald-600" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />Active company</label><InputError message={errors.is_active} /></div>
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
                            <FormSection title="Company addresses" description="Add every office or location. Mark one location as the main office." icon={MapPinIcon} tone="violet">
                            <div className="space-y-4">
                                {form.data.addresses.length === 0 && <p className="text-sm text-muted-foreground">No addresses added yet.</p>}
                                {form.data.addresses.map((address, index) => <div key={index} className="min-w-0 rounded-md border border-violet-200 bg-background p-4 dark:border-violet-900">
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="w-56"><CreatableSelect id={`company-address-${index}-type`} label="Office type" value={address.address_type_id} options={addressTypes} optionsProp="addressTypes" createRoute={route('contact-directory.address-types.store')} entityLabel="office type" placeholder="Select or add a type" compact error={errors[`addresses.${index}.address_type_id`]} onChange={(typeId) => updateAddress(index, { address_type_id: typeId })} /></div>
                                            <label className="flex items-center gap-2 text-sm font-medium text-foreground"><input type="checkbox" className="accent-violet-600" checked={address.is_headquarters} onChange={(event) => setMainOffice(index, event.target.checked)} />Main office</label>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => removeAddress(index)}><Trash2Icon className="size-4" aria-hidden="true" />Remove</Button>
                                    </div>
                                    <div className="mb-4 space-y-2"><InputLabel htmlFor={`company-address-${index}-name`} value="Office name" className={labelClass} /><TextInput id={`company-address-${index}-name`} maxLength={255} placeholder="e.g. East Coast Headquarters" value={address.name} className={inputClass} onChange={(event) => updateAddress(index, { name: event.target.value })} /><InputError message={errors[`addresses.${index}.name`]} /></div>
                                    <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        {ADDRESS_FIELDS.map(([field, label, autoComplete]) => <div key={field} className={field === 'postal_code' ? 'space-y-2 md:col-span-1 md:max-w-40' : 'space-y-2'}>
                                            <InputLabel htmlFor={`company-address-${index}-${field}`} value={label} className={labelClass} />
                                            <TextInput id={`company-address-${index}-${field}`} maxLength={255} autoComplete={autoComplete} value={address[field]} className={field === 'postal_code' ? `${inputClass} max-w-32` : inputClass} inputMode={field === 'postal_code' ? 'numeric' : undefined} onChange={(event) => updateAddress(index, { [field]: field === 'postal_code' ? event.target.value.replace(/[^0-9-]/g, '') : event.target.value })} />
                                            <InputError message={errors[`addresses.${index}.${field}`]} />
                                        </div>)}
                                    </div>
                                </div>)}
                                <div className="flex justify-end"><Button type="button" variant="outline" onClick={addAddress}><PlusIcon className="size-4" aria-hidden="true" />Add address</Button></div>
                            </div>
                            </FormSection>
                            <FormSection title="Notes" icon={NotebookPenIcon}>
                            <div className="space-y-2"><InputLabel htmlFor="company-notes" value="Notes (optional)" className={labelClass} />
                                <RichTextEditor id="company-notes" compact showPlaceholders={false} value={notesToHtml(form.data.notes)} onChange={(html) => form.setData('notes', html)} error={errors.notes} /><InputError message={errors.notes} />
                            </div>
                            </FormSection>
                        </form>
            </div>
        </AuthenticatedLayout>
    );
}
