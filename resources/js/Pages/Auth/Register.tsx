import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from '@/Components/ui/input-otp';
import PublicLayout from '@/Layouts/PublicLayout';
import { zodResolver } from '@hookform/resolvers/zod';
import { Head, Link, router } from '@inertiajs/react';
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';
import { Fragment, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

const accessCodePrefix = 'FCKGWRHQQ';

const userLevels = {
    '1': { label: 'Super admin', role: 'super_admin' },
    '2': { label: 'Admin', role: 'admin' },
    '3': { label: 'Manager', role: 'manager' },
    '4': { label: 'Technician', role: 'technician' },
    '5': { label: 'Viewer', role: 'viewer' },
} as const;

const otpGroups = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]];

const getUserLevel = (accessCode: string) =>
    userLevels[accessCode.slice(-1) as keyof typeof userLevels];

const registerSchema = z
    .object({
        accessCode: z
            .string()
            .length(10, 'Enter the 10-character access code.')
            .regex(/^[A-Z0-9]+$/, 'Use only letters and numbers.')
            .refine(
                (value) => value.startsWith(accessCodePrefix),
                'This access code is not valid for Gateway registration.',
            )
            .refine(
                (value) => Boolean(getUserLevel(value)),
                'This access level is not configured yet.',
            ),
        name: z.string().min(1, 'Enter your name.'),
        email: z.string().email('Enter a valid email address.'),
        password: z.string().min(8, 'Password must be at least 8 characters.'),
        password_confirmation: z.string().min(1, 'Confirm your password.'),
    })
    .refine((data) => data.password === data.password_confirmation, {
        message: 'Passwords do not match.',
        path: ['password_confirmation'],
    });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
    const [processing, setProcessing] = useState(false);

    const {
        control,
        handleSubmit,
        register,
        resetField,
        setError,
        watch,
        formState: { errors: validationErrors },
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            accessCode: '',
            name: '',
            email: '',
            password: '',
            password_confirmation: '',
        },
        mode: 'onChange',
    });

    const accessCode = watch('accessCode');
    const userLevel = getUserLevel(accessCode);
    const hasAccessCodeError = Boolean(validationErrors.accessCode);

    const submit = (values: RegisterFormValues) => {
        router.post(
            route('register'),
            {
                access_code: values.accessCode,
                name: values.name,
                email: values.email,
                password: values.password,
                password_confirmation: values.password_confirmation,
            },
            {
                onBefore: () => {
                    setProcessing(true);
                },
                onError: (errors) => {
                    Object.entries(errors).forEach(([field, message]) => {
                        const formField =
                            field === 'access_code' ? 'accessCode' : field;

                        if (formField in values) {
                            setError(formField as keyof RegisterFormValues, {
                                type: 'server',
                                message: String(message),
                            });
                        }
                    });
                },
                onFinish: () => {
                    setProcessing(false);
                    resetField('password');
                    resetField('password_confirmation');
                },
            },
        );
    };

    const focusNameInput = () => {
        window.requestAnimationFrame(() => {
            document.getElementById('name')?.focus();
        });
    };

    return (
        <PublicLayout>
            <Head title="Sign up" />

            <section className="relative overflow-hidden border-b border-border bg-background">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--primary)/0.14),_transparent_34rem)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.045)_1px,_transparent_1px),linear-gradient(90deg,_rgba(0,0,0,0.045)_1px,_transparent_1px)] bg-[size:56px_56px] dark:bg-[linear-gradient(rgba(255,255,255,0.035)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.035)_1px,_transparent_1px)]" />

                <div className="relative grid min-h-[calc(100vh-5rem)] sm:min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[440px_1fr]">
                    <aside className="flex items-center justify-center border-border bg-card/80 px-4 py-12 backdrop-blur sm:px-6 lg:border-r lg:px-10">
                        <div className="w-full max-w-[360px]">
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Create your account
                                </p>
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                    Sign up for Gateway
                                </h1>
                            </div>

                            <form
                                onSubmit={handleSubmit(submit)}
                                className="mt-8 flex flex-col gap-5"
                            >
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="accessCode"
                                        value="Access code"
                                        className="text-foreground"
                                    />

                                    <Controller
                                        name="accessCode"
                                        control={control}
                                        render={({ field }) => (
                                            <InputOTP
                                                id="accessCode"
                                                maxLength={10}
                                                pattern={
                                                    REGEXP_ONLY_DIGITS_AND_CHARS
                                                }
                                                value={field.value}
                                                onBlur={field.onBlur}
                                                onChange={(value) =>
                                                    field.onChange(
                                                        value.toUpperCase(),
                                                    )
                                                }
                                                onComplete={focusNameInput}
                                                containerClassName="justify-between"
                                            >
                                                {otpGroups.map(
                                                    (group, groupIndex) => (
                                                        <Fragment
                                                            key={group.join(
                                                                '-',
                                                            )}
                                                        >
                                                            {groupIndex > 0 && (
                                                                <InputOTPSeparator />
                                                            )}
                                                            <InputOTPGroup
                                                                className="*:data-[slot=input-otp-slot]:size-9 *:data-[slot=input-otp-slot]:text-sm"
                                                            >
                                                                {group.map(
                                                                    (index) => (
                                                                        <InputOTPSlot
                                                                            key={
                                                                                index
                                                                            }
                                                                            index={
                                                                                index
                                                                            }
                                                                            aria-invalid={
                                                                                hasAccessCodeError ||
                                                                                undefined
                                                                            }
                                                                        />
                                                                    ),
                                                                )}
                                                            </InputOTPGroup>
                                                        </Fragment>
                                                    ),
                                                )}
                                            </InputOTP>
                                        )}
                                    />

                                    <InputError
                                        message={
                                            validationErrors.accessCode?.message
                                        }
                                        className="text-destructive"
                                    />

                                    {userLevel && !hasAccessCodeError && (
                                        <p className="text-xs font-medium text-primary">
                                            Access level: {userLevel.label}
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="name"
                                        value="Name"
                                        className="text-foreground"
                                    />

                                    <TextInput
                                        id="name"
                                        className="block h-10 w-full border-border bg-background px-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                        autoComplete="name"
                                        {...register('name')}
                                    />

                                    <InputError
                                        message={
                                            validationErrors.name?.message
                                        }
                                        className="text-destructive"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="email"
                                        value="Email"
                                        className="text-foreground"
                                    />

                                    <TextInput
                                        id="email"
                                        type="email"
                                        className="block h-10 w-full border-border bg-background px-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                        autoComplete="username"
                                        {...register('email')}
                                    />

                                    <InputError
                                        message={
                                            validationErrors.email?.message
                                        }
                                        className="text-destructive"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="password"
                                        value="Password"
                                        className="text-foreground"
                                    />

                                    <TextInput
                                        id="password"
                                        type="password"
                                        className="block h-10 w-full border-border bg-background px-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                        autoComplete="new-password"
                                        {...register('password')}
                                    />

                                    <InputError
                                        message={
                                            validationErrors.password?.message
                                        }
                                        className="text-destructive"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="password_confirmation"
                                        value="Confirm Password"
                                        className="text-foreground"
                                    />

                                    <TextInput
                                        id="password_confirmation"
                                        type="password"
                                        className="block h-10 w-full border-border bg-background px-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                        autoComplete="new-password"
                                        {...register('password_confirmation')}
                                    />

                                    <InputError
                                        message={
                                            validationErrors
                                                .password_confirmation
                                                ?.message
                                        }
                                        className="text-destructive"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    size="lg"
                                    className="w-full"
                                    disabled={processing}
                                >
                                    Sign up
                                </Button>
                            </form>

                            <div className="mt-8 flex flex-col gap-4 text-sm text-muted-foreground">
                                <p>
                                    Already have an account?{' '}
                                    <Link
                                        href={route('login')}
                                        className="font-medium text-foreground underline-offset-4 transition hover:underline"
                                    >
                                        Sign in
                                    </Link>
                                </p>
                                <p className="text-xs leading-5">
                                    By creating an account, you can access
                                    Gateway Door Systems tools according to your
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
                                Start managing secure openings with confidence.
                            </h2>
                            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                                Create an account to coordinate door projects,
                                service requests, and facility access needs in
                                one focused workspace.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
