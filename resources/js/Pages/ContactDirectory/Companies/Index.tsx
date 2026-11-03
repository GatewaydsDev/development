import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
import type { PageProps } from '@/types';
import { PlusIcon, SearchIcon } from 'lucide-react';
import RecordActionLink from '@/Components/ContactDirectory/RecordActionLink';
import { formatPhoneDisplay } from '@/lib/phoneFormatting';

type Company = {
    id: number;
    uuid: string;
    name: string;
    website: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    is_active: boolean;
    contacts_count: number;
    primary_phone?: { phone_number: string; extension: string | null; country?: string | null } | null;
    primary_email?: { email_address: string } | null;
};

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Props = PageProps<{
    filters: { search?: string; is_active?: string };
    companies: Paginated<Company>;
}>;

export default function CompaniesIndex({ filters, companies, auth }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');

    const applyFilters = (updates: Record<string, string | undefined>) => {
        router.get(
            route('contact-directory.companies.index'),
            { ...filters, ...updates },
            { preserveState: true, replace: true },
        );
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        applyFilters({ search });
    };

    return (
        <AuthenticatedLayout fullWidth stickyTitle="Companies" header={<div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">Companies</h2><p className="mt-1 text-sm text-muted-foreground">Manage companies, their contact details and linked people.</p></div>
            {auth.can.manageContactsDirectory && <Button asChild variant="create"><Link href={route('contact-directory.companies.create')}><PlusIcon className="size-4" aria-hidden="true" />New company</Link></Button>}
        </div>}>
            <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
                    <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-sm font-medium text-foreground">
                            Search
                        </label>
                        <TextInput
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search companies, phone numbers or emails"
                            aria-label="Search companies"
                            className="h-11 w-full"
                        />
                    </div>
                    <SimpleSelect
                        label="Active status"
                        value={filters.is_active ?? ''}
                        options={[
                            { value: '1', label: 'Active only' },
                            { value: '0', label: 'Inactive only' },
                        ]}
                        placeholder="All statuses"
                        onChange={(value) => applyFilters({ is_active: value })}
                        className="w-[150px]"
                    />
                    <Button type="submit" className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700"><SearchIcon className="size-4" aria-hidden="true" />Search</Button>
                </form>

                <div className="space-y-4">
                    {companies.data.length === 0 && (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                No companies match these filters.
                            </CardContent>
                        </Card>
                    )}
                    {companies.data.map((company) => (
                        <Card key={company.id}>
                            <CardContent className="min-w-0 space-y-2 py-4 [overflow-wrap:anywhere]">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Link
                                        href={route('contact-directory.companies.show', company.uuid)}
                                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                                    >
                                        {company.name}
                                    </Link>
                                    <div className="flex gap-2">
                                        <RecordActionLink href={route('contact-directory.companies.show', company.uuid)} label={`View ${company.name}`} action="view" />
                                        {auth.can.manageContactsDirectory && <RecordActionLink href={route('contact-directory.companies.edit', company.uuid)} label={`Edit ${company.name}`} action="edit" />}
                                        <Badge variant={company.is_active ? 'default' : 'outline'}>
                                            {company.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                        <Badge variant="secondary">
                                            {company.contacts_count} contact
                                            {company.contacts_count === 1 ? '' : 's'}
                                        </Badge>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {company.website ? `${company.website} · ` : ''}
                                    {company.city ?? ''}
                                    {company.state ? `, ${company.state}` : ''}
                                    {company.country ? `, ${company.country}` : ''}
                                </p>
                                {(company.primary_phone || company.primary_email) && <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-sm">
                                    {company.primary_phone && <a className="break-all text-muted-foreground hover:underline" href={`tel:${company.primary_phone.phone_number}${company.primary_phone.extension ? `;ext=${company.primary_phone.extension}` : ''}`}>{formatPhoneDisplay(company.primary_phone.phone_number, company.primary_phone.country)}{company.primary_phone.extension ? ` ext. ${company.primary_phone.extension}` : ''}</a>}
                                    {company.primary_email && <a className="break-all text-muted-foreground hover:underline" href={`mailto:${company.primary_email.email_address}`}>{company.primary_email.email_address}</a>}
                                </div>}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
