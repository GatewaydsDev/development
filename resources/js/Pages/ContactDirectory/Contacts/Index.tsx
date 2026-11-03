import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CreateContactButton from '@/Components/ContactDirectory/CreateContactButton';
import RecordActionLink from '@/Components/ContactDirectory/RecordActionLink';
import { formatPhoneDisplay } from '@/lib/phoneFormatting';
import { SearchIcon } from 'lucide-react';
import { Link, router } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import TextInput from '@/Components/TextInput';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/Components/ui/table';
import { cn } from '@/lib/utils';
import { type PageProps } from '@/types';

type ContactDirectoryUser = {
    id: number;
    name: string;
};

type ContactDirectoryContact = {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string | null;
    job_title: string | null;
    contact_type: string;
    is_active: boolean;
    company?: { id: number; name: string } | null;
    owner?: { id: number; name: string } | null;
    primary_phone?: {
        country?: string | null;
        phone_number: string;
        extension: string | null;
        label: string;
    } | null;
    primary_email?: { email_address: string; label: string } | null;
    pending_follow_ups_count: number;
    last_activity_at: string | null;
    next_follow_up_at: string | null;
};

type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links?: { url: string | null; label: string; active?: boolean }[];
};

type IndexProps = PageProps & {
    filters: {
        search?: string;
        contact_type?: string;
        owner_id?: string;
        is_active?: string;
        overdue_follow_ups?: boolean;
    };
    contacts: Paginated<ContactDirectoryContact>;
    users: ContactDirectoryUser[];
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
    supplier: 'Supplier',
    customer: 'Customer',
    subcontractor: 'Subcontractor',
    other: 'Other',
};

