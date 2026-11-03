import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
import type { PageProps } from '@/types';

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
};

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Props = PageProps<{
    filters: { search?: string; is_active?: string };
    companies: Paginated<Company>;
}>;

export default function CompaniesIndex({ filters, companies }: Props) {
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
        <AuthenticatedLayout stickyTitle="Companies">
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-sm font-medium text-foreground">
                            Search
                        </label>
                        <TextInput
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search companies by name, website or city"
                            aria-label="Search companies"
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
                    <Button type="submit">Search</Button>
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
                            <CardContent className="space-y-2 py-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Link
                                        href={route('contact-directory.companies.show', company.uuid)}
                                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                                    >
                                        {company.name}
                                    </Link>
                                    <div className="flex gap-2">
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
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
