import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import CustomerSelect from '@/Components/CustomerSelect';
import FormActionFab from '@/Components/FormActionFab';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from '@inertiajs/react';
import { FormEventHandler, useMemo, useState } from 'react';
import {
    FieldErrors,
    FieldPath,
    PathValue,
    useForm,
} from 'react-hook-form';
import { z } from 'zod';
import {
    optionLabel,
    projectToFormData,
    type ProjectFormData,
    type ProjectOptions,
    type ProjectPayload,
} from '../types';

type ProjectFormProps = {
    action: string;
    method?: 'post' | 'patch';
    submitLabel: string;
    title: string;
    description: string;
    options: ProjectOptions;
    project?: ProjectPayload;
};

const optionalDateSchema = z
    .string()
    .refine(
        (value) => value === '' || !Number.isNaN(Date.parse(value)),
        'Enter a valid date.',
    );

const optionalMoneySchema = z
    .string()
    .refine(
        (value) => value === '' || Number(value) >= 0,
        'Budget amount must be zero or greater.',
    );

function projectSchema(options: ProjectOptions, canEditCoreFields: boolean) {
    return z
        .object({
            name: canEditCoreFields
                ? z.string().trim().min(1, 'Enter the project name.').max(255)
                : z.string(),
            project_number: z.string().trim().max(255),
            customer_id: canEditCoreFields
                ? z.string().min(1, 'Select a customer.')
                : z.string(),
            assigned_to: z.string(),
            service_type: z
                .string()
                .refine(
                    (value) => value === '' || options.serviceTypes.includes(value),
                    'Select a valid service type.',
                ),
            status: z
                .string()
                .refine(
                    (value) => options.statuses.includes(value),
                    'Select a valid status.',
                ),
            priority: z
                .string()
                .refine(
                    (value) => options.priorities.includes(value),
                    'Select a valid priority.',
                ),
            site_address_line_1: z.string().trim().max(255),
            site_address_line_2: z.string().trim().max(255),
            site_city: z.string().trim().max(255),
            site_state: z.string().trim().max(255),
            site_postal_code: z.string().trim().max(50),
            site_country: z.string().trim().max(255),
            estimated_start_date: optionalDateSchema,
            estimated_end_date: optionalDateSchema,
            completed_at: optionalDateSchema,
            budget_amount: optionalMoneySchema,
            public_notes: z.string().trim().max(5000, 'Project notes must be 5,000 characters or less.'),
            internal_notes: z.string().trim().max(5000, 'Internal notes must be 5,000 characters or less.'),
        })
        .refine(
            (values) =>
                values.estimated_start_date === '' ||
                values.estimated_end_date === '' ||
                new Date(values.estimated_end_date) >=
                    new Date(values.estimated_start_date),
            {
                path: ['estimated_end_date'],
                message: 'Estimated end must be on or after estimated start.',
            },
        );
}

