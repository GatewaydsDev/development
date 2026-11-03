import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import PasskeysForm, { Passkey } from './Partials/PasskeysForm';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({
    mustVerifyEmail,
    status,
    passkeys,
}: PageProps<{
    mustVerifyEmail: boolean;
    status?: string;
    passkeys: Passkey[];
}>) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                    Profile
                </h2>
            }
        >
            <Head title="Profile" />

            <div className="py-12">
                <div className="w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30 p-4 text-card-foreground shadow-sm sm:p-8">
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            className="max-w-xl"
                        />
                    </div>

                    <div className="rounded-lg border border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30 p-4 text-card-foreground shadow-sm sm:p-8">
                        <UpdatePasswordForm className="max-w-xl" />
                    </div>

                    <div className="rounded-lg border border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30 p-4 text-card-foreground shadow-sm sm:p-8">
                        <PasskeysForm passkeys={passkeys} className="max-w-xl" />
                    </div>

                    <div className="rounded-lg border border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30 p-4 text-card-foreground shadow-sm sm:p-8">
                        <DeleteUserForm className="max-w-xl" />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
