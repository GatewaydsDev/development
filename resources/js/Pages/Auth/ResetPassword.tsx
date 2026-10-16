import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import PublicLayout from '@/Layouts/PublicLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

export default function ResetPassword({
    token,
    email,
}: {
    token: string;
    email: string;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirmation, setShowPasswordConfirmation] =
        useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <PublicLayout>
            <Head title="Reset Password" />

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
                                    Choose a new password
                                </h1>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    This link is valid for 10 minutes. Choose a
                                    new password for {email}.
                                </p>
                            </div>

                            <form
                                onSubmit={submit}
                                className="mt-8 flex flex-col gap-5"
                            >
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="password"
                                        value="New password"
                                        className="text-foreground"
                                    />

                                    <div className="relative">
                                        <TextInput
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={data.password}
                                            className="block h-10 w-full border-border bg-background px-3 pe-10 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                            autoComplete="new-password"
                                            isFocused={true}
                                            onChange={(e) =>
                                                setData('password', e.target.value)
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowPassword((current) => !current)
                                            }
                                            className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground"
                                            aria-label={
                                                showPassword
                                                    ? 'Hide password'
                                                    : 'Show password'
                                            }
                                        >
                                            {showPassword ? (
                                                <EyeOff className="size-4" />
                                            ) : (
                                                <Eye className="size-4" />
                                            )}
                                        </button>
                                    </div>

                                    <InputError
                                        message={errors.password}
                                        className="text-destructive"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="password_confirmation"
                                        value="Confirm password"
                                        className="text-foreground"
                                    />

                                    <div className="relative">
                                        <TextInput
                                            id="password_confirmation"
                                            type={
                                                showPasswordConfirmation
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            name="password_confirmation"
                                            value={data.password_confirmation}
                                            className="block h-10 w-full border-border bg-background px-3 pe-10 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                            autoComplete="new-password"
                                            onChange={(e) =>
                                                setData(
                                                    'password_confirmation',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowPasswordConfirmation(
                                                    (current) => !current,
                                                )
                                            }
                                            className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground"
                                            aria-label={
                                                showPasswordConfirmation
                                                    ? 'Hide password confirmation'
                                                    : 'Show password confirmation'
                                            }
                                        >
                                            {showPasswordConfirmation ? (
                                                <EyeOff className="size-4" />
                                            ) : (
                                                <Eye className="size-4" />
                                            )}
                                        </button>
                                    </div>

                                    <InputError
                                        message={errors.password_confirmation}
                                        className="text-destructive"
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
                                    Save new password
                                </Button>
                            </form>

                            <div className="mt-8 text-sm text-muted-foreground">
                                <Link
                                    href={route('login')}
                                    className="font-medium text-foreground underline-offset-4 transition hover:underline"
                                >
                                    Back to sign in
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
                                Set a new password.
                            </h2>
                            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                                Use the link from your email within 10 minutes.
                                After that, request a new one.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
