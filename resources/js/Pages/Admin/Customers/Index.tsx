import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ActionHint from '@/Components/ActionHint';
import PaginationNav from '@/Components/PaginationNav';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    BriefcaseIcon,
    EditIcon,
    PlusIcon,
    SearchIcon,
    Trash2Icon,
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
    const { auth } = usePage<PageProps>().props;
    const canCreateCustomers = Boolean(auth.can?.createCustomers);
    const canUpdateCustomers = Boolean(auth.can?.updateCustomers);
    const canDeleteCustomers = Boolean(auth.can?.deleteCustomers);
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

    const destroyCustomer = (customerId: number, companyName: string) => {
        if (!window.confirm(`Delete customer record for ${companyName}?`)) {
            return;
        }

        router.delete(route('admin.customers.destroy', customerId), {
            preserveScroll: true,
        });
    };

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

                    {canCreateCustomers && (
                        <Button asChild>
                            <Link href={route('admin.customers.create')}>
                                <PlusIcon className="size-4" />
                                Add customer
                            </Link>
                        </Button>
                    )}
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
                                        className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground sm:w-64"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    className="h-11 min-w-[8.5rem] bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                                >
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                                    <div>Company name</div>
                                    <div>Email address</div>
                                    <div>Phone number</div>
                                    <div>Projects</div>
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
                                                className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-4"
                                            >
                                            <div>
                                                <p className="font-medium text-foreground">
                                                    {customer.company_name ||
                                                        customer.name}
                                                </p>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {customer.email ||
                                                    primaryContact?.email ||
                                                    'Not added'}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {customer.phone_number ||
                                                    primaryContact?.phone_number ||
                                                    'Not added'}
                                            </div>
                                            <div>
                                                {(customer.projects_count ??
                                                    (customer.project
                                                        ? 1
                                                        : 0)) > 0 ? (
                                                    <Badge variant="outline">
                                                        <BriefcaseIcon className="size-3" />
                                                        {customer.projects_count ===
                                                        1
                                                            ? customer.project
                                                                ?.name ||
                                                              '1 project'
                                                            : `${customer.projects_count} projects`}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary">
                                                        No projects
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-nowrap gap-1 md:justify-end">
                                                {canUpdateCustomers && (
                                                    <ActionHint hint="Edit this customer">
                                                        <Button
                                                            variant="outline"
                                                            size="icon-xs"
                                                            asChild
                                                        >
                                                            <Link
                                                                href={route(
                                                                    'admin.customers.edit',
                                                                    customer.id,
                                                                )}
                                                                aria-label="Edit this customer"
                                                            >
                                                                <EditIcon className="size-3.5" />
                                                            </Link>
                                                        </Button>
                                                    </ActionHint>
                                                )}
                                                {canDeleteCustomers &&
                                                    (customer.projects_count ??
                                                        (customer.project
                                                            ? 1
                                                            : 0)) === 0 && (
                                                        <ActionHint hint="Delete this customer">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="icon-xs"
                                                                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                onClick={() =>
                                                                    destroyCustomer(
                                                                        customer.id,
                                                                        customer.company_name ||
                                                                            customer.name,
                                                                    )
                                                                }
                                                                aria-label="Delete this customer"
                                                            >
                                                                <Trash2Icon className="size-3.5" />
                                                            </Button>
                                                        </ActionHint>
                                                    )}
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

                            <PaginationNav
                                paginator={customers}
                                itemLabel="customers"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

