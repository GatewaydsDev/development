import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import UserForm from '@/Pages/Admin/Users/Partials/UserForm';
import { Head, Link } from '@inertiajs/react';

type Level = {
    id: number;
    uuid: string;
    name: string;
};

type Language = {
    id: number;
    name: string;
    abbreviation: string;
};

type ManagedUser = {
    id: number;
    uuid: string;
    name: string;
    email: string;
    microsoft_mailbox?: string | null;
    microsoft_tenant_id?: string | null;
    microsoft_client_id?: string | null;
    microsoft_client_secret_id?: string | null;
    microsoft_client_secret_saved?: boolean;
    avatar_url: string | null;
    initials: string;
    date_of_birth: string | null;
    language_id: number | null;
    preferred_language: Language | null;
    level_id: number | null;
    level: Level | null;
    emails?: Array<{ email: string; is_primary: boolean }>;
    phones?: Array<{
        phone: string;
        country?: string;
        is_primary: boolean;
    }>;
};

type AccessPermission = {
    key: string;
    name: string;
    group: string;
    description: string;
};

type EditProps = {
    levels: Level[];
    languages: Language[];
    accessPermissions?: AccessPermission[];
    canCreateUserLevel?: boolean;
    canAssignMailbox?: boolean;
    superAdminLevelNames?: string[];
    managedUser: ManagedUser;
};

export default function Edit({
    levels,
    languages,
    accessPermissions = [],
    canCreateUserLevel = false,
    canAssignMailbox = false,
    superAdminLevelNames,
    managedUser,
}: EditProps) {
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
                        userId={managedUser.id}
                        levels={levels}
                        languages={languages}
                        accessPermissions={accessPermissions}
                        canCreateUserLevel={canCreateUserLevel}
                        canAssignMailbox={canAssignMailbox}
                        superAdminLevelNames={superAdminLevelNames}
                        microsoftSecretSaved={
                            managedUser.microsoft_client_secret_saved ?? false
                        }
                        title={`Update ${managedUser.name}`}
                        description="Review profile details, contact emails and phone numbers, access level, and password settings for this user."
                        action={route('admin.users.update', managedUser.uuid)}
                        method="patch"
                        submitLabel="Save changes"
                        passwordOptional
                        currentAvatarUrl={managedUser.avatar_url}
                        initialValues={{
                            name: managedUser.name,
                            email: managedUser.email,
                            microsoft_mailbox:
                                managedUser.microsoft_mailbox ?? '',
                            microsoft_tenant_id:
                                managedUser.microsoft_tenant_id ?? '',
                            microsoft_client_id:
                                managedUser.microsoft_client_id ?? '',
                            microsoft_client_secret_id:
                                managedUser.microsoft_client_secret_id ?? '',
                            date_of_birth: managedUser.date_of_birth ?? '',
                            language_id: managedUser.language_id
                                ? String(managedUser.language_id)
                                : '',
                            level_id: managedUser.level_id
                                ? String(managedUser.level_id)
                                : '',
                            emails: managedUser.emails ?? [],
                            phones: managedUser.phones ?? [],
                        }}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
