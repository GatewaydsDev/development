import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import PublicLayout from '@/Layouts/PublicLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { FormEventHandler } from 'react';
import { useState } from 'react';

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <PublicLayout>
            <Head title="Sign in" />

            <section className="relative overflow-hidden border-b border-border bg-background">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--primary)/0.14),_transparent_34rem)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.045)_1px,_transparent_1px),linear-gradient(90deg,_rgba(0,0,0,0.045)_1px,_transparent_1px)] bg-[size:56px_56px] dark:bg-[linear-gradient(rgba(255,255,255,0.035)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.035)_1px,_transparent_1px)]" />

                <div className="relative grid min-h-[calc(100vh-5rem)] sm:min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[440px_1fr]">
                    <aside className="flex items-center justify-center border-border bg-card/80 px-4 py-12 backdrop-blur sm:px-6 lg:border-r lg:px-10">
                        <div className="w-full max-w-[360px]">
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Welcome back
                                </p>
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                    Sign in to your account
                                </h1>
                            </div>

                            {status && (
                                <div className="mt-6 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                                    {status}
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

                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-4">
                                        <InputLabel
                                            htmlFor="password"
                                            value="Password"
                                            className="text-foreground"
                                        />

                                        {canResetPassword && (
                                            <Link
                                                href={route('password.request')}
                                                className="rounded-md text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                                            >
                                                Forgot password?
                                            </Link>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <TextInput
                                            id="password"
                                            type={
                                                showPassword
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            name="password"
                                            value={data.password}
                                            className="block h-10 w-full border-border bg-background px-3 pe-10 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                            autoComplete="current-password"
                                            onChange={(e) =>
                                                setData(
                                                    'password',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowPassword(
                                                    (current) => !current,
                                                )
                                            }
                                            className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
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

                                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Checkbox
                                        name="remember"
                                        checked={data.remember}
                                        onChange={(e) =>
                                            setData(
                                                'remember',
                                                (e.target.checked ||
                                                    false) as false,
                                            )
                                        }
                                    />
                                    Remember me
                                </label>

                                <Button
                                    type="submit"
                                    size="lg"
                                    className="w-full"
                                    disabled={processing}
                                >
                                    Sign in
                                </Button>
                            </form>

                            <div className="mt-8 flex flex-col gap-4 text-sm text-muted-foreground">
                                <p>
                                    Don&apos;t have an account?{' '}
                                    <Link
                                        href={route('register')}
                                        className="font-medium text-foreground underline-offset-4 transition hover:underline"
                                    >
                                        Sign up
                                    </Link>
                                </p>
                                <p className="text-xs leading-5">
                                    By continuing, you agree to use Gateway Door
                                    Systems according to your
                                    organization&apos;s access policies.
                                </p>
                            </div>
                        </div>
                    </aside>

                    <div className="flex items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
                        <div className="max-w-2xl">
                            <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">
                                Gateway Door Systems
                            </p>
                            <h2 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                                Secure access for every facility opening.
                            </h2>
                            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                                Manage your account, project details, and door
                                service requests from one focused workspace.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
