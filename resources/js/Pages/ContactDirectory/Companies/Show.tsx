import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import type { PageProps } from '@/types';
import type { AddressRecord } from '@/Pages/ContactDirectory/Companies/Form';
import type { PhoneRecord, EmailRecord } from '@/Components/ContactDirectory/ContactMethodFields';
import { Building2Icon, MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react';
import RecordActionLink from '@/Components/ContactDirectory/RecordActionLink';
import { formSectionColors } from '@/Components/ContactDirectory/FormSection';
import { notesToHtml } from '@/lib/notesHtml';
import { formatPhoneDisplay } from '@/lib/phoneFormatting';

type Contact = {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string | null;
    job_title: string | null;
    contact_type: string;
    is_active: boolean;
    primary_phone?: { phone_number: string; extension: string | null; country?: string | null } | null;
    primary_email?: { email_address: string } | null;
};

type Company = {
    id: number;
    uuid: string;
    name: string;
    website: string | null;
    addresses: AddressRecord[];
    notes: string | null;
    is_active: boolean;
    phone_numbers: PhoneRecord[];
    email_addresses: EmailRecord[];
};

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Props = PageProps<{
    company: Company & { contacts_count: number };
    contacts: Paginated<Contact>;
}>;

export default function CompaniesShow({ company, contacts, auth }: Props) {
    return (
        <AuthenticatedLayout fullWidth stickyTitle={company.name} header={<div>
            <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground"><Link href={route('contact-directory.companies.index')} className="transition hover:text-foreground">Companies</Link><span>/</span><span className="text-foreground">Details</span></nav>
            <h2 className="break-words text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">{company.name}</h2>
        </div>}>
            <Head title={company.name} />
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <div className="flex flex-wrap gap-2">
                    {auth.can.manageContactsDirectory && <RecordActionLink href={route('contact-directory.companies.edit', company.uuid)} label="Edit company" action="edit" compact={false} />}
                    <Badge variant={company.is_active ? 'default' : 'outline'}>
                        {company.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="secondary">
                        {company.contacts_count} contact
                        {company.contacts_count === 1 ? '' : 's'}
                    </Badge>
                </div>

                <Card className={formSectionColors.emerald}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><Building2Icon className="size-5" aria-hidden="true" />Company details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid min-w-0 gap-3 text-sm [overflow-wrap:anywhere] sm:grid-cols-2">
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Website
                            </span>
                            {company.website ? (
                                <a
                                    href={company.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-foreground underline-offset-4 hover:underline"
                                >
                                    {company.website}
                                </a>
                            ) : (
                                '—'
                            )}
                        </div>
                        {company.notes && (
                            <div className="sm:col-span-2">
                                <span className="block text-xs uppercase text-muted-foreground">
                                    Notes
                                </span>
                                <div className="rich-text-content text-muted-foreground" dangerouslySetInnerHTML={{ __html: notesToHtml(company.notes) }} />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className={formSectionColors.violet}>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MapPinIcon className="size-5" aria-hidden="true" />Addresses</CardTitle></CardHeader>
                    <CardContent className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {company.addresses.length === 0 && <p className="text-sm text-muted-foreground">No addresses added yet.</p>}
                        {company.addresses.map((address) => <div key={address.id} className="min-w-0 rounded-md border border-border bg-background/60 p-3 text-sm [overflow-wrap:anywhere]">
                            {address.name && <p className="mb-1 font-semibold text-foreground">{address.name}</p>}
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">{address.type?.name ?? 'Address'}</Badge>
                                {address.is_headquarters && <Badge>Headquarters</Badge>}
                            </div>
                            {address.address_line_1 && <p>{address.address_line_1}</p>}
                            {address.address_line_2 && <p>{address.address_line_2}</p>}
                            <p className="text-muted-foreground">{[address.city, [address.state, address.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
                            {address.country && <p className="text-muted-foreground">{address.country}</p>}
                        </div>)}
                    </CardContent>
                </Card>

                <section className="grid min-w-0 gap-5 xl:grid-cols-2" aria-label="Company contact details">
                    <Card className={`min-w-0 ${formSectionColors.sky}`}>
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><PhoneIcon className="size-5" aria-hidden="true" />Company phone numbers</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {company.phone_numbers.length === 0 && <p className="text-sm text-muted-foreground">No company phone numbers added yet.</p>}
                            {company.phone_numbers.map((phone) => <div key={phone.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                                <div className="min-w-0"><a href={`tel:${phone.phone_number}${phone.extension ? `;ext=${phone.extension}` : ''}`} className="break-all text-foreground hover:underline">{formatPhoneDisplay(phone.phone_number, phone.country)}{phone.extension ? ` ext. ${phone.extension}` : ''}</a><p className="text-xs text-muted-foreground">{phone.label}</p></div>
                                {phone.is_primary && <Badge variant="secondary">Primary</Badge>}
                            </div>)}
                        </CardContent>
                    </Card>
                    <Card className={`min-w-0 ${formSectionColors.amber}`}>
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MailIcon className="size-5" aria-hidden="true" />Company email addresses</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {company.email_addresses.length === 0 && <p className="text-sm text-muted-foreground">No company email addresses added yet.</p>}
                            {company.email_addresses.map((email) => <div key={email.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                                <div className="min-w-0"><a href={`mailto:${email.email_address}`} className="break-all text-foreground hover:underline">{email.email_address}</a><p className="text-xs text-muted-foreground">{email.label}</p></div>
                                {email.is_primary && <Badge variant="secondary">Primary</Badge>}
                            </div>)}
                        </CardContent>
                    </Card>
                </section>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Contacts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {contacts.data.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No contacts are linked to this company yet.
                            </p>
                        )}
                        {contacts.data.map((contact) => (
                            <div
                                key={contact.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                            >
                                <Link
                                    href={route('contact-directory.contacts.show', contact.uuid)}
                                    className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                                >
                                    {contact.first_name} {contact.last_name ?? ''}
                                </Link>
                                <div className="flex flex-wrap items-center gap-2">
                                    {contact.primary_email && (
                                        <a
                                            href={`mailto:${contact.primary_email.email_address}`}
                                            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                                        >
                                            {contact.primary_email.email_address}
                                        </a>
                                    )}
                                    {contact.primary_phone && (
                                        <a
                                            href={`tel:${contact.primary_phone.phone_number}`}
                                            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                                        >
                                            {formatPhoneDisplay(contact.primary_phone.phone_number, contact.primary_phone.country)}
                                        </a>
                                    )}
                                    <Badge variant="secondary">{contact.contact_type}</Badge>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
