import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import type { PageProps } from '@/types';
import type { PhoneRecord, EmailRecord } from '@/Components/ContactDirectory/ContactMethodFields';
import { Building2Icon, MailIcon, PhoneIcon } from 'lucide-react';
import RecordActionLink from '@/Components/ContactDirectory/RecordActionLink';
import { formSectionColors } from '@/Components/ContactDirectory/FormSection';
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
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
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
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Address
                            </span>
                            {[
                                company.address_line_1,
                                company.address_line_2,
                                company.city,
                                company.state,
                                company.postal_code,
                                company.country,
                            ]
                                .filter(Boolean)
                                .join(', ') || '—'}
                        </div>
                        {company.notes && (
                            <div className="sm:col-span-2">
                                <span className="block text-xs uppercase text-muted-foreground">
                                    Notes
                                </span>
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                    {company.notes}
                                </p>
                            </div>
                        )}
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