export default function ContactsIndex({ filters, contacts, users, auth }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('contact-directory.contacts.index'),
            { search },
            { preserveState: true, replace: true },
        );
    };

    const applyFilter = (key: string, value: string | boolean) => {
        router.get(
            route('contact-directory.contacts.index'),
            {
                ...filters,
                [key]: value === '' ? undefined : value,
            },
            { preserveState: true, replace: true },
        );
    };

    return (
        <AuthenticatedLayout
            fullWidth
            stickyTitle="Contacts"
            header={<div className="flex flex-wrap items-start justify-between gap-3"><div>
                <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">Contacts</h2>
                <p className="mt-1 text-sm text-muted-foreground">Add a contact, then schedule their next follow-up.</p>
            </div><CreateContactButton /></div>}
        >
            <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
                    <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-sm font-medium text-foreground">
                            Search
                        </label>
                        <TextInput
                            value={search}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                            placeholder="Search by name, company, email or phone"
                            aria-label="Search contacts"
                            className="h-11 w-full"
                        />
                    </div>
                    <SimpleSelect
                        label="Contact type"
                        value={filters.contact_type ?? ''}
                        options={Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => ({
                            value,
                            label,
                        }))}
                        placeholder="All contact types"
                        onChange={(value) => applyFilter('contact_type', value)}
                        className="w-[160px]"
                    />
                    <SimpleSelect
                        label="Owner"
                        value={filters.owner_id ?? ''}
                        options={users.map((user) => ({
                            value: String(user.id),
                            label: user.name,
                        }))}
                        placeholder="All owners"
                        onChange={(value) => applyFilter('owner_id', value)}
                        className="w-[180px]"
                    />
                    <SimpleSelect
                        label="Active status"
                        value={filters.is_active ?? ''}
                        options={[
                            { value: '1', label: 'Active only' },
                            { value: '0', label: 'Inactive only' },
                        ]}
                        placeholder="All statuses"
                        onChange={(value) => applyFilter('is_active', value)}
                        className="w-[150px]"
                    />
                    <Button type="submit" className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700"><SearchIcon className="size-4" aria-hidden="true" />Search</Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            applyFilter(
                                'overdue_follow_ups',
                                filters.overdue_follow_ups ? '' : '1',
                            )
                        }
                    >
                        {filters.overdue_follow_ups
                            ? 'Clear overdue filter'
                            : 'Overdue follow-ups'}
                    </Button>
                </form>

                <div className="w-full overflow-x-auto rounded-lg border border-border bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Primary email</TableHead>
                                <TableHead>Primary phone</TableHead>
                                <TableHead>Owner</TableHead>
                                <TableHead>Last activity</TableHead>
                                <TableHead>Next follow-up</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contacts.data.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={9}
                                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                                    >
                                        No contacts yet. Create a supplier company and contact
                                        to start logging quotes and follow-ups.
                                    </TableCell>
                                </TableRow>
                            )}
                            {contacts.data.map((contact) => (
                                <TableRow key={contact.id}>
                                    <TableCell className="font-medium">
                                        <Link
                                            href={route('contact-directory.contacts.show', contact.uuid)}
                                            className="text-foreground underline-offset-4 hover:underline"
                                        >
                                            {contact.first_name}{' '}
                                            {contact.last_name ?? ''}
                                        </Link>
                                        {contact.job_title && (
                                            <div className="text-xs text-muted-foreground">
                                                {contact.job_title}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {CONTACT_TYPE_LABELS[contact.contact_type] ??
                                                contact.contact_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {contact.company?.name ?? '—'}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {contact.primary_email ? (
                                            <a
                                                href={`mailto:${contact.primary_email.email_address}`}
                                                className="text-foreground underline-offset-4 hover:underline"
                                            >
                                                {contact.primary_email.email_address}
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {contact.primary_phone ? (
                                            <a
                                                href={`tel:${contact.primary_phone.phone_number}`}
                                                className="text-foreground underline-offset-4 hover:underline"
                                            >
                                                {formatPhoneDisplay(contact.primary_phone.phone_number, contact.primary_phone.country)}
                                                {contact.primary_phone.extension
                                                    ? ` x${contact.primary_phone.extension}`
                                                    : ''}
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {contact.owner?.name ?? '—'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {contact.last_activity_at
                                            ? new Date(contact.last_activity_at).toLocaleString(
                                                  [],
                                                  {
                                                      month: 'short',
                                                      day: 'numeric',
                                                      year: 'numeric',
                                                      hour: 'numeric',
                                                      minute: '2-digit',
                                                  },
                                              )
                                            : '—'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {contact.next_follow_up_at ? (
                                            <span
                                                className={cn(
                                                    new Date(contact.next_follow_up_at) <
                                                        new Date() &&
                                                        'font-semibold text-destructive',
                                                )}
                                            >
                                                {new Date(contact.next_follow_up_at).toLocaleString(
                                                    [],
                                                    {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                    },
                                                )}
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <RecordActionLink href={route('contact-directory.contacts.show', contact.uuid)} label={`View ${contact.first_name} ${contact.last_name ?? ''}`.trim()} action="view" />
                                            {auth.can.manageContactsDirectory && <RecordActionLink href={route('contact-directory.contacts.edit', contact.uuid)} label={`Edit ${contact.first_name} ${contact.last_name ?? ''}`.trim()} action="edit" />}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {contacts.last_page > 1 && (
                    <nav
                        className="flex items-center justify-between"
                        aria-label="Contact pagination"
                    >
                        <p className="text-sm text-muted-foreground">
                            Page {contacts.current_page} of {contacts.last_page}
                        </p>
                        <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={route('contact-directory.contacts.index', {
                                        page: Math.max(1, contacts.current_page - 1),
                                        ...filters,
                                    })}
                                    aria-disabled={contacts.current_page === 1}
                                >
                                    Previous
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={route('contact-directory.contacts.index', {
                                        page: Math.min(
                                            contacts.last_page,
                                            contacts.current_page + 1,
                                        ),
                                        ...filters,
                                    })}
                                    aria-disabled={
                                        contacts.current_page === contacts.last_page
                                    }
                                >
                                    Next
                                </Link>
                            </Button>
                        </div>
                    </nav>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
