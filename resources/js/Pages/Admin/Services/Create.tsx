import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ServiceForm from './Partials/ServiceForm';

export default function Create() {
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
                            href={route('admin.services.index')}
                            className="transition hover:text-foreground"
                        >
                            Services
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add service
                    </h2>
                </div>
            }
        >
            <Head title="Add Service" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ServiceForm
                        action={route('admin.services.store')}
                        title="Service information"
                        description="Save a reusable service so it can be paired with a product on a bid, for example Assembly w/ vision glazing."
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
