import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import PublicLayout from '@/Layouts/PublicLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { CheckCircleIcon, XCircleIcon } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

type ToastState = {
    type: 'success' | 'error';
    message: string;
};

export default function ForgotPassword({ status }: { status?: string }) {
    const [toast, setToast] = useState<ToastState | null>(null);
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    useEffect(() => {
        if (status) {
            setToast({
                type: 'success',
                message: status,
            });
        }
    }, [status]);

    useEffect(() => {
        if (!toast) {
            return;
        }

        const timeout = window.setTimeout(() => setToast(null), 6000);

        return () => window.clearTimeout(timeout);
    }, [toast]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('password.email'), {
            onSuccess: () => {
                setToast({
                    type: 'success',
                    message:
                        'The password reset email has been sent. Please check your inbox and spam folder.',
                });
            },
            onError: (formErrors) => {
                setToast({
                    type: 'error',
                    message:
                        formErrors.email ||
                        'There was an error sending the email. Please try again in a moment.',
                });
            },
        });
    };

    return (
        <PublicLayout>
            <Head title="Forgot Password" />

            <section className="relative overflow-hidden border-b border-border bg-background">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--primary)/0.14),_transparent_34rem)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.045)_1px,_transparent_1px),linear-gradient(90deg,_rgba(0,0,0,0.045)_1px,_transparent_1px)] bg-[size:56px_56px] dark:bg-[linear-gradient(rgba(255,255,255,0.035)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.035)_1px,_transparent_1px)]" />

                <div className="relative grid min-h-[calc(100vh-5rem)] sm:min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[440px_1fr]">
                    <aside className="flex items-center justify-center border-border bg-card/80 px-4 py-12 backdrop-blur sm:px-6 lg:border-r lg:px-10">
                        <div className="w-full max-w-[360px]">
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Password recovery
                                </p>
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                    Reset your password
                                </h1>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    Enter your email address and we&apos;ll send
                                    you a secure password reset link.
                                </p>
                            </div>

                            {status && (
                                <div className="mt-6 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                                    {status}
                                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                                        If you do not see it soon, check your
                                        spam folder.
                                    </span>
                                </div>
                            )}

                            <form
                                onSubmit={submit}
                                className="mt-8 flex flex-col gap-5"
                            >
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="email"
                                        value="Email"
                                        className="text-foreground"
                                    />

                                    <TextInput
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        className="block h-10 w-full border-border bg-background px-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                        autoComplete="username"
                                        isFocused={true}
                                        onChange={(e) =>
                                            setData('email', e.target.value)
                                        }
                                    />

                                    <InputError
                                        message={errors.email}
                                        className="text-destructive"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    size="lg"
                                    className="w-full"
                                    disabled={processing}
                                >
                                    Email password reset link
                                </Button>
                            </form>

                            <div className="mt-8 text-sm text-muted-foreground">
                                Remember your password?{' '}
                                <Link
                                    href={route('login')}
                                    className="font-medium text-foreground underline-offset-4 transition hover:underline"
                                >
                                    Sign in
                                </Link>
                            </div>
                        </div>
                    </aside>

                    <div className="flex items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
                        <div className="max-w-2xl">
                            <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">
                                Gateway Door Systems
                            </p>
                            <h2 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                                Recover access to your workspace.
                            </h2>
                            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                                We&apos;ll help you get back to managing door
                                projects, service requests, and facility access
                                needs securely.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {toast && (
                <div className="fixed bottom-6 right-4 z-50 max-w-sm rounded-xl border border-border bg-background p-4 text-sm text-foreground shadow-xl">
                    <div className="flex gap-3">
                        {toast.type === 'success' ? (
                            <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                        ) : (
                            <XCircleIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
                        )}
                        <div>
                            <p className="font-medium">
                                {toast.type === 'success'
                                    ? 'Email sent'
                                    : 'Email not sent'}
                            </p>
                            <p className="mt-1 text-muted-foreground">
                                {toast.message}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </PublicLayout>
    );
}
