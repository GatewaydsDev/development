import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link } from '@inertiajs/react';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import type { PageProps } from '@/types';

type Contact = {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string | null;
    job_title: string | null;
    contact_type: string;
    is_active: boolean;
    primary_phone?: { phone_number: string; extension: string | null } | null;
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
};

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Props = PageProps<{
    company: Company & { contacts_count: number };
    contacts: Paginated<Contact>;
}>;

export default function CompaniesShow({ company, contacts }: Props) {
    return (
        <AuthenticatedLayout stickyTitle={company.name}>
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <div className="flex flex-wrap gap-2">
                    <Badge variant={company.is_active ? 'default' : 'outline'}>
                        {company.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="secondary">
                        {company.contacts_count} contact
                        {company.contacts_count === 1 ? '' : 's'}
                    </Badge>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Company details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
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
                                            {contact.primary_phone.phone_number}
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
