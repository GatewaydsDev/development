import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

type Level = {
    id: number;
    name: string;
};

type UserFormData = {
    name: string;
    email: string;
    level_id: string;
    password: string;
    password_confirmation: string;
};

type UserFormProps = {
    levels: Level[];
    submitLabel: string;
    title: string;
    description: string;
    action: string;
    method?: 'post' | 'patch';
    initialValues?: Partial<UserFormData>;
    passwordOptional?: boolean;
};

export default function UserForm({
    levels,
    submitLabel,
    title,
    description,
    action,
    method = 'post',
    initialValues = {},
    passwordOptional = false,
}: UserFormProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirmation, setShowPasswordConfirmation] =
        useState(false);
    const { data, setData, errors, processing, post, patch } =
        useForm<UserFormData>({
            name: initialValues.name ?? '',
            email: initialValues.email ?? '',
            level_id: initialValues.level_id ?? '',
            password: '',
            password_confirmation: '',
        });

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        if (method === 'patch') {
            patch(action);
            return;
        }

        post(action);
    };

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="flex flex-col gap-6">
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="name"
                                value="Full name"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <TextInput
                                id="name"
                                value={data.name}
                                className="h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                autoComplete="name"
                                isFocused
                                onChange={(event) =>
                                    setData('name', event.target.value)
                                }
                            />
                            <InputError message={errors.name} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="email"
                                value="Email address"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <TextInput
                                id="email"
                                type="email"
                                value={data.email}
                                className="h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                autoComplete="email"
                                onChange={(event) =>
                                    setData('email', event.target.value)
                                }
                            />
                            <InputError message={errors.email} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="level_id"
                            value="User level"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <select
                            id="level_id"
                            value={data.level_id}
                            onChange={(event) =>
                                setData('level_id', event.target.value)
                            }
                            className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">Select a user level</option>
                            {levels.map((level) => (
                                <option key={level.id} value={level.id}>
                                    {level.name}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.level_id} />
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="password"
                                value={
                                    passwordOptional
                                        ? 'New password'
                                        : 'Password'
                                }
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <div className="relative">
                                <TextInput
                                    id="password"
                                    type={
                                        showPassword ? 'text' : 'password'
                                    }
                                    value={data.password}
                                    className="h-11 w-full border-border bg-background pe-11 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                    autoComplete="new-password"
                                    placeholder={
                                        passwordOptional
                                            ? 'Leave blank to keep current password'
                                            : ''
                                    }
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
                                        setShowPassword((current) => !current)
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
                            <InputError message={errors.password} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="password_confirmation"
                                value="Confirm password"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <div className="relative">
                                <TextInput
                                    id="password_confirmation"
                                    type={
                                        showPasswordConfirmation
                                            ? 'text'
                                            : 'password'
                                    }
                                    value={data.password_confirmation}
                                    className="h-11 w-full border-border bg-background pe-11 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
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
                                    className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
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
                            />
                        </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                        <Button variant="outline" asChild>
                            <Link href={route('admin.users.index')}>
                                Cancel
                            </Link>
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {submitLabel}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
