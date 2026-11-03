import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
import type { PageProps } from '@/types';
import { BuildingIcon, MailIcon, MapPinIcon, PhoneIcon, PlusIcon, SearchIcon } from 'lucide-react';
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
    headquarters?: { city: string | null; state: string | null; country: string | null } | null;
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
                <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3 rounded-lg border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/30">
                    <div className="min-w-0 flex-1 basis-64">
                        <label className="mb-1 block text-sm font-medium text-sky-700 dark:text-sky-300">
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
                        className="w-[170px]"
                    />
                    <Button type="submit" className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700"><SearchIcon className="size-4" aria-hidden="true" />Search</Button>
                </form>

                <div className="overflow-hidden rounded-lg border border-emerald-200 bg-card dark:border-emerald-900">
                    <div className="flex items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                            <BuildingIcon className="size-4" aria-hidden="true" />
                            Companies
                        </h3>
                        <span className="text-xs text-emerald-800 dark:text-emerald-300">{companies.total} total</span>
                    </div>

                    {companies.data.length === 0 ? (
                        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No companies match these filters.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            <li className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.6fr)_6rem_7rem] gap-4 bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                                <span>Company</span>
                                <span>Headquarters</span>
                                <span>Phone</span>
                                <span>Email</span>
                                <span>Contacts</span>
                                <span className="text-right">Actions</span>
                            </li>
                            {companies.data.map((company) => {
                                const place = company.headquarters ?? company;
                                const location = [place.city, place.state, place.country].filter(Boolean).join(', ');
                                const phone = company.primary_phone;

                                return (
                                    <li
                                        key={company.id}
                                        className="grid min-w-0 items-center gap-x-4 gap-y-2 px-4 py-3 [overflow-wrap:anywhere] hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.6fr)_6rem_7rem]"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Link
                                                    href={route('contact-directory.companies.show', company.uuid)}
                                                    className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                                                >
                                                    {company.name}
                                                </Link>
                                                {!company.is_active && <Badge variant="outline">Inactive</Badge>}
                                            </div>
                                            {company.website && (
                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{company.website}</p>
                                            )}
                                        </div>
                                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <MapPinIcon className="size-3.5 shrink-0 text-sky-600 dark:text-sky-300 lg:hidden" aria-hidden="true" />
                                            {location || <span className="hidden lg:inline">—</span>}
                                        </p>
                                        <div className="text-sm">
                                            {phone ? (
                                                <a className="flex items-center gap-1.5 text-muted-foreground hover:underline" href={`tel:${phone.phone_number}${phone.extension ? `;ext=${phone.extension}` : ''}`}>
                                                    <PhoneIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-300 lg:hidden" aria-hidden="true" />
                                                    {formatPhoneDisplay(phone.phone_number, phone.country)}{phone.extension ? ` ext. ${phone.extension}` : ''}
                                                </a>
                                            ) : (
                                                <span className="hidden text-muted-foreground lg:inline">—</span>
                                            )}
                                        </div>
                                        <div className="min-w-0 text-sm">
                                            {company.primary_email ? (
                                                <a className="flex items-center gap-1.5 break-all text-muted-foreground hover:underline" href={`mailto:${company.primary_email.email_address}`}>
                                                    <MailIcon className="size-3.5 shrink-0 text-violet-600 dark:text-violet-300 lg:hidden" aria-hidden="true" />
                                                    {company.primary_email.email_address}
                                                </a>
                                            ) : (
                                                <span className="hidden text-muted-foreground lg:inline">—</span>
                                            )}
                                        </div>
                                        <div>
                                            <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                                                {company.contacts_count} contact{company.contacts_count === 1 ? '' : 's'}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-start gap-2 lg:justify-end">
                                            <RecordActionLink href={route('contact-directory.companies.show', company.uuid)} label={`View ${company.name}`} action="view" />
                                            {auth.can.manageContactsDirectory && <RecordActionLink href={route('contact-directory.companies.edit', company.uuid)} label={`Edit ${company.name}`} action="edit" />}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {companies.last_page > 1 && (
                        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                            <Button type="button" variant="outline" size="sm" disabled={companies.current_page <= 1} onClick={() => applyFilters({ page: String(companies.current_page - 1) })}>
                                Previous
                            </Button>
                            <span>Page {companies.current_page} of {companies.last_page}</span>
                            <Button type="button" variant="outline" size="sm" disabled={companies.current_page >= companies.last_page} onClick={() => applyFilters({ page: String(companies.current_page + 1) })}>
                                Next
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
