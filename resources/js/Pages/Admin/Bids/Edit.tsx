import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import BidForm from './Partials/BidForm';
import type { BidOptions, BidPayload } from './types';

type EditProps = {
    bid: BidPayload;
    options: BidOptions;
};

export default function Edit({ bid, options }: EditProps) {
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
                            href={route('admin.bids.index')}
                            className="transition hover:text-foreground"
                        >
                            Bids
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit bid
                    </h2>
                </div>
            }
        >
            <Head title={`Edit bid for ${bid.project?.name ?? 'project'}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <BidForm
                        action={route('admin.bids.update', bid.id)}
                        method="patch"
                        title={bid.project?.name ?? 'Bid'}
                        description="Update stages, scopes of work, and preliminary pricing revisions."
                        options={options}
                        bid={bid}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
