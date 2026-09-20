import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import QuotationForm from './Partials/QuotationForm';
import type { QuotationOptions } from './types';

type CreateProps = {
    options: QuotationOptions;
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
                            href={route('admin.quotations.index')}
                            className="transition hover:text-foreground"
                        >
                            Quotations
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add quotation
                    </h2>
                </div>
            }
        >
            <Head title="Add Quotation" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <QuotationForm
                        action={route('admin.quotations.store')}
                        title="Quotation information"
                        description="Choose the project and contractor, pick which contacts appear on the quotation, then add priced line items."
                        options={options}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
