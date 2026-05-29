import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import UserAvatar from '@/Components/UserAvatar';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { ChangeEvent, FormEventHandler, useEffect, useMemo, useState } from 'react';

type Level = {
    id: number;
    name: string;
};

type Language = {
    id: number;
    name: string;
    abbreviation: string;
};

type UserFormData = {
    name: string;
    email: string;
    avatar: File | null;
    date_of_birth: string;
    language_id: string;
    level_id: string;
    password: string;
    password_confirmation: string;
};

type UserFormProps = {
    userId?: number;
    levels: Level[];
    languages: Language[];
    submitLabel: string;
    title: string;
    description: string;
    action: string;
    method?: 'post' | 'patch';
    initialValues?: Partial<Omit<UserFormData, 'avatar'>>;
    currentAvatarUrl?: string | null;
    passwordOptional?: boolean;
};

const formatDateOfBirth = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);

    if (digits.length <= 2) {
        return digits;
    }

    if (digits.length <= 4) {
        return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const parseDateOfBirth = (value: string) => {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (!match) {
        return null;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
};

const getAgeInYears = (dateOfBirth: Date) => {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const birthdayThisYear = new Date(
        today.getFullYear(),
        dateOfBirth.getMonth(),
        dateOfBirth.getDate(),
    );

    if (today < birthdayThisYear) {
        age -= 1;
    }

    return age;
};

export default function UserForm({
    userId,
    levels,
    languages,
    submitLabel,
    title,
    description,
    action,
    method = 'post',
    initialValues = {},
    currentAvatarUrl = null,
    passwordOptional = false,
}: UserFormProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirmation, setShowPasswordConfirmation] =
        useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [emailTaken, setEmailTaken] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(
        currentAvatarUrl,
    );
    const { data, setData, errors, processing, post, transform } =
        useForm<UserFormData>({
            name: initialValues.name ?? '',
            email: initialValues.email ?? '',
            avatar: null,
            date_of_birth: initialValues.date_of_birth ?? '',
            language_id: initialValues.language_id ?? '',
            level_id: initialValues.level_id ?? '',
            password: '',
            password_confirmation: '',
        });

    transform((formData) =>
        method === 'patch'
            ? { ...formData, _method: 'PATCH' }
            : formData,
    );

    const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;

        setData('avatar', file);
        setAvatarPreview(file ? URL.createObjectURL(file) : currentAvatarUrl);
    };
    const dateOfBirthFeedback = useMemo(() => {
        if (!data.date_of_birth) {
            return null;
        }

        if (data.date_of_birth.length < 10) {
            return {
                type: 'error' as const,
                message: 'Enter a complete date in MM/DD/YYYY format.',
            };
        }

        const dateOfBirth = parseDateOfBirth(data.date_of_birth);
        const today = new Date();

        if (!dateOfBirth || dateOfBirth > today) {
            return {
                type: 'error' as const,
                message: 'Enter a valid date of birth.',
            };
        }

        const age = getAgeInYears(dateOfBirth);

        return {
            type: 'success' as const,
            message:
                age === 1
                    ? '1 year old'
                    : `${Math.max(age, 0).toLocaleString()} years old`,
        };
    }, [data.date_of_birth]);
    const hasDateOfBirthError = dateOfBirthFeedback?.type === 'error';

    useEffect(() => {
        const email = data.email.trim();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setCheckingEmail(false);
            setEmailTaken(false);
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            setCheckingEmail(true);

            const params = new URLSearchParams({ email });

            if (userId) {
                params.set('user_id', String(userId));
            }

            try {
                const response = await fetch(
                    `${route('admin.users.email-availability')}?${params.toString()}`,
                    {
                        signal: controller.signal,
                    },
                );

                if (!response.ok) {
                    return;
                }

                const result = (await response.json()) as {
                    available: boolean;
                };

                setEmailTaken(!result.available);
            } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    setEmailTaken(false);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setCheckingEmail(false);
                }
            }
        }, 450);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [data.email, userId]);

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        if (hasDateOfBirthError) {
            return;
        }

        post(action, { forceFormData: true });
    };
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="flex flex-col gap-6 pr-14 sm:pr-16">
                    <FormActionFab
                        cancelHref={route('admin.users.index')}
                        saveLabel={submitLabel}
                        disabled={
                            processing ||
                            checkingEmail ||
                            emailTaken ||
                            hasDateOfBirthError
                        }
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <UserAvatar
                            name={data.name}
                            avatarUrl={avatarPreview}
                            className="size-16 text-xl"
                        />
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="avatar"
                                value="Avatar image"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <input
                                id="avatar"
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={onAvatarChange}
                                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
                            />
                            <p className="text-xs text-muted-foreground">
                                PNG, JPG, or WEBP up to 2MB. Leave empty to keep
                                the current image.
                            </p>
                            <InputError message={errors.avatar} />
                        </div>
                    </div>

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
                                value="Email Address (Use name)"
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
                            {checkingEmail && (
                                <p className="text-sm text-muted-foreground">
                                    Checking email availability...
                                </p>
                            )}
                            {emailTaken && !checkingEmail && (
                                <p className="text-sm text-destructive">
                                    This email address has already been taken.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="date_of_birth"
                                value="Date of birth"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <TextInput
                                id="date_of_birth"
                                value={data.date_of_birth}
                                className="h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                inputMode="numeric"
                                maxLength={10}
                                placeholder="MM/DD/YYYY"
                                aria-invalid={
                                    hasDateOfBirthError ? true : undefined
                                }
                                onChange={(event) =>
                                    setData(
                                        'date_of_birth',
                                        formatDateOfBirth(event.target.value),
                                    )
                                }
                            />
                            <InputError message={errors.date_of_birth} />
                            {dateOfBirthFeedback && (
                                <p
                                    className={
                                        dateOfBirthFeedback.type === 'error'
                                            ? 'text-sm text-destructive'
                                            : 'text-sm text-muted-foreground'
                                    }
                                >
                                    {dateOfBirthFeedback.message}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="language_id"
                                value="Preferred language"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <select
                                id="language_id"
                                value={data.language_id}
                                onChange={(event) =>
                                    setData('language_id', event.target.value)
                                }
                                className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">
                                    Select a preferred language
                                </option>
                                {languages.map((language) => (
                                    <option
                                        key={language.id}
                                        value={language.id}
                                    >
                                        {language.name} ({language.abbreviation.toUpperCase()})
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.language_id} />
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
                </form>
            </CardContent>
        </Card>
    );
}
