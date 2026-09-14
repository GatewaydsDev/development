import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ServiceForm from './Partials/ServiceForm';
import type { ServicePayload } from './types';

type EditProps = {
    service: ServicePayload;
};

export default function Edit({ service }: EditProps) {
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
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit service
                    </h2>
                </div>
            }
        >
            <Head title={`Edit ${service.name}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ServiceForm
                        action={route('admin.services.update', service.id)}
                        method="patch"
                        title={service.name}
                        description={
                            (service.bid_count ?? 0) > 0
                                ? `Used on ${service.bid_count} bid line${service.bid_count === 1 ? '' : 's'}.`
                                : 'Update the service name or description.'
                        }
                        service={service}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
