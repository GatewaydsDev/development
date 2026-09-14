import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import ContractorSelect from '@/Components/ContractorSelect';
import CreatableSelect from '@/Components/CreatableSelect';
import PhoneInput from '@/Components/PhoneInput';
import FormActionFab from '@/Components/FormActionFab';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import RichTextEditor from '@/Components/RichTextEditor';
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
import { router, usePage, Link } from '@inertiajs/react';
import { inputToDecimal, parseDecimal } from '@/lib/money';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { FormEventHandler, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    FieldErrors,
    FieldPath,
    PathValue,
    useFieldArray,
    useForm,
} from 'react-hook-form';
import { z } from 'zod';
import { type PageProps } from '@/types';
import {
    blankContractor,
    blankRevision,
    blankScope,
    optionLabel,
    projectToFormData,
    type ProjectFormData,
    type ProjectOptions,
    type ProjectPayload,
    type ProjectRevisionFormData,
    type ProjectScopeFormData,
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

const optionalMoneySchema = z.string().refine((value) => {
    if (value.trim() === '') {
        return true;
    }

    const amount = parseDecimal(value);

    return amount !== null && amount >= 0;
}, 'Budget amount must be zero or greater.');

const optionalEmailSchema = z
    .string()
    .trim()
    .max(255, 'Email must be 255 characters or less.')
    .refine(
        (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        'Enter a valid email address.',
    );

function projectSchema(options: ProjectOptions, canEditCoreFields: boolean) {
    const scopeTypeSlugs = (options.scopeTypes ?? []).map((type) => type.slug);

    return z
        .object({
            name: canEditCoreFields
                ? z.string().trim().min(1, 'Enter the project name.').max(255)
                : z.string(),
            project_number: z.string().trim().max(255),
            customer_id: z.string(),
            customer_company_name: z
                .string()
                .trim()
                .max(255, 'Company name must be 255 characters or less.'),
            customer_email: optionalEmailSchema,
            customer_phone_number: z
                .string()
                .trim()
                .max(50, 'Phone number must be 50 characters or less.'),
            assigned_to: z.string(),
            status_id: z.string().trim().min(1, 'Select a status.'),
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
            public_notes: z
                .string()
                .trim()
                .max(5000, 'Project notes must be 5,000 characters or less.'),
            internal_notes: z
                .string()
                .trim()
                .max(5000, 'Internal notes must be 5,000 characters or less.'),
            contractors: z.array(
                z.object({
                    contractor_id: z.string(),
                    company_name: z
                        .string()
                        .trim()
                        .max(255, 'Company name must be 255 characters or less.'),
                    contact_name: z
                        .string()
                        .trim()
                        .max(255, 'Contact name must be 255 characters or less.'),
                    email: optionalEmailSchema,
                    phone_number: z
                        .string()
                        .trim()
                        .max(50, 'Phone number must be 50 characters or less.'),
                }),
            ),
            scopes: z.array(
                z.object({
                    type: z.string(),
                    notes: z
                        .string()
                        .max(250000, 'Scope text must be 250,000 characters or less.'),
                }),
            ),
            revisions: z.array(
                z.object({
                    id: z.string(),
                    number: z.string().trim().max(50),
                    revision_date: optionalDateSchema,
                    notes: z
                        .string()
                        .trim()
                        .max(2000, 'Revision notes must be 2,000 characters or less.'),
                    user_id: z.string(),
                    user_name: z.string(),
                }),
            ),
        })
        .superRefine((values, context) => {
            if (
                values.estimated_start_date !== '' &&
                values.estimated_end_date !== '' &&
                new Date(values.estimated_end_date) <
                    new Date(values.estimated_start_date)
            ) {
                context.addIssue({
                    code: 'custom',
                    path: ['estimated_end_date'],
                    message: 'Estimated end must be on or after estimated start.',
                });
            }

            if (!canEditCoreFields) {
                return;
            }

            const seenContractors = new Map<string, number>();
            values.contractors.forEach((contractor, index) => {
                const contractorId = contractor.contractor_id.trim();

                if (contractorId === '') {
                    return;
                }

                const firstIndex = seenContractors.get(contractorId);

                if (firstIndex !== undefined) {
                    context.addIssue({
                        code: 'custom',
                        path: ['contractors', index, 'contractor_id'],
                        message: 'This contractor is already added.',
                    });
                } else {
                    seenContractors.set(contractorId, index);
                }
            });

            const seenScopes = new Map<string, number>();
            values.scopes.forEach((scope, index) => {
                const type = scope.type.trim();

                if (type === '') {
                    return;
                }

                if (!scopeTypeSlugs.includes(type)) {
                    context.addIssue({
                        code: 'custom',
                        path: ['scopes', index, 'type'],
                        message: 'Select a valid scope of work.',
                    });
                }

                const firstIndex = seenScopes.get(type);

                if (firstIndex !== undefined) {
                    context.addIssue({
                        code: 'custom',
                        path: ['scopes', index, 'type'],
                        message: 'This scope of work is already added.',
                    });
                } else {
                    seenScopes.set(type, index);
                }
            });

            const seenRevisions = new Map<string, number>();
            values.revisions.forEach((revision, index) => {
                const number = revision.number.trim().toLowerCase();

                if (number === '') {
                    return;
                }

                const firstIndex = seenRevisions.get(number);

                if (firstIndex !== undefined) {
                    context.addIssue({
                        code: 'custom',
                        path: ['revisions', index, 'number'],
                        message: 'This revision is already added.',
                    });
                } else {
                    seenRevisions.set(number, index);
                }
            });
        });
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
    const { auth } = usePage<PageProps>().props;
    const currentUserId = auth.user?.id ? String(auth.user.id) : '';
    const [processing, setProcessing] = useState(false);
    const [checkingName, setCheckingName] = useState(false);
    const [nameTaken, setNameTaken] = useState(false);
    const nameCheckRequest = useRef(0);
    const canEditCoreFields =
        options.can.create || options.can.viewCustomerContactFields;
    const canViewSensitive = options.can.viewSensitiveFields;
    const scopeTypes = options.scopeTypes ?? [];
    const validationSchema = useMemo(
        () => projectSchema(options, canEditCoreFields),
        [canEditCoreFields, options],
    );
    const {
        control,
        handleSubmit,
        setError,
        clearErrors,
        setValue,
        watch,
        formState: { errors: validationErrors },
    } = useForm<ProjectFormData>({
        resolver: zodResolver(validationSchema),
        defaultValues: projectToFormData(project, options),
        mode: 'onChange',
    });
    const {
        fields: contractorFields,
        append: appendContractor,
        remove: removeContractor,
    } = useFieldArray({
        control,
        name: 'contractors',
    });
    const { fields: scopeFields, append: appendScope, remove: removeScope } =
        useFieldArray({
            control,
            name: 'scopes',
        });
    const {
        fields: revisionFields,
        append: appendRevision,
        remove: removeRevision,
    } = useFieldArray({
        control,
        name: 'revisions',
    });
    const data = watch();

    const checkProjectNameAvailability = async (name: string) => {
        const trimmedName = name.trim();
        const requestId = ++nameCheckRequest.current;

        if (trimmedName === '') {
            setNameTaken(false);
            setCheckingName(false);
            return true;
        }

        if (
            project?.name &&
            trimmedName.toLowerCase() === project.name.trim().toLowerCase()
        ) {
            setNameTaken(false);
            setCheckingName(false);
            return true;
        }

        setCheckingName(true);

        const params = new URLSearchParams({ name: trimmedName });

        if (project?.id) {
            params.set('project_id', String(project.id));
        }

        try {
            const response = await fetch(
                `${route('admin.projects.name-availability')}?${params.toString()}`,
                {
                    headers: {
                        Accept: 'application/json',
                    },
                },
            );

            if (requestId !== nameCheckRequest.current) {
                return true;
            }

            if (!response.ok) {
                return true;
            }

            const result = (await response.json()) as { available: boolean };

            if (!result.available) {
                setNameTaken(true);
                setError('name', {
                    type: 'server',
                    message: 'A project with this name already exists.',
                });
                return false;
            }

            setNameTaken(false);
            return true;
        } catch {
            if (requestId !== nameCheckRequest.current) {
                return true;
            }

            setNameTaken(false);
            return true;
        } finally {
            if (requestId === nameCheckRequest.current) {
                setCheckingName(false);
            }
        }
    };

    const submit = handleSubmit(
        async (values) => {
        const nameIsAvailable = await checkProjectNameAvailability(values.name);

        if (!nameIsAvailable) {
            toast.error('A project with this name already exists.');
            return;
        }

        const payload = {
            ...values,
            customer_id: values.customer_id.trim(),
            customer_company_name: values.customer_company_name.trim(),
            customer_email: values.customer_email.trim(),
            customer_phone_number: values.customer_phone_number.trim(),
            budget_amount: inputToDecimal(values.budget_amount) || null,
            contractors: (values.contractors ?? []).filter(
                (contractor) =>
                    contractor.contractor_id.trim() !== '' ||
                    contractor.company_name.trim() !== '',
            ),
            scopes: (values.scopes ?? [])
                .filter((scope) => scope.type.trim() !== '')
                .map((scope) => ({
                    type: scope.type,
                    notes: scope.notes,
                })),
            revisions: (values.revisions ?? [])
                .filter((revision) => revision.number.trim() !== '')
                .map((revision) => ({
                    id: revision.id.trim() || null,
                    number: revision.number,
                    revision_date: revision.revision_date,
                    notes: revision.notes,
                })),
        };
        const submitOptions = {
            onBefore: () => setProcessing(true),
            onError: (serverErrors: Record<string, string>) => {
                Object.entries(serverErrors).forEach(([field, message]) => {
                    setError(field as FieldPath<ProjectFormData>, {
                        type: 'server',
                        message: String(message),
                    });
                });
                toast.error(
                    Object.values(serverErrors)[0] ||
                        'The project could not be saved. Check the form and try again.',
                );
            },
            onFinish: () => setProcessing(false),
        };

        if (method === 'patch') {
            router.patch(action, payload, submitOptions);
            return;
        }

        router.post(action, payload, submitOptions);
        },
        () => {
            toast.error(
                'The project could not be saved. Check the highlighted fields and try again.',
            );
        },
    ) as FormEventHandler;

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
    const setContractorRow = (
        index: number,
        fields: Partial<ProjectFormData['contractors'][number]>,
    ) => {
        const contractors = [...data.contractors];
        contractors[index] = {
            ...contractors[index],
            ...fields,
        };
        setData('contractors', contractors);
    };
    const setScopeData = (
        index: number,
        field: keyof ProjectScopeFormData,
        value: string,
    ) => {
        setData(
            `scopes.${index}.${field}` as FieldPath<ProjectFormData>,
            value as PathValue<ProjectFormData, FieldPath<ProjectFormData>>,
        );
    };
    const setRevisionData = (
        index: number,
        field: keyof ProjectRevisionFormData,
        value: string,
    ) => {
        setData(
            `revisions.${index}.${field}` as FieldPath<ProjectFormData>,
            value as PathValue<ProjectFormData, FieldPath<ProjectFormData>>,
        );
    };

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="flex min-w-0 flex-col gap-6 pr-16 sm:pr-20">
                    <FormActionFab
                        cancelHref={route('admin.projects.index')}
                        saveLabel={submitLabel}
                        disabled={processing}
                    />
                    <section className="flex flex-col gap-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                        {canEditCoreFields && (
                            <div className="grid gap-5 md:grid-cols-2">
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
                                        onChange={(event) => {
                                            nameCheckRequest.current += 1;
                                            setCheckingName(false);
                                            setNameTaken(false);
                                            clearErrors('name');
                                            setData('name', event.target.value);
                                        }}
                                        onBlur={(event) => {
                                            void checkProjectNameAvailability(
                                                event.target.value,
                                            );
                                        }}
                                    />
                                    <InputError message={errors.name} />
                                    {checkingName && (
                                        <p className="text-sm text-muted-foreground">
                                            Checking project name...
                                        </p>
                                    )}
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
                                        disabled
                                        readOnly
                                        className={`${inputClassName} cursor-not-allowed bg-muted`}
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Assigned automatically as GDS, year, and
                                        sequence — for example GDS-2026-0001.
                                    </p>
                                    <InputError
                                        message={errors.project_number}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                            <CreatableSelect
                                id="project-status"
                                label="Status"
                                compact
                                value={data.status_id}
                                options={options.statuses}
                                createRoute={route(
                                    'admin.project-statuses.store',
                                )}
                                catalogKey="statuses"
                                entityLabel="status"
                                placeholder="Lead, Quoted, Approved..."
                                error={errors.status_id}
                                onChange={(statusId) =>
                                    setData('status_id', statusId)
                                }
                            />

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
                                        <option
                                            key={priority}
                                            value={priority}
                                        >
                                            {optionLabel(priority)}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.priority} />
                            </div>

                            {canEditCoreFields && (
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
                            )}

                            {canViewSensitive && (
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="budget-amount"
                                        value="Budget amount"
                                        className={labelClassName}
                                    />
                                    <MaskedDecimalInput
                                        id="budget-amount"
                                        prefix="$"
                                        value={data.budget_amount ?? ''}
                                        className={inputClassName}
                                        placeholder="0.00"
                                        onChange={(value) =>
                                            setData('budget_amount', value)
                                        }
                                    />
                                    <InputError
                                        message={errors.budget_amount}
                                    />
                                </div>
                            )}
                        </div>

                        {canEditCoreFields && (
                            <div className="grid gap-5 rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70 md:grid-cols-2">
                                <div className="flex flex-col gap-2 md:col-span-2">
                                    <h3 className="text-base font-semibold text-foreground">
                                        Address
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Site location where the project work
                                        will happen.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="site-address-line-1"
                                        value="Address line 1"
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
                                        value="Address line 2"
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
                                        value="City"
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
                            </div>
                        )}

                        {canEditCoreFields && (
                            <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">
                                            General contractors/Customer
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Add each general contractor with a
                                            company name, phone number, and
                                            email address.
                                        </p>
                                    </div>
                                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                        {Boolean(
                                            auth.can?.viewContractors ||
                                                auth.can?.createContractors,
                                        ) && (
                                            <Button
                                                asChild
                                                variant="outline"
                                                className="w-full sm:w-auto"
                                            >
                                                <Link
                                                    href={route(
                                                        'admin.contractors.index',
                                                    )}
                                                >
                                                    Manage contractors
                                                </Link>
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                appendContractor(
                                                    blankContractor(),
                                                )
                                            }
                                            className="w-full sm:w-auto"
                                        >
                                            <PlusIcon className="size-4" />
                                            Add contractor
                                        </Button>
                                    </div>
                                </div>

                                {contractorFields.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                                        No contractors added yet.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {contractorFields.map((field, index) => {
                                            const contractor =
                                                data.contractors[index];
                                            const selectedIds = data.contractors
                                                .map((item, itemIndex) =>
                                                    itemIndex === index
                                                        ? ''
                                                        : item.contractor_id,
                                                )
                                                .filter(Boolean);

                                            return (
                                                <div
                                                    key={field.id}
                                                    className="grid gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 shadow-sm dark:border-emerald-900/70 lg:grid-cols-[minmax(0,1fr)_auto]"
                                                >
                                                    <div className="flex flex-col gap-4">
                                                    <ContractorSelect
                                                        id={`project-contractor-${index}`}
                                                        value={
                                                            contractor?.contractor_id ??
                                                            ''
                                                        }
                                                        companyName={
                                                            contractor?.company_name ??
                                                            ''
                                                        }
                                                        contractors={
                                                            options.contractors ??
                                                            []
                                                        }
                                                        disabledIds={selectedIds}
                                                        error={errorMessage(
                                                            validationErrors,
                                                            `contractors.${index}.contractor_id`,
                                                        )}
                                                        contactEmail={
                                                            contractor?.email ??
                                                            ''
                                                        }
                                                        contactPhone={
                                                            contractor?.phone_number ??
                                                            ''
                                                        }
                                                        onChange={(
                                                            contractorId,
                                                            contractorName,
                                                            contact,
                                                        ) =>
                                                            setContractorRow(
                                                                index,
                                                                {
                                                                    contractor_id:
                                                                        contractorId,
                                                                    company_name:
                                                                        contractorName,
                                                                    ...(contact
                                                                        ? {
                                                                              contact_name:
                                                                                  contact.contact_name ??
                                                                                  '',
                                                                              email:
                                                                                  contact.email ??
                                                                                  '',
                                                                              phone_number:
                                                                                  contact.phone_number ??
                                                                                  '',
                                                                          }
                                                                        : contractorId ===
                                                                                '' &&
                                                                            contractorName ===
                                                                                ''
                                                                          ? {
                                                                                contact_name:
                                                                                    '',
                                                                                email: '',
                                                                                phone_number:
                                                                                    '',
                                                                            }
                                                                          : {}),
                                                                },
                                                            )
                                                        }
                                                    />
                                                    <div className="grid gap-4 md:grid-cols-3">
                                                        <div className="flex flex-col gap-2">
                                                            <InputLabel
                                                                htmlFor={`project-contractor-contact-${index}`}
                                                                value="Contact name"
                                                                className={
                                                                    labelClassName
                                                                }
                                                            />
                                                            <TextInput
                                                                id={`project-contractor-contact-${index}`}
                                                                value={
                                                                    contractor?.contact_name ??
                                                                    ''
                                                                }
                                                                className={
                                                                    inputClassName
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setContractorRow(
                                                                        index,
                                                                        {
                                                                            contact_name:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <InputError
                                                                message={errorMessage(
                                                                    validationErrors,
                                                                    `contractors.${index}.contact_name`,
                                                                )}
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <InputLabel
                                                                htmlFor={`project-contractor-phone-${index}`}
                                                                value="Phone number"
                                                                className={
                                                                    labelClassName
                                                                }
                                                            />
                                                            <PhoneInput
                                                                id={`project-contractor-phone-${index}`}
                                                                value={
                                                                    contractor?.phone_number ??
                                                                    ''
                                                                }
                                                                className={
                                                                    inputClassName
                                                                }
                                                                onValueChange={(
                                                                    phoneNumber,
                                                                ) =>
                                                                    setContractorRow(
                                                                        index,
                                                                        {
                                                                            phone_number:
                                                                                phoneNumber,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <InputError
                                                                message={errorMessage(
                                                                    validationErrors,
                                                                    `contractors.${index}.phone_number`,
                                                                )}
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <InputLabel
                                                                htmlFor={`project-contractor-email-${index}`}
                                                                value="Email address"
                                                                className={
                                                                    labelClassName
                                                                }
                                                            />
                                                            <TextInput
                                                                id={`project-contractor-email-${index}`}
                                                                type="email"
                                                                value={
                                                                    contractor?.email ??
                                                                    ''
                                                                }
                                                                className={
                                                                    inputClassName
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setContractorRow(
                                                                        index,
                                                                        {
                                                                            email: event
                                                                                .target
                                                                                .value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <InputError
                                                                message={errorMessage(
                                                                    validationErrors,
                                                                    `contractors.${index}.email`,
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                    </div>
                                                    <div className="flex items-start lg:pt-7">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() =>
                                                                removeContractor(
                                                                    index,
                                                                )
                                                            }
                                                            aria-label={`Remove contractor ${index + 1}`}
                                                        >
                                                            <Trash2Icon className="size-4" />
                                                            Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {canEditCoreFields && (
                            <div className="flex flex-col gap-4 rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">
                                            Scope of work
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Add a scope type and any necessary
                                            text.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => appendScope(blankScope())}
                                        className="w-full sm:w-auto"
                                    >
                                        <PlusIcon className="size-4" />
                                        Add scope
                                    </Button>
                                </div>

                                {scopeFields.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                                        No scopes added yet.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {scopeFields.map((field, index) => {
                                            const scope = data.scopes[index];
                                            const selectedScopeType =
                                                scopeTypes.find(
                                                    (type) =>
                                                        type.slug ===
                                                        scope?.type,
                                                );
                                            const selectedTypes = data.scopes
                                                .map((item, itemIndex) =>
                                                    itemIndex === index
                                                        ? ''
                                                        : item.type,
                                                )
                                                .filter(Boolean);

                                            return (
                                                <div
                                                    key={field.id}
                                                    className="grid gap-4 overflow-visible rounded-lg border border-border bg-muted/10 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                                                >
                                                    <div className="flex min-w-0 flex-col gap-4">
                                                        <CreatableSelect
                                                            id={`project-scope-type-${index}`}
                                                            label="Scope type"
                                                            compact
                                                            value={
                                                                selectedScopeType
                                                                    ? String(
                                                                          selectedScopeType.id,
                                                                      )
                                                                    : ''
                                                            }
                                                            options={scopeTypes}
                                                            disabledIds={scopeTypes
                                                                .filter((type) =>
                                                                    selectedTypes.includes(
                                                                        type.slug,
                                                                    ),
                                                                )
                                                                .map((type) =>
                                                                    String(
                                                                        type.id,
                                                                    ),
                                                                )}
                                                            createRoute={route(
                                                                'admin.project-scope-types.store',
                                                            )}
                                                            catalogKey="scopeTypes"
                                                            entityLabel="scope type"
                                                            placeholder="Select a scope"
                                                            error={errorMessage(
                                                                validationErrors,
                                                                `scopes.${index}.type`,
                                                            )}
                                                            onChange={(
                                                                _id,
                                                                option,
                                                            ) =>
                                                                setScopeData(
                                                                    index,
                                                                    'type',
                                                                    option?.slug ??
                                                                        '',
                                                                )
                                                            }
                                                        />
                                                        <div className="flex flex-col gap-2">
                                                            <InputLabel
                                                                htmlFor={`project-scope-notes-${index}`}
                                                                value="Text"
                                                                className={
                                                                    labelClassName
                                                                }
                                                            />
                                                            <RichTextEditor
                                                                id={`project-scope-notes-${index}`}
                                                                compact
                                                                showPlaceholders={
                                                                    false
                                                                }
                                                                value={
                                                                    scope?.notes ??
                                                                    ''
                                                                }
                                                                placeholder="Add any necessary details for this scope."
                                                                error={errorMessage(
                                                                    validationErrors,
                                                                    `scopes.${index}.notes`,
                                                                )}
                                                                onChange={(html) =>
                                                                    setScopeData(
                                                                        index,
                                                                        'notes',
                                                                        html,
                                                                    )
                                                                }
                                                            />
                                                            <InputError
                                                                message={errorMessage(
                                                                    validationErrors,
                                                                    `scopes.${index}.notes`,
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start lg:pt-7">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() =>
                                                                removeScope(
                                                                    index,
                                                                )
                                                            }
                                                            aria-label={`Remove scope ${index + 1}`}
                                                        >
                                                            <Trash2Icon className="size-4" />
                                                            Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid gap-5 md:grid-cols-3">
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
                        </div>

                        {canEditCoreFields && (
                            <div className="flex flex-col gap-4 rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">
                                            Revisions
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Track drawing or document revisions
                                            for this project.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            appendRevision(
                                                blankRevision(
                                                    currentUserId,
                                                    auth.user?.name ?? '',
                                                ),
                                            )
                                        }
                                        className="w-full sm:w-auto"
                                    >
                                        <PlusIcon className="size-4" />
                                        Add revision
                                    </Button>
                                </div>

                                {revisionFields.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                                        No revisions added yet.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {revisionFields.map((field, index) => {
                                            const revision =
                                                data.revisions[index];

                                            return (
                                                <div
                                                    key={field.id}
                                                    className="grid gap-4 rounded-lg border border-border bg-muted/10 p-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_auto]"
                                                >
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-revision-number-${index}`}
                                                            value="Revision"
                                                            className={
                                                                labelClassName
                                                            }
                                                        />
                                                        <TextInput
                                                            id={`project-revision-number-${index}`}
                                                            value={
                                                                revision?.number ??
                                                                ''
                                                            }
                                                            className={
                                                                inputClassName
                                                            }
                                                            placeholder="A, B, 1"
                                                            onChange={(
                                                                event,
                                                            ) =>
                                                                setRevisionData(
                                                                    index,
                                                                    'number',
                                                                    event
                                                                        .target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                        <InputError
                                                            message={errorMessage(
                                                                validationErrors,
                                                                `revisions.${index}.number`,
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-revision-date-${index}`}
                                                            value="Date"
                                                            className={
                                                                labelClassName
                                                            }
                                                        />
                                                        <TextInput
                                                            id={`project-revision-date-${index}`}
                                                            type="date"
                                                            value={
                                                                revision?.revision_date ??
                                                                ''
                                                            }
                                                            className={
                                                                inputClassName
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) =>
                                                                setRevisionData(
                                                                    index,
                                                                    'revision_date',
                                                                    event
                                                                        .target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-revision-user-${index}`}
                                                            value="Updated by"
                                                            className={
                                                                labelClassName
                                                            }
                                                        />
                                                        <TextInput
                                                            id={`project-revision-user-${index}`}
                                                            value={
                                                                revision?.user_name ??
                                                                ''
                                                            }
                                                            disabled
                                                            readOnly
                                                            className={`${inputClassName} cursor-not-allowed bg-muted`}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-revision-notes-${index}`}
                                                            value="Notes"
                                                            className={
                                                                labelClassName
                                                            }
                                                        />
                                                        <TextInput
                                                            id={`project-revision-notes-${index}`}
                                                            value={
                                                                revision?.notes ??
                                                                ''
                                                            }
                                                            className={
                                                                inputClassName
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) =>
                                                                setRevisionData(
                                                                    index,
                                                                    'notes',
                                                                    event
                                                                        .target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <div className="flex items-start lg:pt-7">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() =>
                                                                removeRevision(
                                                                    index,
                                                                )
                                                            }
                                                            aria-label={`Remove revision ${index + 1}`}
                                                        >
                                                            <Trash2Icon className="size-4" />
                                                            Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
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
