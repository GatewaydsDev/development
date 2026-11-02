import FieldAlert from '@/Components/FieldAlert';
import InputLabel from '@/Components/InputLabel';
import RegistrationShell from '@/Components/RegistrationShell';
import TextInput from '@/Components/TextInput';
import TurnstileWidget from '@/Components/TurnstileWidget';
import { Button } from '@/Components/ui/button';
import { Link, useForm } from '@inertiajs/react';
import { MailCheckIcon, MailWarningIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

type Props = {
    emailAvailability?: { email: string; taken: boolean } | null;
    requested?: { email: string; emailed: boolean } | null;
    turnstileSiteKey?: string | null;
    robotChallenge?: { question: string; token: string } | null;
};

export default function Register({ emailAvailability, requested, turnstileSiteKey, robotChallenge }: Props) {
    const [captchaReset, setCaptchaReset] = useState(0);
    const form = useForm({
        name: '',
        email: emailAvailability?.email ?? '',
        website: '',
        'cf-turnstile-response': '',
        challenge_token: robotChallenge?.token ?? '',
        challenge_answer: '',
    });
    const captchaMissing =
        (Boolean(turnstileSiteKey) && !form.data['cf-turnstile-response']) ||
        (Boolean(robotChallenge) && !form.data.challenge_answer);

    // A fresh question arrives after every attempt.
    useEffect(() => {
        if (robotChallenge) {
            form.setData((data) => ({ ...data, challenge_token: robotChallenge.token, challenge_answer: '' }));
        }
    }, [robotChallenge?.token]);

    if (requested) {
        const ok = requested.emailed;

        return (
            <RegistrationShell
                title="Sign up"
                eyebrow="Request sent"
                heading="Waiting for approval"
            >
                <div
                    role="status"
                    className={
                        ok
                            ? 'flex gap-3 rounded-lg border border-emerald-300/60 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
                            : 'flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
                    }
                >
                    {ok ? (
                        <MailCheckIcon className="mt-0.5 size-5 shrink-0" />
                    ) : (
                        <MailWarningIcon className="mt-0.5 size-5 shrink-0" />
                    )}
                    <div className="text-sm">
                        <p className="font-semibold">
                            {ok
                                ? 'Your request was sent to the administrator.'
                                : 'Your request was saved, but the email could not be sent.'}
                        </p>
                        <p className="mt-1 opacity-90">
                            {ok
                                ? `When it is approved, we will email ${requested.email} a sign-up link. The link works for 8 minutes only.`
                                : 'Please contact the administrator directly.'}
                        </p>
                    </div>
                </div>
                <p className="mt-6 text-sm text-muted-foreground">
                    <Link
                        href={route('login')}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                        Back to sign in
                    </Link>
                </p>
            </RegistrationShell>
        );
    }

    return (
        <RegistrationShell
            title="Sign up"
            eyebrow="Request access"
            heading="Sign up for Gateway"
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(route('register'), {
                        preserveScroll: true,
                        onError: () => setCaptchaReset((n) => n + 1),
                    });
                }}
                className="flex flex-col gap-5"
            >
                <div className="flex flex-col gap-2">
                    <InputLabel htmlFor="name" value="Name" className="text-foreground" />
                    <TextInput
                        id="name"
                        className="block h-10 w-full border-border bg-background px-3 text-foreground"
                        value={form.data.name}
                        autoComplete="name"
                        autoFocus
                        onChange={(event) => form.setData('name', event.target.value)}
                    />
                    <FieldAlert title="Name is required" message={form.errors.name} />
                </div>

                <div className="flex flex-col gap-2">
                    <InputLabel htmlFor="email" value="Email" className="text-foreground" />
                    <TextInput
                        id="email"
                        type="email"
                        className="block h-10 w-full border-border bg-background px-3 text-foreground"
                        value={form.data.email}
                        autoComplete="email"
                        onChange={(event) => form.setData('email', event.target.value)}
                    />
                    <FieldAlert title="Check your email" message={form.errors.email} />
                </div>

                <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                    <label htmlFor="website">Leave this field empty</label>
                    <input
                        id="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={form.data.website}
                        onChange={(event) => form.setData('website', event.target.value)}
                    />
                </div>

                {turnstileSiteKey && (
                    <div className="flex flex-col gap-2">
                        <TurnstileWidget
                            siteKey={turnstileSiteKey}
                            resetKey={captchaReset}
                            onToken={(token) => form.setData('cf-turnstile-response', token)}
                        />
                        <FieldAlert title="Robot check" message={(form.errors as Record<string, string>).captcha} />
                    </div>
                )}

                {robotChallenge && (
                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="challenge_answer"
                            value={`Robot check: ${robotChallenge.question}`}
                            className="text-foreground"
                        />
                        <TextInput
                            id="challenge_answer"
                            className="block h-10 w-full border-border bg-background px-3 text-foreground"
                            inputMode="numeric"
                            autoComplete="off"
                            value={form.data.challenge_answer}
                            onChange={(event) => form.setData('challenge_answer', event.target.value)}
                        />
                        <FieldAlert title="Robot check" message={(form.errors as Record<string, string>).captcha} />
                    </div>
                )}

                <p className="text-xs leading-5 text-muted-foreground">
                    An administrator will review your request. If approved, you
                    will receive an email with a link to create your password.
                    The link is valid for 8 minutes.
                </p>

                <Button type="submit" size="lg" className="w-full" disabled={form.processing || captchaMissing}>
                    Request access
                </Button>
            </form>

            <p className="mt-8 text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                    href={route('login')}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                    Sign in
                </Link>
            </p>
        </RegistrationShell>
    );
}
