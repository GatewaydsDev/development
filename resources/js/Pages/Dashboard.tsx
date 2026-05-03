import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function Dashboard() {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                    Dashboard
                </h2>
            }
        >
            <Head title="Dashboard" />

            <div className="py-4 sm:py-6">
                <div className="mx-auto max-w-[96rem] px-3 sm:px-4 lg:px-6">
                    <div className="overflow-hidden border border-border bg-card shadow-sm sm:rounded-lg">
                        <div className="min-h-40 p-5 text-2xl font-semibold text-card-foreground sm:min-h-48 sm:p-6 sm:text-3xl">
                            You&apos;re logged in!
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
