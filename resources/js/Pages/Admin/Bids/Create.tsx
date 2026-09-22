import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/Components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, PrinterIcon } from 'lucide-react';
import { useState } from 'react';
import BidForm from './Partials/BidForm';
import type { BidOptions } from './types';

type CreateProps = {
    options: BidOptions;
    importQuotationId?: number | null;
};

export default function Create({ options, importQuotationId = null }: CreateProps) {
    const [projectName, setProjectName] = useState('');

    return (
        <AuthenticatedLayout
            stickyTitle={projectName ? `Add bid — ${projectName}` : 'Add bid'}
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
                                href={route('admin.bids.index')}
                                className="transition hover:text-foreground"
                            >
                                Bids
                            </Link>
                            <span>/</span>
                            <span className="text-foreground">Add</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Add bid
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
                            <Link href={route('admin.bids.index')}>
                                <ArrowLeftIcon className="size-4" />
                                Back to bids
                            </Link>
                        </Button>
                    </div>
                </div>
            }
        >
            <Head title="Add Bid" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <BidForm
                        action={route('admin.bids.store')}
                        title="Bid information"
                        description="Create a bid with stages, reusable scopes of work, and revising preliminary pricing."
                        options={options}
                        importQuotationId={importQuotationId}
                        onSelectedProjectNameChange={setProjectName}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
