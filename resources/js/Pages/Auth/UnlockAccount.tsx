import { Button } from '@/Components/ui/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { LockIcon, LockOpenIcon } from 'lucide-react';
import { useState } from 'react';

type Props = {
    target: {
        name: string;
        email: string;
        failed_attempts: number;
        blocked_at: string | null;
        is_blocked: boolean;
    };
    unlockUrl: string;
};

export default function UnlockAccount({ target, unlockUrl }: Props) {
    const [busy, setBusy] = useState(false);

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">Blocked login</h2>}
        >
            <Head title="Blocked login" />

            <div className="mx-auto max-w-xl px-4 py-8">
                <div className="rounded-xl border border-border bg-card p-6 text-card-foreground">
                    <div className="flex items-center gap-3">
                        <span
                            className={
                                target.is_blocked
                                    ? 'flex size-10 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                                    : 'flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                            }
                        >
                            {target.is_blocked ? (
                                <LockIcon className="size-5" />
                            ) : (
                                <LockOpenIcon className="size-5" />
                            )}
                        </span>
                        <div>
                            <p className="font-semibold">{target.name}</p>
                            <p className="text-sm text-muted-foreground">{target.email}</p>
                        </div>
                    </div>

                    <p className="mt-5 text-sm text-muted-foreground">
                        {target.is_blocked
                            ? `Blocked after ${target.failed_attempts} failed sign-in attempts${
                                  target.blocked_at
                                      ? ` on ${new Date(target.blocked_at).toLocaleString()}`
                                      : ''
                              }. Only allow another try if you recognise this activity.`
                            : 'This account is not blocked. It can already sign in.'}
                    </p>

                    {target.is_blocked && (
                        <div className="mt-6 flex gap-3">
                            <Button
                                disabled={busy}
                                onClick={() => {
                                    setBusy(true);
                                    router.post(unlockUrl, {}, { onFinish: () => setBusy(false) });
                                }}
                            >
                                <LockOpenIcon data-icon="inline-start" />
                                Allow another try
                            </Button>
                            <Button variant="outline" onClick={() => router.visit(route('dashboard'))}>
                                Keep blocked
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
