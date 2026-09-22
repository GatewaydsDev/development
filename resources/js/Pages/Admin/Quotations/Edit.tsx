import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/Components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { EyeIcon, FileTextIcon, PrinterIcon } from 'lucide-react';
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
                            <span className="text-foreground">Edit</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Edit quotation
                        </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" asChild>
                            <a
                                href={route(
                                    'admin.quotations.print',
                                    quotation.id,
                                )}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <PrinterIcon className="size-4" />
                                Print
                            </a>
                        </Button>
                        <Button variant="outline" asChild>
                            <a
                                href={route(
                                    'admin.quotations.export.pdf',
                                    quotation.id,
                                )}
                            >
                                <FileTextIcon className="size-4" />
                                PDF
                            </a>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link
                                href={route(
                                    'admin.quotations.show',
                                    quotation.id,
                                )}
                            >
                                <EyeIcon className="size-4" />
                                View
                            </Link>
                        </Button>
                    </div>
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
                        description="Update the project, contractor, contacts, and quoted items. Previous versions stay in the quotation history as saved records."
                        options={options}
                        quotation={quotation}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