function errorMessage(
    errors: FieldErrors<ProjectFormData>,
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

export default function ProjectForm({
    action,
    method = 'post',
    submitLabel,
    title,
    description,
    options,
    project,
}: ProjectFormProps) {
    const [processing, setProcessing] = useState(false);
    const canEditCoreFields =
        options.can.create || options.can.viewCustomerContactFields;
    const canViewSensitive = options.can.viewSensitiveFields;
    const validationSchema = useMemo(
        () => projectSchema(options, canEditCoreFields),
        [canEditCoreFields, options],
    );
    const {
        handleSubmit,
        setError,
        setValue,
        watch,
        formState: { errors: validationErrors },
    } = useForm<ProjectFormData>({
        resolver: zodResolver(validationSchema),
        defaultValues: projectToFormData(project),
        mode: 'onChange',
    });
    const data = watch();

    const submit = handleSubmit((values) => {
        const submitOptions = {
            onBefore: () => setProcessing(true),
            onError: (serverErrors: Record<string, string>) => {
                Object.entries(serverErrors).forEach(([field, message]) => {
                    setError(field as FieldPath<ProjectFormData>, {
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
    const errors = new Proxy({} as Record<string, string | undefined>, {
        get: (_target, property) =>
            errorMessage(validationErrors, String(property)),
    });
    const setData = <Field extends FieldPath<ProjectFormData>>(
        field: Field,
        value: PathValue<ProjectFormData, Field>,
    ) => {
        setValue(field, value, {
            shouldDirty: true,
            shouldValidate: true,
        });
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
                        cancelHref={route('admin.projects.index')}
                        saveLabel={submitLabel}
                        disabled={processing}
                    />
                    {canEditCoreFields && (
                        <>
                            <section className="grid gap-5 md:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="project-name"
                                        value="Project name"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id="project-name"
                                        value={data.name}
                                        className={inputClassName}
                                        isFocused
                                        onChange={(event) =>
                                            setData('name', event.target.value)
                                        }
                                    />
                                    <InputError message={errors.name} />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="project-number"
                                        value="Project number"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id="project-number"
                                        value={data.project_number}
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setData(
                                                'project_number',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={errors.project_number} />
                                </div>
                            </section>

                            <CustomerSelect
                                customers={options.customers}
                                value={data.customer_id}
                                onChange={(value) =>
                                    setData('customer_id', value)
                                }
                                error={errors.customer_id}
                            />

                            <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-3">
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="service-type"
                                        value="Service type"
                                        className={labelClassName}
                                    />
                                    <select
                                        id="service-type"
                                        value={data.service_type}
                                        onChange={(event) =>
                                            setData(
                                                'service_type',
                                                event.target.value,
                                            )
                                        }
                                        className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        <option value="">Select a service</option>
                                        {options.serviceTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {optionLabel(type)}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={errors.service_type} />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="assigned-to"
                                        value="Assigned to"
                                        className={labelClassName}
                                    />
                                    <select
                                        id="assigned-to"
                                        value={data.assigned_to}
                                        onChange={(event) =>
                                            setData(
                                                'assigned_to',
                                                event.target.value,
                                            )
                                        }
                                        className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        <option value="">Unassigned</option>
                                        {options.assignees.map((assignee) => (
                                            <option
                                                key={assignee.id}
                                                value={assignee.id}
                                            >
                                                {assignee.name}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={errors.assigned_to} />
                                </div>
                            </section>
                        </>
                    )}

                    <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="project-status"
                                value="Status"
                                className={labelClassName}
                            />
                            <select
                                id="project-status"
                                value={data.status}
                                onChange={(event) =>
                                    setData('status', event.target.value)
                                }
                                className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {options.statuses.map((status) => (
                                    <option key={status} value={status}>
                                        {optionLabel(status)}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.status} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="project-priority"
                                value="Priority"
                                className={labelClassName}
                            />
                            <select
                                id="project-priority"
                                value={data.priority}
                                onChange={(event) =>
                                    setData('priority', event.target.value)
                                }
                                className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {options.priorities.map((priority) => (
                                    <option key={priority} value={priority}>
                                        {optionLabel(priority)}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.priority} />
                        </div>

                        {canViewSensitive && (
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="budget-amount"
                                    value="Budget amount"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="budget-amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={data.budget_amount}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData(
                                            'budget_amount',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={errors.budget_amount} />
                            </div>
                        )}
                    </section>

                    {canEditCoreFields && (
                        <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="site-address-line-1"
                                    value="Site address line 1"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="site-address-line-1"
                                    value={data.site_address_line_1}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData(
                                            'site_address_line_1',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="site-address-line-2"
                                    value="Site address line 2"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="site-address-line-2"
                                    value={data.site_address_line_2}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData(
                                            'site_address_line_2',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="site-city"
                                    value="Site city"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="site-city"
                                    value={data.site_city}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData('site_city', event.target.value)
                                    }
                                />
                            </div>
                            <div className="grid gap-5 sm:grid-cols-3">
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="site-state"
                                        value="State"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id="site-state"
                                        value={data.site_state}
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setData(
                                                'site_state',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="site-postal-code"
                                        value="Postal code"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id="site-postal-code"
                                        value={data.site_postal_code}
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setData(
                                                'site_postal_code',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="site-country"
                                        value="Country"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id="site-country"
                                        value={data.site_country}
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setData(
                                                'site_country',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="estimated-start-date"
                                value="Estimated start"
                                className={labelClassName}
                            />
                            <TextInput
                                id="estimated-start-date"
                                type="date"
                                value={data.estimated_start_date}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData(
                                        'estimated_start_date',
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="estimated-end-date"
                                value="Estimated end"
                                className={labelClassName}
                            />
                            <TextInput
                                id="estimated-end-date"
                                type="date"
                                value={data.estimated_end_date}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData(
                                        'estimated_end_date',
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="completed-at"
                                value="Completed at"
                                className={labelClassName}
                            />
                            <TextInput
                                id="completed-at"
                                type="date"
                                value={data.completed_at}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData('completed_at', event.target.value)
                                }
                            />
                        </div>
                    </section>

                    <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="public-notes"
                                value="Project notes"
                                className={labelClassName}
                            />
                            <textarea
                                id="public-notes"
                                value={data.public_notes}
                                className="min-h-32 w-full rounded-md border border-border bg-background px-3 py-3 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                onChange={(event) =>
                                    setData('public_notes', event.target.value)
                                }
                            />
                            <InputError message={errors.public_notes} />
                        </div>

                        {canViewSensitive && (
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="internal-notes"
                                    value="Internal notes"
                                    className={labelClassName}
                                />
                                <textarea
                                    id="internal-notes"
                                    value={data.internal_notes}
                                    className="min-h-32 w-full rounded-md border border-border bg-background px-3 py-3 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                    onChange={(event) =>
                                        setData(
                                            'internal_notes',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={errors.internal_notes} />
                            </div>
                        )}
                    </section>

                </form>
            </CardContent>
        </Card>
    );
}

