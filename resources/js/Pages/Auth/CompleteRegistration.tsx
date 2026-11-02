import FieldAlert from '@/Components/FieldAlert';
import InputLabel from '@/Components/InputLabel';
import RegistrationShell from '@/Components/RegistrationShell';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff, LinkIcon, TimerIcon, TimerOffIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

type Props = {
    state: 'ready' | 'expired' | 'invalid';
    name?: string;
    email?: string;
    level?: string;
    expiresAt?: string;
    serverNow?: string;
    submitUrl?: string;
};

const format = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

function Countdown({ expiresAt, serverNow, onDone }: { expiresAt: string; serverNow: string; onDone: () => void }) {
    // Use the server clock so a wrong device clock can't extend the window.
    const [left, setLeft] = useState(() =>
        Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.parse(serverNow)) / 1000)),
    );

    useEffect(() => {
        if (left <= 0) {
            onDone();
            return;
        }

        const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);

        return () => window.clearTimeout(timer);
    }, [left, onDone]);

    const urgent = left <= 60;

    return (
        <div
            role="timer"
            className={
                urgent
                    ? 'flex items-center gap-3 rounded-lg border border-red-300/60 bg-red-50 p-3 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
                    : 'flex items-center gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
            }
        >
            <TimerIcon className="size-5 shrink-0" />
            <div className="flex-1 text-sm">
                <p className="font-semibold">Time left to finish</p>
                <p className="text-xs opacity-90">The link stops working when the clock reaches zero.</p>
            </div>
            <span className="font-mono text-2xl font-semibold tabular-nums">{format(left)}</span>
        </div>
    );
}

export default function CompleteRegistration(props: Props) {
    const [expired, setExpired] = useState(props.state === 'expired');
    const [show, setShow] = useState(false);
    const form = useForm({ password: '', password_confirmation: '' });

    if (props.state === 'invalid') {
        return (
            <RegistrationShell title="Sign up" eyebrow="Sign-up link" heading="Link not valid">
                <div className="flex gap-3 rounded-lg border border-red-300/60 bg-red-50 p-4 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
                    <LinkIcon className="mt-0.5 size-5 shrink-0" />
                    <p className="text-sm">This link is not valid or was already used.</p>
                </div>
                <Link href={route('login')} className="mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline">
                    Back to sign in
                </Link>
            </RegistrationShell>
        );
    }

    if (expired) {
        return (
            <RegistrationShell title="Sign up" eyebrow="Sign-up link" heading="Link expired">
                <div className="flex gap-3 rounded-lg border border-red-300/60 bg-red-50 p-4 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
                    <TimerOffIcon className="mt-0.5 size-5 shrink-0" />
                    <div className="text-sm">
                        <p className="font-semibold">The 8 minutes are over.</p>
                        <p className="mt-1 opacity-90">
                            This link can no longer be used. Contact the administrator if you still need access.
                        </p>
                    </div>
                </div>
                <Link href={route('login')} className="mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline">
                    Back to sign in
                </Link>
            </RegistrationShell>
        );
    }

    return (
        <RegistrationShell title="Create account" eyebrow="Request approved" heading="Create your account">
            <div className="flex flex-col gap-5">
                <Countdown
                    expiresAt={props.expiresAt!}
                    serverNow={props.serverNow!}
                    onDone={() => setExpired(true)}
                />

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border bg-background p-3 text-sm">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium">{props.name}</dd>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="break-all font-medium">{props.email}</dd>
                    <dt className="text-muted-foreground">Access level</dt>
                    <dd className="font-medium">{props.level}</dd>
                </dl>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(props.submitUrl!, { preserveScroll: true });
                    }}
                    className="flex flex-col gap-5"
                >
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="password" value="Password" className="text-foreground" />
                        <div className="relative">
                            <TextInput
                                id="password"
                                type={show ? 'text' : 'password'}
                                className="block h-10 w-full border-border bg-background px-3 pe-10 text-foreground"
                                autoComplete="new-password"
                                autoFocus
                                value={form.data.password}
                                onChange={(event) => form.setData('password', event.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShow((value) => !value)}
                                className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                                aria-label={show ? 'Hide password' : 'Show password'}
                            >
                                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        </div>
                        <FieldAlert title="Check your password" message={form.errors.password} />
                    </div>

                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="password_confirmation" value="Confirm password" className="text-foreground" />
                        <TextInput
                            id="password_confirmation"
                            type={show ? 'text' : 'password'}
                            className="block h-10 w-full border-border bg-background px-3 text-foreground"
                            autoComplete="new-password"
                            value={form.data.password_confirmation}
                            onChange={(event) => form.setData('password_confirmation', event.target.value)}
                        />
                    </div>

                    <Button type="submit" size="lg" className="w-full" disabled={form.processing}>
                        Create account
                    </Button>
                </form>
            </div>
        </RegistrationShell>
    );
}
