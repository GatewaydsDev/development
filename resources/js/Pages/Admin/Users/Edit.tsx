import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import UserForm from '@/Pages/Admin/Users/Partials/UserForm';
import { Head, Link } from '@inertiajs/react';

type Level = {
    id: number;
    name: string;
};

type ManagedUser = {
    id: number;
    name: string;
    email: string;
    level_id: number | null;
    level: Level | null;
};

type EditProps = {
    levels: Level[];
    managedUser: ManagedUser;
};

export default function Edit({ levels, managedUser }: EditProps) {
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
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit user
                    </h2>
                </div>
            }
        >
            <Head title={`Edit ${managedUser.name}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <UserForm
                        levels={levels}
                        title={`Update ${managedUser.name}`}
                        description="Review profile details, access level, and password settings for this user."
                        action={route('admin.users.update', managedUser.id)}
                        method="patch"
                        submitLabel="Save changes"
                        passwordOptional
                        initialValues={{
                            name: managedUser.name,
                            email: managedUser.email,
                            level_id: managedUser.level_id
                                ? String(managedUser.level_id)
                                : '',
                        }}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
