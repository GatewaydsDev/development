import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/Components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, PrinterIcon } from 'lucide-react';
import QuotationForm from './Partials/QuotationForm';
import type { QuotationOptions } from './types';

type CreateProps = {
    options: QuotationOptions;
};

export default function Create({ options }: CreateProps) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => window.print()}
                        >
                            <PrinterIcon className="size-4" />
                            Print
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href={route('admin.quotations.index')}>
                                <ArrowLeftIcon className="size-4" />
                                Back to quotations
                            </Link>
                        </Button>
                    </div>
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
