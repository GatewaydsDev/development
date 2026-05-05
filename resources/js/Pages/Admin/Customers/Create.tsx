import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import CustomerForm from './Partials/CustomerForm';
import type { CustomerContactRole } from './types';

type CreateProps = {
    contactRoles: CustomerContactRole[];
};

export default function Create({ contactRoles }: CreateProps) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span>Administration</span>
                        <span>/</span>
                        <span>Customers</span>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add customer
                    </h2>
                </div>
            }
        >
            <Head title="Add Customer" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <CustomerForm
                        action={route('admin.customers.store')}
                        submitLabel="Create customer"
                        title="Customer information"
                        description="Create a customer record that can be linked to a project later."
                        contactRoles={contactRoles}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

