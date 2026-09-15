import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ContractorForm from './Partials/ContractorForm';
import type { ContractorOptions, ContractorPayload } from './types';

type EditProps = {
    contractor: ContractorPayload;
    options: ContractorOptions;
};

export default function Edit({ contractor, options }: EditProps) {
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
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit general contractor
                    </h2>
                </div>
            }
        >
            <Head title={`Edit ${contractor.name}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ContractorForm
                        action={route('admin.contractors.update', contractor.id)}
                        method="patch"
                        submitLabel="Save changes"
                        title={contractor.name}
                        description={
                            contractor.projects_count > 0
                                ? `Linked to ${contractor.projects_count} project${contractor.projects_count === 1 ? '' : 's'}.`
                                : 'Update the linked customer, company, address, and contact information.'
                        }
                        contractor={contractor}
                        options={options}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
