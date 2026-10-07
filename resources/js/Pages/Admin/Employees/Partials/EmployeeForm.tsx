import DateMaskInput from '@/Components/DateMaskInput';
import UserLevelSelect, {
    type AccessPermission,
    type UserLevelOption,
} from '@/Components/UserLevelSelect';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import NamedCatalogSelect from '@/Components/NamedCatalogSelect';
import PhoneInput from '@/Components/PhoneInput';
import TextInput from '@/Components/TextInput';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { useProjectListRefresh } from '@/hooks/useProjectListRefresh';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { FormEventHandler, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
    FieldErrors,
    FieldPath,
    PathValue,
    useFieldArray,
    useForm,
} from 'react-hook-form';
import { z } from 'zod';
import {
    employeeToFormData,
    emptySkillRate,
    type CertificationOption,
    type EmployeeFormData,
    type EmployeePayload,
    type EmployeeRateTypeOptions,
    type EmployeeStatusOptions,
    type NamedOption,
} from '../types';
import EmployeeCertificationsFields from './EmployeeCertificationsFields';
import EmployeeRelationsFields from './EmployeeRelationsFields';

const defaultAccountPassword = 'Welcome!@';

type EmployeeFormProps = {
    action: string;
    method?: 'post' | 'patch';
    submitLabel: string;
    title: string;
    description: string;
    languages: NamedOption[];
    certifications?: CertificationOption[];
    skills: NamedOption[];
    skillsVersion?: string | null;
    rateTypeOptions: EmployeeRateTypeOptions;
    statusOptions: EmployeeStatusOptions;
    userLevels?: UserLevelOption[];
    accessPermissions?: AccessPermission[];
    canCreateUserLevel?: boolean;
    employee?: EmployeePayload;
};

const isoDate = z
    .string()
    .refine(
        (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
        'Enter a valid date as MM/DD/YYYY.',
    );

function calculateAge(dateOfBirth: string): number | null {
    const match = dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
        return null;
    }

    const [, yearValue, monthValue, dayValue] = match;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    const todayDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );

    if (
        birthDate.getFullYear() !== year ||
        birthDate.getMonth() !== month - 1 ||
        birthDate.getDate() !== day ||
        birthDate > todayDate
    ) {
        return null;
    }

    return (
        today.getFullYear() -
        year -
        (today.getMonth() < month - 1 ||
        (today.getMonth() === month - 1 && today.getDate() < day)
            ? 1
            : 0)
    );
}

function employeeSchema(
    statusOptions: EmployeeStatusOptions,
    rateTypeOptions: EmployeeRateTypeOptions,
    hasLogin: boolean,
) {
    return z.object({
        first_name: z.string().trim().min(1, 'Enter the first name.').max(255),
        last_name: z.string().trim().min(1, 'Enter the last name.').max(255),
        email: z.string().trim().email('Enter a valid email address.').max(255),
        phone_number: z.string().trim().max(50),
        job_title: z.string().trim().max(255),
        department: z.string().trim().max(255),
        account_level_id: z.string(),
        account_password: z.string(),
        account_password_confirmation: z.string(),
        employment_status: z
            .string()
            .refine(
                (value) => Object.keys(statusOptions).includes(value),
                'Select a valid status.',
            ),
        hire_date: isoDate,
        date_of_birth: isoDate.refine((value) => {
            if (value === '') {
                return true;
            }

            const date = new Date(`${value}T00:00:00`);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            return date <= today;
        }, 'Date of birth cannot be in the future.'),
        language_id: z.string(),
        notes: z.string().trim().max(5000, 'Notes must be 5,000 characters or less.'),
        certifications: z.array(
            z.object({
                certification_id: z
                    .string()
                    .trim()
                    .min(1, 'Select a certification or qualification.'),
                issued_on: isoDate,
                expires_on: isoDate,
            }),
        ),
        skills: z.array(
            z.object({
                skill_id: z.string().trim().min(1, 'Select a skill.'),
                rates: z.array(
                    z.object({
                        rate_type: z
                            .string()
                            .refine(
                                (value) =>
                                    Object.keys(rateTypeOptions).includes(
                                        value,
                                    ),
                                'Select a valid rate type.',
                            ),
                        amount: z
                            .string()
                            .trim()
                            .min(1, 'Enter an amount.')
                            .refine(
                                (value) =>
                                    !Number.isNaN(Number(value)) &&
                                    Number(value) > 0,
                                'Enter an amount greater than 0.',
                            ),
                    }),
                ),
            }),
        ),
    }).superRefine((value, context) => {
        const selectedSkills = new Set<string>();

        value.skills.forEach((skill, skillIndex) => {
            if (skill.skill_id && selectedSkills.has(skill.skill_id)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['skills', skillIndex, 'skill_id'],
                    message: 'This skill is already added.',
                });
            }

            if (skill.skill_id) {
                selectedSkills.add(skill.skill_id);
            }

            const selectedRates = new Set<string>();

            skill.rates.forEach((rate, rateIndex) => {
                if (selectedRates.has(rate.rate_type)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['skills', skillIndex, 'rates', rateIndex, 'rate_type'],
                        message: 'This rate is already added for this skill.',
                    });
                }

                selectedRates.add(rate.rate_type);
            });
        });

        if (value.account_level_id === '') {
            return;
        }

        const password = value.account_password.trim();
        const confirmation = value.account_password_confirmation.trim();
        const passwordRequired = !hasLogin || password !== '';

        if (passwordRequired && password.length < 8) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['account_password'],
                message: 'Enter a password of at least 8 characters.',
            });
        }

        if (passwordRequired && password !== confirmation) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['account_password_confirmation'],
                message: 'The password confirmation does not match.',
            });
        }
    });
}

