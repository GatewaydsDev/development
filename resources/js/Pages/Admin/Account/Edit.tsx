import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

type Account = {
    name: string;
    email: string;
};

type EditProps = {
    account: Account;
};

type AccountFormData = {
    name: string;
    password: string;
    password_confirmation: string;
};

export default function Edit({ account }: EditProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirmation, setShowPasswordConfirmation] =
        useState(false);
    const {
        data,
        setData,
        errors,
        processing,
        patch,
        recentlySuccessful,
        reset,
    } = useForm<AccountFormData>({
        name: account.name,
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        patch(route('admin.account.update'), {
            preserveScroll: true,
            onSuccess: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <span className="text-foreground">Account</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Account
                    </h2>
                </div>
            }
        >
            <Head title="Account" />

            <div className="py-6 sm:py-10">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    <Card className="shadow-sm">
                        <CardHeader className="p-6 sm:p-8">
                            <CardTitle className="text-2xl">
                                Update your account
                            </CardTitle>
                            <CardDescription className="max-w-2xl text-base leading-7">
                                Change your account name and optionally set a
                                new password. Names must be unique.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
                            <form
                                onSubmit={submit}
                                className="flex flex-col gap-8 pr-14 sm:pr-16"
                            >
                                <FormActionFab
                                    cancelHref={route('dashboard')}
                                    saveLabel="Save changes"
                                    disabled={processing}
                                />
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="flex flex-col gap-3">
                                        <InputLabel
                                            htmlFor="account-name"
                                            value="Account name"
                                            className="text-base text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="account-name"
                                            value={data.name}
                                            className="h-14 w-full border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                            autoComplete="name"
                                            isFocused
                                            onChange={(event) =>
                                                setData(
                                                    'name',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError message={errors.name} />
                                    </div>

                                    <div className="flex flex-col gap-3 md:col-span-2">
                                        <InputLabel
                                            htmlFor="account-email"
                                            value="Email address (User name)"
                                            className="text-base text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="account-email"
                                            type="email"
                                            value={account.email}
                                            className="h-14 w-full border-border bg-muted px-4 text-base text-muted-foreground"
                                            disabled
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="flex flex-col gap-3">
                                        <InputLabel
                                            htmlFor="account-password"
                                            value="New password"
                                            className="text-base text-emerald-700 dark:text-emerald-300"
                                        />
                                        <div className="relative">
                                            <TextInput
                                                id="account-password"
                                                type={
                                                    showPassword
                                                        ? 'text'
                                                        : 'password'
                                                }
                                                value={data.password}
                                                className="h-14 w-full border-border bg-background px-4 pe-12 text-base text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                                autoComplete="new-password"
                                                placeholder="Leave blank to keep current password"
                                                onChange={(event) =>
                                                    setData(
                                                        'password',
                                                        event.target.value,
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
                                                className="absolute inset-y-0 end-0 flex items-center px-4 text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                                                aria-label={
                                                    showPassword
                                                        ? 'Hide password'
                                                        : 'Show password'
                                                }
                                            >
                                                {showPassword ? (
                                                    <EyeOffIcon className="size-4" />
                                                ) : (
                                                    <EyeIcon className="size-4" />
                                                )}
                                            </button>
                                        </div>
                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <InputLabel
                                            htmlFor="account-password-confirmation"
                                            value="Confirm password"
                                            className="text-base text-emerald-700 dark:text-emerald-300"
                                        />
                                        <div className="relative">
                                            <TextInput
                                                id="account-password-confirmation"
                                                type={
                                                    showPasswordConfirmation
                                                        ? 'text'
                                                        : 'password'
                                                }
                                                value={
                                                    data.password_confirmation
                                                }
                                                className="h-14 w-full border-border bg-background px-4 pe-12 text-base text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                                autoComplete="new-password"
                                                onChange={(event) =>
                                                    setData(
                                                        'password_confirmation',
                                                        event.target.value,
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
                                                className="absolute inset-y-0 end-0 flex items-center px-4 text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                                                aria-label={
                                                    showPasswordConfirmation
                                                        ? 'Hide password confirmation'
                                                        : 'Show password confirmation'
                                                }
                                            >
                                                {showPasswordConfirmation ? (
                                                    <EyeOffIcon className="size-4" />
                                                ) : (
                                                    <EyeIcon className="size-4" />
                                                )}
                                            </button>
                                        </div>
                                        <InputError
                                            message={
                                                errors.password_confirmation
                                            }
                                        />
                                    </div>
                                </div>

                                {recentlySuccessful && (
                                    <p className="border-t border-border pt-6 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                        Account updated.
                                    </p>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

