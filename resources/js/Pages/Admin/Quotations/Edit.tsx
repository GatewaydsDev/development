import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import QuotationForm from './Partials/QuotationForm';
import type { QuotationOptions, QuotationPayload } from './types';

type EditProps = {
    quotation: QuotationPayload;
    options: QuotationOptions;
};

export default function Edit({ quotation, options }: EditProps) {
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
                            href={route('admin.quotations.index')}
                            className="transition hover:text-foreground"
                        >
                            Quotations
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit quotation
                    </h2>
                </div>
            }
        >
            <Head title={`Edit ${quotation.quotation_number}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <QuotationForm
                        action={route('admin.quotations.update', quotation.id)}
                        method="patch"
                        title="Quotation information"
                        description="Update the contractor, project, and quoted items. Previous versions stay in the quotation history as saved records."
                        options={options}
                        quotation={quotation}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
