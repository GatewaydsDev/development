import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ContractorForm from './Partials/ContractorForm';
import type { ContractorOptions } from './types';

type CreateProps = {
    options: ContractorOptions;
};

export default function Create({ options }: CreateProps) {
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
                            href={route('admin.contractors.index')}
                            className="transition hover:text-foreground"
                        >
                            Contractors
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add general contractor
                    </h2>
                </div>
            }
        >
            <Head title="Add Contractor" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ContractorForm
                        action={route('admin.contractors.store')}
                        submitLabel="Create contractor"
                        title="Contractor information"
                        description="Save the contractor company and multiple contacts."
                        options={options}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
