import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput from '@/Components/PhoneInput';
import TextInput from '@/Components/TextInput';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from '@inertiajs/react';
import { FormEventHandler, useMemo, useState } from 'react';
import {
    FieldErrors,
    FieldPath,
    PathValue,
    useForm,
} from 'react-hook-form';
import { z } from 'zod';
import {
    employeeToFormData,
    type EmployeeFormData,
    type EmployeePayload,
    type EmployeeStatusOptions,
} from '../types';

type EmployeeFormProps = {
    action: string;
    method?: 'post' | 'patch';
    submitLabel: string;
    title: string;
    description: string;
    statusOptions: EmployeeStatusOptions;
    employee?: EmployeePayload;
};

function employeeSchema(statusOptions: EmployeeStatusOptions) {
    return z.object({
        first_name: z.string().trim().min(1, 'Enter the first name.').max(255),
        last_name: z.string().trim().min(1, 'Enter the last name.').max(255),
        email: z.string().trim().email('Enter a valid email address.').max(255),
        phone_number: z.string().trim().max(50),
        job_title: z.string().trim().max(255),
        department: z.string().trim().max(255),
        employment_status: z
            .string()
            .refine(
                (value) => Object.keys(statusOptions).includes(value),
                'Select a valid status.',
            ),
        hire_date: z
            .string()
            .refine(
                (value) => value === '' || !Number.isNaN(Date.parse(value)),
                'Enter a valid hire date.',
            ),
        notes: z.string().trim().max(5000, 'Notes must be 5,000 characters or less.'),
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

export default function EmployeeForm({
    action,
    method = 'post',
    submitLabel,
    title,
    description,
    statusOptions,
    employee,
}: EmployeeFormProps) {
    const [processing, setProcessing] = useState(false);
    const validationSchema = useMemo(
        () => employeeSchema(statusOptions),
        [statusOptions],
    );
    const {
        handleSubmit,
        setError,
        setValue,
        watch,
        formState: { errors: validationErrors },
    } = useForm<EmployeeFormData>({
        resolver: zodResolver(validationSchema),
        defaultValues: employeeToFormData(employee),
        mode: 'onChange',
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

    const submit = handleSubmit((values) => {
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
            router.patch(action, values, submitOptions);
            return;
        }

        router.post(action, values, submitOptions);
    }) as FormEventHandler;

    const inputClassName =
        'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const labelClassName = 'text-emerald-700 dark:text-emerald-300';

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    onSubmit={submit}
                    className="flex flex-col gap-6 pr-14 sm:pr-16"
                >
                    <FormActionFab
                        cancelHref={route('admin.employees.index')}
                        saveLabel={submitLabel}
                        disabled={processing}
                    />

                    <section className="grid gap-5 md:grid-cols-2">
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
                    </section>

                    <section className="grid gap-5 md:grid-cols-2">
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
                                onChange={(event) =>
                                    setData('email', event.target.value)
                                }
                            />
                            <InputError message={errors.email} />
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
                    </section>

                    <section className="grid gap-5 md:grid-cols-2">
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
                    </section>

                    <section className="grid gap-5 md:grid-cols-2">
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
                                className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
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
                            <TextInput
                                id="employee-hire-date"
                                type="date"
                                value={data.hire_date}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData('hire_date', event.target.value)
                                }
                            />
                            <InputError message={errors.hire_date} />
                        </div>
                    </section>

                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="employee-notes"
                            value="Notes"
                            className={labelClassName}
                        />
                        <textarea
                            id="employee-notes"
                            value={data.notes}
                            rows={5}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                            onChange={(event) =>
                                setData('notes', event.target.value)
                            }
                        />
                        <InputError message={errors.notes} />
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