function errorMessage(
    errors: FieldErrors<EmployeeFormData>,
    path: string,
): string | undefined {
    const fieldError = path.split('.').reduce<unknown>((carry, segment) => {
        if (!carry || typeof carry !== 'object') {
            return undefined;
        }

        return (carry as Record<string, unknown>)[segment];
    }, errors);

    return typeof fieldError === 'object' &&
        fieldError !== null &&
        'message' in fieldError
        ? String((fieldError as { message?: string }).message)
        : undefined;
}

function FormSection({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div>
                <h3 className="text-base font-semibold text-foreground">
                    {title}
                </h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
        </section>
    );
}

export default function EmployeeForm({
    action,
    method = 'post',
    submitLabel,
    title,
    description,
    languages,
    certifications = [],
    skills,
    skillsVersion = null,
    rateTypeOptions,
    statusOptions,
    userLevels = [],
    accessPermissions = [],
    canCreateUserLevel = false,
    employee,
}: EmployeeFormProps) {
    const [processing, setProcessing] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirmation, setShowPasswordConfirmation] =
        useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [emailTaken, setEmailTaken] = useState(false);
    const emailRequest = useRef(0);
    const originalEmail = (employee?.email ?? '').trim().toLowerCase();

    useProjectListRefresh(
        skillsVersion,
        ['skills', 'skillsVersion'],
        'admin.skills.version',
    );
    const validationSchema = useMemo(
        () =>
            employeeSchema(
                statusOptions,
                rateTypeOptions,
                Boolean(employee?.user),
            ),
        [employee?.user, rateTypeOptions, statusOptions],
    );
    const initialAccountLevelId = employee
        ? employee.user?.level
            ? String(employee.user.level.id)
            : ''
        : String(
              userLevels.find((level) => level.name === 'Employee')?.id ?? '',
          );
    const {
        control,
        handleSubmit,
        getValues,
        setError,
        clearErrors,
        setValue,
        watch,
        formState: { errors: validationErrors },
    } = useForm<EmployeeFormData>({
        resolver: zodResolver(validationSchema),
        defaultValues: {
            ...employeeToFormData(employee),
            account_level_id: initialAccountLevelId,
            account_password:
                !employee?.user && initialAccountLevelId !== ''
                    ? defaultAccountPassword
                    : '',
            account_password_confirmation:
                !employee?.user && initialAccountLevelId !== ''
                    ? defaultAccountPassword
                    : '',
        },
        mode: 'onChange',
    });
    const {
        append: appendSkill,
        remove: removeSkill,
    } = useFieldArray({
        control,
        name: 'skills',
    });
    const { append: appendCertification, remove: removeCertification } =
        useFieldArray({
            control,
            name: 'certifications',
        });
    const data = watch();
    const errors = new Proxy({} as Record<string, string | undefined>, {
        get: (_target, property) =>
            errorMessage(validationErrors, String(property)),
    });
    const setData = <Field extends FieldPath<EmployeeFormData>>(
        field: Field,
        value: PathValue<EmployeeFormData, Field>,
    ) => {
        setValue(field, value, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };
    const selectAccountLevel = (levelId: string) => {
        setData('account_level_id', levelId);

        if (levelId === '') {
            return;
        }

        if (getValues('account_password').trim() === '') {
            setData('account_password', defaultAccountPassword);
        }

        if (getValues('account_password_confirmation').trim() === '') {
            setData(
                'account_password_confirmation',
                defaultAccountPassword,
            );
        }
    };
    const checkEmailAvailability = async (value: string): Promise<boolean> => {
        const email = value.trim();
        const requestId = ++emailRequest.current;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setCheckingEmail(false);
            setEmailTaken(false);
            return true;
        }

        if (originalEmail !== '' && email.toLowerCase() === originalEmail) {
            setCheckingEmail(false);
            setEmailTaken(false);
            clearErrors('email');
            return true;
        }

        setCheckingEmail(true);

        const params = new URLSearchParams({ email });

        if (employee?.uuid) {
            params.set('employee', employee.uuid);
        }

        let availabilityUrl: string;

        try {
            availabilityUrl = `${route(
                'admin.employees.email-availability',
                undefined,
                false,
            )}?${params.toString()}`;
        } catch {
            availabilityUrl = `/administration/employees/email-availability?${params.toString()}`;
        }

        try {
            const response = await fetch(availabilityUrl, {
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (requestId !== emailRequest.current) {
                return false;
            }

            if (!response.ok) {
                setEmailTaken(false);
                return true;
            }

            const result = (await response.json()) as { available: boolean };

            if (!result.available) {
                setEmailTaken(true);
                setError('email', {
                    type: 'server',
                    message: 'This email address has already been taken.',
                });
                return false;
            }

            setEmailTaken(false);
            clearErrors('email');
            return true;
        } catch {
            if (requestId === emailRequest.current) {
                setEmailTaken(false);
            }

            return true;
        } finally {
            if (requestId === emailRequest.current) {
                setCheckingEmail(false);
            }
        }
    };

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void checkEmailAvailability(data.email);
        }, 400);

        return () => window.clearTimeout(timeout);
    }, [data.email]);
    const setSkillRate = (
        skillIndex: number,
        rateIndex: number,
        field: 'rate_type' | 'amount',
        value: string,
    ) => {
        setValue(`skills.${skillIndex}.rates.${rateIndex}.${field}`, value, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };
    const addSkillRate = (skillIndex: number) => {
        const rates = getValues(`skills.${skillIndex}.rates`) ?? [];

        setValue(`skills.${skillIndex}.rates`, [...rates, emptySkillRate()], {
            shouldDirty: true,
            shouldValidate: true,
        });
    };
    const removeSkillRate = (skillIndex: number, rateIndex: number) => {
        const rates = getValues(`skills.${skillIndex}.rates`) ?? [];

        setValue(
            `skills.${skillIndex}.rates`,
            rates.filter((_, index) => index !== rateIndex),
            {
                shouldDirty: true,
                shouldValidate: true,
            },
        );
    };

    const submit = handleSubmit(async (values) => {
        const emailIsAvailable = await checkEmailAvailability(values.email);

        if (!emailIsAvailable) {
            return;
        }

        const { skills: skillRows, ...employeeValues } = values;
        const payload = {
            ...employeeValues,
            language_id: values.language_id || null,
            account_level_id: values.account_level_id || null,
            account_password: values.account_password,
            account_password_confirmation:
                values.account_password_confirmation,
            certifications: values.certifications,
            skill_ids: skillRows
                .map((skill) => skill.skill_id)
                .filter(Boolean),
            pay_rates: skillRows.flatMap((skill) =>
                skill.rates.map((rate) => ({
                    skill_id: skill.skill_id,
                    rate_type: rate.rate_type,
                    amount: rate.amount,
                })),
            ),
        };
        const submitOptions = {
            onBefore: () => setProcessing(true),
            onError: (serverErrors: Record<string, string>) => {
                Object.entries(serverErrors).forEach(([field, message]) => {
                    setError(field as FieldPath<EmployeeFormData>, {
                        type: 'server',
                        message: String(message),
                    });
                });
            },
            onFinish: () => setProcessing(false),
        };

        if (method === 'patch') {
            router.patch(action, payload, submitOptions);
            return;
        }

        router.post(action, payload, submitOptions);
    }) as FormEventHandler;

    const inputClassName =
        'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const labelClassName = 'text-emerald-700 dark:text-emerald-300';
    const employeeAge = calculateAge(data.date_of_birth);
    const setRowValue = (field: FieldPath<EmployeeFormData>, value: string | boolean) => {
        setValue(field, value as PathValue<EmployeeFormData, FieldPath<EmployeeFormData>>, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };
    const selectClassName =
        'h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring';

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    onSubmit={submit}
                    className="flex w-full min-w-0 max-w-full flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6"
                >
                    <FormActionFab
                        cancelHref={route('admin.employees.index')}
                        saveLabel={submitLabel}
                        disabled={processing || checkingEmail || emailTaken}
                    />

                    <FormSection
                        title="Personal details"
                        description="Name, contact information, and preferred language."
                    >
                        <div className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="employee-first-name"
                                value="First name"
                                className={labelClassName}
                            />
                            <TextInput
                                id="employee-first-name"
                                value={data.first_name}
                                className={inputClassName}
                                autoComplete="given-name"
                                isFocused
                                onChange={(event) =>
                                    setData('first_name', event.target.value)
                                }
                            />
                            <InputError message={errors.first_name} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="employee-last-name"
                                value="Last name"
                                className={labelClassName}
                            />
                            <TextInput
                                id="employee-last-name"
                                value={data.last_name}
                                className={inputClassName}
                                autoComplete="family-name"
                                onChange={(event) =>
                                    setData('last_name', event.target.value)
                                }
                            />
                            <InputError message={errors.last_name} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="employee-email"
                                value="Email address"
                                className={labelClassName}
                            />
                            <TextInput
                                id="employee-email"
                                type="email"
                                value={data.email}
                                className={inputClassName}
                                autoComplete="email"
                                onChange={(event) => {
                                    emailRequest.current += 1;
                                    setEmailTaken(false);
                                    setData('email', event.target.value);
                                }}
                                onBlur={(event) => {
                                    void checkEmailAvailability(
                                        event.target.value,
                                    );
                                }}
                            />
                            <InputError
                                message={
                                    emailTaken
                                        ? 'This email address has already been taken.'
                                        : errors.email
                                }
                            />
                            {checkingEmail && (
                                <p className="text-sm text-muted-foreground">
                                    Checking email availability...
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="employee-phone"
                                value="Phone number"
                                className={labelClassName}
                            />
                            <PhoneInput
                                id="employee-phone"
                                value={data.phone_number}
                                className={inputClassName}
                                autoComplete="tel"
                                onValueChange={(value) =>
                                    setData('phone_number', value)
                                }
                            />
                            <InputError message={errors.phone_number} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="employee-date-of-birth"
                                value="Date of birth"
                                className={labelClassName}
                            />
                            <DateMaskInput
                                id="employee-date-of-birth"
                                value={data.date_of_birth}
                                className={`${inputClassName} max-w-40`}
                                onValueChange={(value) =>
                                    setData('date_of_birth', value)
                                }
                            />
                            {employeeAge !== null && (
                                <p className="text-sm text-muted-foreground">
                                    Age: {employeeAge}{' '}
                                    {employeeAge === 1 ? 'year' : 'years'}
                                </p>
                            )}
                            <InputError message={errors.date_of_birth} />
                        </div>

                        <NamedCatalogSelect
                            id="employee-language"
                            label="Preferred language"
                            placeholder="Select a language"
                            addLabel="Add language"
                            items={languages}
                            value={data.language_id}
                            reloadKey="languages"
                            storeRoute="admin.languages.store"
                            error={errors.language_id}
                            onChange={(languageId) =>
                                setData('language_id', languageId)
                            }
                        />
                        </div>
                    </FormSection>

                    <FormSection
                        title="Employment"
                        description="Job title, department, status, and hire date."
                    >
                        <div className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="employee-job-title"
                                value="Job title"
                                className={labelClassName}
                            />
                            <TextInput
                                id="employee-job-title"
                                value={data.job_title}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData('job_title', event.target.value)
                                }
                            />
                            <InputError message={errors.job_title} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="employee-department"
                                value="Department"
                                className={labelClassName}
                            />
                            <TextInput
                                id="employee-department"
                                value={data.department}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData('department', event.target.value)
                                }
                            />
                            <InputError message={errors.department} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="employee-status"
                                value="Employment status"
                                className={labelClassName}
                            />
                            <select
                                id="employee-status"
                                value={data.employment_status}
                                onChange={(event) =>
                                    setData(
                                        'employment_status',
                                        event.target.value,
                                    )
                                }
                                className={selectClassName}
                            >
                                {Object.entries(statusOptions).map(
                                    ([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ),
                                )}
                            </select>
                            <InputError message={errors.employment_status} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="employee-hire-date"
                                value="Hire date"
                                className={labelClassName}
                            />
                            <DateMaskInput
                                id="employee-hire-date"
                                value={data.hire_date}
                                className={`${inputClassName} max-w-40`}
                                onValueChange={(value) =>
                                    setData('hire_date', value)
                                }
                            />
                            <InputError message={errors.hire_date} />
                        </div>
                        </div>
                    </FormSection>

                    <FormSection
                        title="App login"
                        description="Choose Employee, Foreman, or another existing level. A new name asks before it is added."
                    >
                        <div className="grid gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <UserLevelSelect
                                id="employee-account-level"
                                label="User level"
                                value={data.account_level_id}
                                levels={userLevels}
                                permissions={accessPermissions}
                                canCreate={canCreateUserLevel}
                                reloadOnly="userLevels"
                                emptyLabel={
                                    employee?.user
                                        ? 'Keep the current login'
                                        : 'No app login'
                                }
                                error={errors.account_level_id}
                                onChange={selectAccountLevel}
                            />
                        </div>

                        {data.account_level_id !== '' && (
                            <>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="employee-account-password"
                                        value={
                                            employee?.user
                                                ? 'New password'
                                                : 'Password'
                                        }
                                        className={labelClassName}
                                    />
                                    <div className="relative">
                                        <TextInput
                                            id="employee-account-password"
                                            type={
                                                showPassword
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            value={data.account_password}
                                            className={`${inputClassName} pe-11`}
                                            autoComplete="new-password"
                                            onChange={(event) =>
                                                setData(
                                                    'account_password',
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
                                        message={errors.account_password}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="employee-account-password-confirmation"
                                        value="Confirm password"
                                        className={labelClassName}
                                    />
                                    <div className="relative">
                                        <TextInput
                                            id="employee-account-password-confirmation"
                                            type={
                                                showPasswordConfirmation
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            value={
                                                data.account_password_confirmation
                                            }
                                            className={`${inputClassName} pe-11`}
                                            autoComplete="new-password"
                                            onChange={(event) =>
                                                setData(
                                                    'account_password_confirmation',
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
                                        message={
                                            errors.account_password_confirmation
                                        }
                                    />
                                </div>
                            </>
                        )}
                        </div>
                    </FormSection>

                    <EmployeeCertificationsFields
                        certifications={data.certifications}
                        errors={validationErrors}
                        labelClassName={labelClassName}
                        onChange={(index, field, value) =>
                            setRowValue(
                                `certifications.${index}.${field}`,
                                value,
                            )
                        }
                        catalog={certifications}
                        onAdd={() =>
                            appendCertification({
                                certification_id: '',
                                issued_on: '',
                                expires_on: '',
                            })
                        }
                        onRemove={removeCertification}
                    />

                    <EmployeeRelationsFields
                        data={data}
                        validationErrors={validationErrors}
                        skills={skills}
                        inputClassName={inputClassName}
                        labelClassName={labelClassName}
                        setSkill={(index, skillId) =>
                            setRowValue(`skills.${index}.skill_id`, skillId)
                        }
                        rateTypeOptions={rateTypeOptions}
                        setSkillRate={setSkillRate}
                        addSkillRate={addSkillRate}
                        removeSkillRate={removeSkillRate}
                        addSkill={() =>
                            appendSkill({
                                skill_id: '',
                                rates: [emptySkillRate()],
                            })
                        }
                        removeSkill={removeSkill}
                    />


                    <FormSection
                        title="Notes"
                        description="Optional details that do not belong in the fields above."
                    >
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="employee-notes"
                                value="Notes"
                                className={labelClassName}
                            />
                            <textarea
                                id="employee-notes"
                                value={data.notes}
                                rows={4}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                onChange={(event) =>
                                    setData('notes', event.target.value)
                                }
                            />
                            <InputError message={errors.notes} />
                        </div>
                    </FormSection>
                </form>
            </CardContent>
        </Card>
    );
}
