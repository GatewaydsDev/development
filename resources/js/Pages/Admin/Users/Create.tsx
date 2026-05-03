import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import UserForm from '@/Pages/Admin/Users/Partials/UserForm';
import { Head, Link } from '@inertiajs/react';

type Level = {
    id: number;
    name: string;
};

export default function Create({ levels }: { levels: Level[] }) {
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
                            href={route('admin.users.index')}
                            className="transition hover:text-foreground"
                        >
                            Users
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add new</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add new user
                    </h2>
                </div>
            }
        >
            <Head title="Add user" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <UserForm
                        levels={levels}
                        title="Create a team member"
                        description="Invite an internal user and choose the correct access level for Gateway Door Systems."
                        action={route('admin.users.store')}
                        submitLabel="Create user"
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
