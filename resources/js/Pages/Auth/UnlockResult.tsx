import RegistrationShell from '@/Components/RegistrationShell';
import { Link } from '@inertiajs/react';
import { CheckCircle2Icon, InfoIcon } from 'lucide-react';

export default function UnlockResult({ unlocked, name, email }: { unlocked: boolean; name: string; email: string }) {
    return (
        <RegistrationShell
            title="Account unlock"
            eyebrow="Login protection"
            heading={unlocked ? 'Account unlocked' : 'Nothing to unlock'}
        >
            <div
                role="status"
                className={
                    unlocked
                        ? 'flex gap-3 rounded-lg border border-emerald-300/60 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
                        : 'flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
                }
            >
                {unlocked ? (
                    <CheckCircle2Icon className="mt-0.5 size-5 shrink-0" />
                ) : (
                    <InfoIcon className="mt-0.5 size-5 shrink-0" />
                )}
                <div className="text-sm">
                    <p className="font-semibold">
                        {unlocked
                            ? `${name} can try to sign in again.`
                            : 'This account is not blocked, or this link was already used.'}
                    </p>
                    <p className="mt-1 break-all opacity-90">{email}</p>
                </div>
            </div>
            <Link href={route('login')} className="mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline">
                Go to sign in
            </Link>
        </RegistrationShell>
    );
}
