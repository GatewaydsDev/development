import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

type User = { id: number; name: string };

type Project = { id: number; uuid: string; name: string; project_number: string | null };

type PriceRequest = {
    id: number;
    uuid: string;
    title: string;
    description: string | null;
    currency: string;
    required_by: string | null;
    status: string;
    owner?: { id: number; name: string } | null;
    project?: { id: number; name: string } | null;
    inquiries_count: number;
    open_inquiries_count: number;
};

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
              new Date(value),
          )
        : '';

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Props = PageProps<{
    filters: { search?: string; status?: string; project_id?: string; owner_id?: string };
    priceRequests: Paginated<PriceRequest>;
    users: User[];
    projects: Project[];
}>;

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    open: 'Open',
    under_review: 'Under review',
    closed: 'Closed',
    cancelled: 'Cancelled',
};

export default function PriceRequestsIndex({
    filters,
    priceRequests,
    users,
    projects,
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');

    const applyFilters = (updates: Record<string, string | undefined>) => {
        router.get(
            route('contact-directory.price-requests.index'),
            { ...filters, ...updates },
            { preserveState: true, replace: true },
        );
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        applyFilters({ search });
    };

    return (
        <AuthenticatedLayout stickyTitle="Price requests">
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-sm font-medium text-foreground">
                            Search
                        </label>
                        <TextInput
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search price requests by title"
                            aria-label="Search price requests"
                        />
                    </div>
                    <SimpleSelect
                        label="Status"
                        value={filters.status ?? ''}
                        options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
                            value,
                            label,
                        }))}
                        placeholder="All statuses"
                        onChange={(value) => applyFilters({ status: value })}
                        className="w-[160px]"
                    />
                    <SimpleSelect
                        label="Project"
                        value={filters.project_id ?? ''}
                        options={projects.map((project) => ({
                            value: String(project.id),
                            label: project.name,
                        }))}
                        placeholder="All projects"
                        onChange={(value) => applyFilters({ project_id: value })}
                        className="w-[180px]"
                    />
                    <SimpleSelect
                        label="Owner"
                        value={filters.owner_id ?? ''}
                        options={users.map((user) => ({
                            value: String(user.id),
                            label: user.name,
                        }))}
                        placeholder="All owners"
                        onChange={(value) => applyFilters({ owner_id: value })}
                        className="w-[170px]"
                    />
                    <Button type="submit">Search</Button>
                </form>

                <div className="space-y-4">
                    {priceRequests.data.length === 0 && (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                No price requests match these filters.
                            </CardContent>
                        </Card>
                    )}
                    {priceRequests.data.map((priceRequest) => (
                        <Card key={priceRequest.id}>
                            <CardHeader>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardTitle className="text-base">
                                        <Link
                                            href={route('contact-directory.price-requests.show', priceRequest.uuid)}
                                            className="text-foreground underline-offset-4 hover:underline"
                                        >
                                            {priceRequest.title}
                                        </Link>
                                    </CardTitle>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary">
                                            {STATUS_LABELS[priceRequest.status] ?? priceRequest.status}
                                        </Badge>
                                        <Badge variant="outline">{priceRequest.currency}</Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <span className="block text-xs uppercase">Project</span>
                                    {priceRequest.project?.name ?? 'No project'}
                                </div>
                                <div>
                                    <span className="block text-xs uppercase">Owner</span>
                                    {priceRequest.owner?.name ?? '—'}
                                </div>
                                <div>
                                    <span className="block text-xs uppercase">Required by</span>
                                    {priceRequest.required_by ? formatDate(priceRequest.required_by) : 'No date set'}
                                </div>
                                <div>
                                    <span className="block text-xs uppercase">Supplier inquiries</span>
                                    {priceRequest.open_inquiries_count} open of{' '}
                                    {priceRequest.inquiries_count} total
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
