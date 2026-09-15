import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import CustomerForm from './Partials/CustomerForm';
import type { CustomerContactRole, CustomerPayload } from './types';

type EditProps = {
    customer: CustomerPayload;
    contactRoles: CustomerContactRole[];
};

export default function Edit({ customer, contactRoles }: EditProps) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <Link
                            href={route('admin.customers.index')}
                            className="transition hover:text-foreground"
                        >
                            Customers
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit customer
                    </h2>
                </div>
            }
        >
            <Head title={`Edit ${customer.company_name || customer.name}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <CustomerForm
                        action={route('admin.customers.update', customer.id)}
                        method="patch"
                        submitLabel="Save changes"
                        title={customer.company_name || customer.name}
                        description={
                            (customer.projects_count ?? 0) > 0
                                ? `Linked to ${customer.projects_count} project${customer.projects_count === 1 ? '' : 's'}.`
                                : 'Update customer contact and address information.'
                        }
                        customer={customer}
                        contactRoles={contactRoles}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

