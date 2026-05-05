import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Head, Link, router } from '@inertiajs/react';
import {
    BriefcaseIcon,
    EditIcon,
    PlusIcon,
    SearchIcon,
    UserRoundIcon,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { CustomersPaginator } from './types';

type IndexProps = {
    filters: {
        search?: string;
    };
    customers: CustomersPaginator;
};

export default function Index({ filters, customers }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.customers.index'),
            { search },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const paginationLabel = (label: string) =>
        label
            .replace('&laquo; Previous', 'Previous')
            .replace('Next &raquo;', 'Next');

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">Customers</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Customers
                        </h2>
                    </div>

                    <Button asChild>
                        <Link href={route('admin.customers.create')}>
                            <PlusIcon className="size-4" />
                            Add customer
                        </Link>
                    </Button>
                </div>
            }
        >
            <Head title="Customers" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserRoundIcon className="size-4 text-muted-foreground" />
                                    Total customers
                                </CardTitle>
                                <CardDescription>
                                    Current customer records in the system.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {customers.total}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Customer directory</CardTitle>
                                <CardDescription>
                                    Search, review, add, and update customer
                                    records.
                                </CardDescription>
                            </div>
                            <form
                                onSubmit={submit}
                                className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
                            >
                                <div className="relative">
                                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search customers"
                                        className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
                                    />
                                </div>
                                <Button type="submit" variant="outline">
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-hidden rounded-lg border border-border">
                                <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                                    <div>Customer</div>
                                    <div>Email</div>
                                    <div>Phone</div>
                                    <div>Project</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {customers.data.length > 0 ? (
                                    customers.data.map((customer) => {
                                        const primaryContact =
                                            customer.contacts.find(
                                                (contact) =>
                                                    contact.is_primary,
                                            ) ?? customer.contacts[0];

                                        return (
                                            <div
                                                key={customer.id}
                                                className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center md:gap-4"
                                            >
                                            <div>
                                                <p className="font-medium text-foreground">
                                                    {customer.name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {customer.company_name ||
                                                        customer.uuid}
                                                </p>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {primaryContact?.email ||
                                                    'Not added'}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {primaryContact?.phone_number ||
                                                    'Not added'}
                                            </div>
                                            <div>
                                                {customer.project ? (
                                                    <Badge variant="outline">
                                                        <BriefcaseIcon className="size-3" />
                                                        {customer.project.name}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary">
                                                        No project
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2 md:justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link
                                                        href={route(
                                                            'admin.customers.edit',
                                                            customer.id,
                                                        )}
                                                    >
                                                        <EditIcon className="size-4" />
                                                        Edit
                                                    </Link>
                                                </Button>
                                            </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="px-4 py-12 text-center">
                                        <UserRoundIcon className="mx-auto size-10 text-muted-foreground" />
                                        <p className="mt-3 font-medium">
                                            No customers found
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Try another search or create the
                                            first customer.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Showing {customers.from ?? 0} to{' '}
                                    {customers.to ?? 0} of {customers.total}{' '}
                                    customers
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {customers.links.length > 3 &&
                                        customers.links.map((link, index) =>
                                            link.url ? (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant={
                                                        link.active
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link href={link.url}>
                                                        {paginationLabel(
                                                            link.label,
                                                        )}
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant="outline"
                                                    size="sm"
                                                    disabled
                                                >
                                                    {paginationLabel(
                                                        link.label,
                                                    )}
                                                </Button>
                                            ),
                                        )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

