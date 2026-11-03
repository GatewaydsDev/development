import FieldAlert from '@/Components/FieldAlert';
import { Button } from '@/Components/ui/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { CheckIcon, UserPlusIcon, XIcon } from 'lucide-react';

type Props = {
    registration: {
        name: string;
        email: string;
        status: string;
        requested_at: string | null;
        ip_address: string | null;
        role: string | null;
    };
    levels: { role: string; label: string }[];
    approveUrl: string;
    denyUrl: string;
    accessMinutes: number;
};

export default function ReviewRegistration({ registration, levels, approveUrl, denyUrl, accessMinutes }: Props) {
    const form = useForm({ role: 'user' });
    const pending = registration.status === 'pending';

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">Sign-up request</h2>}>
            <Head title="Sign-up request" />

            <div className="mx-auto max-w-xl px-4 py-8">
                <div className="rounded-xl border border-border bg-card p-6 text-card-foreground">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                            <UserPlusIcon className="size-5" />
                        </span>
                        <div>
                            <p className="font-semibold">{registration.name}</p>
                            <p className="text-sm text-muted-foreground">{registration.email}</p>
                        </div>
                    </div>

                    <p className="mt-4 text-xs text-muted-foreground">
                        {registration.requested_at && `Requested ${new Date(registration.requested_at).toLocaleString()}`}
                        {registration.ip_address && ` · IP ${registration.ip_address}`}
                    </p>

                    {pending ? (
                        <>
                            <div className="mt-5 flex flex-col gap-2">
                                <label htmlFor="role" className="text-sm font-medium">
                                    User level
                                </label>
                                <select
                                    id="role"
                                    value={form.data.role}
                                    onChange={(event) => form.setData('role', event.target.value)}
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    {levels.map((level) => (
                                        <option key={level.role} value={level.role}>
                                            {level.label}
                                        </option>
                                    ))}
                                </select>
                                <FieldAlert title="Could not approve" message={form.errors.role} />
                                <p className="text-xs text-muted-foreground">
                                    Approving emails the person a link that works for {accessMinutes} minutes.
                                </p>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <Button disabled={form.processing} onClick={() => form.post(approveUrl)}>
                                    <CheckIcon data-icon="inline-start" />
                                    Approve and send link
                                </Button>
                                <Button variant="outline" onClick={() => router.post(denyUrl)}>
                                    <XIcon data-icon="inline-start" />
                                    Deny
                                </Button>
                            </div>
                        </>
                    ) : (
                        <p className="mt-5 rounded-lg bg-muted p-3 text-sm">
                            This request was already handled ({registration.status}).
                        </p>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
