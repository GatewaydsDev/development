import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput from '@/Components/PhoneInput';
import ProfessionSelect from '@/Components/ProfessionSelect';
import TextInput from '@/Components/TextInput';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from '@inertiajs/react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { FormEventHandler, useMemo, useState } from 'react';
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
    type EmployeeFormData,
    type EmployeePayRateFormData,
    type EmployeePayload,
    type EmployeeRateTypeOptions,
    type EmployeeStatusOptions,
    type ProfessionOption,
} from '../types';

type EmployeeFormProps = {
    action: string;
    method?: 'post' | 'patch';
    submitLabel: string;
    title: string;
    description: string;
    professions: ProfessionOption[];
    rateTypeOptions: EmployeeRateTypeOptions;
    statusOptions: EmployeeStatusOptions;
    employee?: EmployeePayload;
};

function employeeSchema(
    statusOptions: EmployeeStatusOptions,
    rateTypeOptions: EmployeeRateTypeOptions,
) {
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
        pay_rates: z.array(
            z
                .object({
                    profession_id: z
                        .string()
                        .trim()
                        .min(1, 'Select a profession.'),
                    rate_type: z
                        .string()
                        .refine(
                            (value) =>
                                Object.keys(rateTypeOptions).includes(value),
                            'Select a valid rate type.',
                        ),
                    custom_rate_type: z.string().trim().max(255),
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
                    notes: z.string().trim().max(1000),
                })
                .superRefine((value, context) => {
                    if (
                        value.rate_type === 'custom' &&
                        value.custom_rate_type.trim() === ''
                    ) {
                        context.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['custom_rate_type'],
                            message: 'Enter a custom rate type.',
                        });
                    }
                }),
        ),
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
    professions,
    rateTypeOptions,
    statusOptions,
    employee,
}: EmployeeFormProps) {
    const [processing, setProcessing] = useState(false);
    const validationSchema = useMemo(
        () => employeeSchema(statusOptions, rateTypeOptions),
        [rateTypeOptions, statusOptions],
    );
    const {
        control,
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
    const { fields: payRateFields, append, remove } = useFieldArray({
        control,
        name: 'pay_rates',
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
    const setPayRateData = (
        index: number,
        field: keyof EmployeePayRateFormData,
        value: string,
    ) => {
        setValue(
            `pay_rates.${index}.${field}` as FieldPath<EmployeeFormData>,
            value as PathValue<EmployeeFormData, FieldPath<EmployeeFormData>>,
            {
                shouldDirty: true,
                shouldValidate: true,
            },
        );
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
    const addPayRate = () => {
        append({
            profession_id: '',
            rate_type: 'hourly',
            custom_rate_type: '',
            amount: '',
            notes: '',
        });
    };

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    onSubmit={submit}
                    className="flex min-w-0 flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6"
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

                    <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-foreground">
                                    Pay rates
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Add one or more rates for each profession,
                                    such as hourly, daily, overtime, or custom.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={addPayRate}
                                className="w-full sm:w-auto"
                            >
                                <PlusIcon className="size-4" />
                                Add pay rate
                            </Button>
                        </div>

                        {payRateFields.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                                No pay rates added yet.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {payRateFields.map((field, index) => {
                                    const payRate = data.pay_rates[index];

                                    return (
                                        <div
                                            key={field.id}
                                            className="grid gap-4 rounded-lg border border-border bg-background p-4 shadow-sm lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]"
                                        >
                                            <ProfessionSelect
                                                id={`employee-pay-rate-profession-${index}`}
                                                value={
                                                    payRate?.profession_id ?? ''
                                                }
                                                professions={professions}
                                                error={errorMessage(
                                                    validationErrors,
                                                    `pay_rates.${index}.profession_id`,
                                                )}
                                                onChange={(professionId) =>
                                                    setPayRateData(
                                                        index,
                                                        'profession_id',
                                                        professionId,
                                                    )
                                                }
                                            />

                                            <div className="flex flex-col gap-2">
                                                <InputLabel
                                                    htmlFor={`employee-pay-rate-type-${index}`}
                                                    value="Rate type"
                                                    className={labelClassName}
                                                />
                                                <select
                                                    id={`employee-pay-rate-type-${index}`}
                                                    value={
                                                        payRate?.rate_type ??
                                                        'hourly'
                                                    }
                                                    onChange={(event) =>
                                                        setPayRateData(
                                                            index,
                                                            'rate_type',
                                                            event.target.value,
                                                        )
                                                    }
                                                    className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                                >
                                                    {Object.entries(
                                                        rateTypeOptions,
                                                    ).map(([value, label]) => (
                                                        <option
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <InputError
                                                    message={errorMessage(
                                                        validationErrors,
                                                        `pay_rates.${index}.rate_type`,
                                                    )}
                                                />
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <InputLabel
                                                    htmlFor={`employee-pay-rate-amount-${index}`}
                                                    value="Amount"
                                                    className={labelClassName}
                                                />
                                                <TextInput
                                                    id={`employee-pay-rate-amount-${index}`}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={
                                                        payRate?.amount ?? ''
                                                    }
                                                    className={inputClassName}
                                                    placeholder="0.00"
                                                    onChange={(event) =>
                                                        setPayRateData(
                                                            index,
                                                            'amount',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    message={errorMessage(
                                                        validationErrors,
                                                        `pay_rates.${index}.amount`,
                                                    )}
                                                />
                                            </div>

                                            <div className="flex items-start lg:pt-7">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        remove(index)
                                                    }
                                                    className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/30 lg:w-auto"
                                                    aria-label="Remove pay rate"
                                                >
                                                    <Trash2Icon className="size-4" />
                                                    Remove
                                                </Button>
                                            </div>

                                            {payRate?.rate_type ===
                                                'custom' && (
                                                <div className="flex flex-col gap-2 lg:col-span-2">
                                                    <InputLabel
                                                        htmlFor={`employee-pay-rate-custom-${index}`}
                                                        value="Custom rate type"
                                                        className={
                                                            labelClassName
                                                        }
                                                    />
                                                    <TextInput
                                                        id={`employee-pay-rate-custom-${index}`}
                                                        value={
                                                            payRate.custom_rate_type
                                                        }
                                                        className={
                                                            inputClassName
                                                        }
                                                        placeholder="Example: Weekend emergency"
                                                        onChange={(event) =>
                                                            setPayRateData(
                                                                index,
                                                                'custom_rate_type',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                    <InputError
                                                        message={errorMessage(
                                                            validationErrors,
                                                            `pay_rates.${index}.custom_rate_type`,
                                                        )}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-2 lg:col-span-2">
                                                <InputLabel
                                                    htmlFor={`employee-pay-rate-notes-${index}`}
                                                    value="Rate notes"
                                                    className={labelClassName}
                                                />
                                                <TextInput
                                                    id={`employee-pay-rate-notes-${index}`}
                                                    value={payRate?.notes ?? ''}
                                                    className={inputClassName}
                                                    placeholder="Optional notes"
                                                    onChange={(event) =>
                                                        setPayRateData(
                                                            index,
                                                            'notes',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    message={errorMessage(
                                                        validationErrors,
                                                        `pay_rates.${index}.notes`,
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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
