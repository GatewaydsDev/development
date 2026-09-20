import CreatableSelect from '@/Components/CreatableSelect';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import TextInput from '@/Components/TextInput';
import QuotationProductFieldsSection, {
    fieldTablesForSubmit,
} from './QuotationProductFieldsSection';
import QuotationReusableTextSection from './QuotationReusableTextSection';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, usePage } from '@inertiajs/react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { FormEventHandler, useMemo } from 'react';
import {
    FieldErrors,
    useFieldArray,
    useForm,
    useWatch,
} from 'react-hook-form';
import { z } from 'zod';
import { type PageProps } from '@/types';
import {
    blankRevision,
    emptyLineItem,
    formatMoney,
    quotationInsertValues,
    quotationToFormData,
    QUOTATION_INSERT_FIELDS,
    type QuotationFormData,
    type QuotationOptions,
    type QuotationPayload,
} from '../types';

type QuotationFormProps = {
    action: string;
    method?: 'post' | 'patch';
    title: string;
    description: string;
    options: QuotationOptions;
    quotation?: QuotationPayload;
};

const optionalDateSchema = z
    .string()
    .refine(
        (value) => value === '' || !Number.isNaN(Date.parse(value)),
        'Enter a valid date.',
    );

const schema = z.object({
    quotation_number: z.string(),
    project_id: z.string(),
    contractor_id: z.string().trim().min(1, 'Select a contractor.'),
    contact_ids: z.array(z.string()),
    title_id: z.string(),
    title: z.string().trim().min(1, 'Select or add a quotation title.').max(255),
    status: z.string().trim().min(1, 'Select a status.'),
    quoted_at: z.string(),
    valid_until: z.string(),
    notes: z.string().max(250000),
    pricing_conditions: z.string().max(250000),
    pricing_basis: z.string().max(250000),
    line_items: z
        .array(
            z.object({
                description: z
                    .string()
                    .trim()
                    .min(1, 'Enter a description.')
                    .max(255),
                quantity: z.string(),
                size: z.string().max(255),
                unit_price: z.string(),
            }),
        )
        .min(1, 'Add at least one quoted item.'),
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
    field_tables: z.array(
        z.object({
            title: z.string().max(255),
            fields: z.array(
                z.object({
                    product_id: z.string(),
                    field_id: z.string(),
                    field: z.string().max(255),
                    value: z.string().max(2000),
                }),
            ),
        }),
    ),
}).superRefine((values, context) => {
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

function errorMessage(
    errors: FieldErrors<QuotationFormData>,
    path: string,
): string | undefined {
    const parts = path.split('.');
    let current: unknown = errors;

    for (const part of parts) {
        if (!current || typeof current !== 'object') {
            return undefined;
        }

        current = (current as Record<string, unknown>)[part];
    }

    return (current as { message?: string } | undefined)?.message;
}

const inputClassName =
    'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';

export default function QuotationForm({
    action,
    method = 'post',
    title,
    description,
    options,
    quotation,
}: QuotationFormProps) {
    const { auth } = usePage<PageProps>().props;
    const currentUserId = auth.user?.id ? String(auth.user.id) : '';
    const defaultValues = useMemo(
        () => quotationToFormData(quotation, options),
        [quotation, options],
    );
    const {
        handleSubmit,
        setValue,
        setError,
        control,
        formState: { errors: validationErrors, isSubmitting },
    } = useForm<QuotationFormData>({
        resolver: zodResolver(schema),
        defaultValues,
    });
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'line_items',
    });
    const {
        fields: revisionFields,
        append: appendRevision,
        remove: removeRevision,
    } = useFieldArray({
        control,
        name: 'revisions',
    });
    const data = useWatch({
        control,
        defaultValue: defaultValues,
    }) as QuotationFormData;

    const contractorOptions = options.contractors ?? [];
    const selectedContractor = contractorOptions.find(
        (contractor) => String(contractor.id) === data.contractor_id,
    );
    const contractorContacts = selectedContractor?.contacts ?? [];

    const defaultContactIds = (contractor: (typeof contractorOptions)[number] | undefined) => {
        const primary = contractor?.contacts?.find((contact) => contact.is_primary);

        return primary
            ? [String(primary.id)]
            : contractor?.contacts?.[0]
              ? [String(contractor.contacts[0].id)]
              : [];
    };

    const insertValues = quotationInsertValues(data, options, quotation);
    const lineTotal = (data.line_items ?? []).reduce((sum, item) => {
        const unitPrice = Number(item.unit_price);

        return sum + (Number.isFinite(unitPrice) ? unitPrice : 0);
    }, 0);

    const submit: FormEventHandler = handleSubmit((values) => {
        router[method](action, {
            ...values,
            revisions: values.revisions.filter(
                (revision) => revision.number.trim() !== '',
            ),
            field_tables: fieldTablesForSubmit(values.field_tables),
        }, {
            onError: (serverErrors: Record<string, string>) => {
                Object.entries(serverErrors).forEach(([field, message]) => {
                    setError(field as keyof QuotationFormData, {
                        type: 'server',
                        message: String(message),
                    });
                });
            },
        });
    });

    return (
        <form onSubmit={submit} className="flex w-full min-w-0 max-w-full flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6">
            <FormActionFab
                cancelHref={route('admin.quotations.index')}
                saveLabel={quotation ? 'Save quotation' : 'Add quotation'}
                disabled={isSubmitting}
            />

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base font-semibold text-foreground">
                        {title}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                    <CardAction className="w-full sm:max-w-72">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="quotation_number"
                                value="Quotation number"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <TextInput
                                id="quotation_number"
                                value={data.quotation_number}
                                disabled
                                readOnly
                                className={`${inputClassName} cursor-not-allowed bg-muted`}
                            />
                        </div>
                    </CardAction>
                </CardHeader>
                <CardContent className="grid min-w-0 gap-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="project_id"
                            value="Project"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <select
                            id="project_id"
                            value={data.project_id}
                            onChange={(event) =>
                                setValue('project_id', event.target.value)
                            }
                            className={`${inputClassName} min-w-0 max-w-full`}
                        >
                            <option value="">No project</option>
                            {options.projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.label}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={errorMessage(validationErrors, 'project_id')}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="contractor_id"
                            value="Contractor"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <select
                            id="contractor_id"
                            value={data.contractor_id}
                            onChange={(event) => {
                                const contractorId = event.target.value;
                                const contractor = (
                                    options.contractors ?? []
                                ).find(
                                    (item) => String(item.id) === contractorId,
                                );
                                setValue('contractor_id', contractorId, {
                                    shouldValidate: true,
                                });
                                setValue(
                                    'contact_ids',
                                    defaultContactIds(contractor),
                                );
                            }}
                            className={`${inputClassName} min-w-0 max-w-full`}
                        >
                            <option value="">Select a contractor</option>
                            {contractorOptions.map((contractor) => (
                                <option
                                    key={contractor.id}
                                    value={contractor.id}
                                >
                                    {contractor.name}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={errorMessage(
                                validationErrors,
                                'contractor_id',
                            )}
                        />
                    </div>

                    <div className="flex flex-col gap-2 min-w-0 sm:col-span-2">
                        <InputLabel
                            value="Contacts on this quotation"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <p className="text-sm text-muted-foreground">
                            Every contact for this contractor is listed. Check
                            the ones that should appear on the quotation.
                        </p>
                        {!data.contractor_id ? (
                            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                                Select a contractor to see their contacts.
                            </p>
                        ) : contractorContacts.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                                This contractor has no contacts yet.
                            </p>
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {contractorContacts.map((contact) => {
                                    const checked = (
                                        data.contact_ids ?? []
                                    ).includes(String(contact.id));

                                    return (
                                        <label
                                            key={contact.id}
                                            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50/70 dark:has-[:checked]:border-emerald-900 dark:has-[:checked]:bg-emerald-950/30"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    const current =
                                                        data.contact_ids ?? [];
                                                    const id = String(
                                                        contact.id,
                                                    );
                                                    setValue(
                                                        'contact_ids',
                                                        checked
                                                            ? current.filter(
                                                                  (value) =>
                                                                      value !==
                                                                      id,
                                                              )
                                                            : [...current, id],
                                                    );
                                                }}
                                                className="mt-1 size-4 rounded border-border text-emerald-600 focus:ring-emerald-600"
                                            />
                                            <span className="min-w-0">
                                                <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                                                    {contact.name ||
                                                        'Unnamed contact'}
                                                    {contact.is_primary ? (
                                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                                                            Primary
                                                        </span>
                                                    ) : null}
                                                </span>
                                                {contact.title ? (
                                                    <span className="block text-sm text-muted-foreground">
                                                        {contact.title}
                                                    </span>
                                                ) : null}
                                                <span className="block text-sm text-muted-foreground">
                                                    {[
                                                        contact.email,
                                                        contact.phone_number,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ') ||
                                                        'No email or phone'}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        <InputError
                            message={errorMessage(
                                validationErrors,
                                'contact_ids',
                            )}
                        />
                    </div>

                    <div className="min-w-0 sm:col-span-2">
                        <CreatableSelect
                            id="title"
                            label="Quotation title"
                            value={data.title_id}
                            options={options.titles ?? []}
                            createRoute={route('admin.quotation-titles.store')}
                            catalogKey="titles"
                            entityLabel="quotation title"
                            placeholder="Select or add a title"
                            error={errorMessage(validationErrors, 'title')}
                            onChange={(titleId, option) => {
                                setValue('title_id', titleId, {
                                    shouldValidate: true,
                                });
                                setValue('title', option?.name ?? '', {
                                    shouldValidate: true,
                                });
                            }}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="status"
                            value="Status"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <select
                            id="status"
                            value={data.status}
                            onChange={(event) =>
                                setValue('status', event.target.value, {
                                    shouldValidate: true,
                                })
                            }
                            className={`${inputClassName} min-w-0 max-w-full`}
                        >
                            {options.statuses.map((status) => (
                                <option key={status.id} value={status.id}>
                                    {status.name}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={errorMessage(validationErrors, 'status')}
                        />
                    </div>

                    <div className="flex min-w-0 flex-wrap gap-4 sm:col-span-2">
                        <div className="flex min-w-0 w-[calc(50%-0.5rem)] max-w-[11.5rem] flex-col gap-2">
                            <InputLabel
                                htmlFor="quoted_at"
                                value="Quoted on"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <TextInput
                                id="quoted_at"
                                type="date"
                                value={data.quoted_at}
                                className={inputClassName}
                                onChange={(event) =>
                                    setValue('quoted_at', event.target.value)
                                }
                            />
                            <InputError
                                message={errorMessage(
                                    validationErrors,
                                    'quoted_at',
                                )}
                            />
                        </div>
                        <div className="flex min-w-0 w-[calc(50%-0.5rem)] max-w-[11.5rem] flex-col gap-2">
                            <InputLabel
                                htmlFor="valid_until"
                                value="Valid until"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <TextInput
                                id="valid_until"
                                type="date"
                                value={data.valid_until}
                                className={inputClassName}
                                onChange={(event) =>
                                    setValue('valid_until', event.target.value)
                                }
                            />
                            <InputError
                                message={errorMessage(
                                    validationErrors,
                                    'valid_until',
                                )}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Quotation revisions
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Track drawing or document revisions for this
                            quotation.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full shrink-0 sm:w-auto"
                        onClick={() =>
                            appendRevision(
                                blankRevision(
                                    currentUserId,
                                    auth.user?.name ?? '',
                                ),
                            )
                        }
                    >
                        <PlusIcon className="size-4" />
                        Add revision
                    </Button>
                </div>

                {revisionFields.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
                        No revisions added yet.
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {revisionFields.map((field, index) => {
                            const revision = data.revisions?.[index];

                            return (
                                <div
                                    key={field.id}
                                    className="grid min-w-0 gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_auto]"
                                >
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`quotation-revision-number-${index}`}
                                            value="Revision"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id={`quotation-revision-number-${index}`}
                                            value={revision?.number ?? ''}
                                            className={inputClassName}
                                            placeholder="A, B, 1"
                                            onChange={(event) =>
                                                setValue(
                                                    `revisions.${index}.number`,
                                                    event.target.value,
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
                                            htmlFor={`quotation-revision-date-${index}`}
                                            value="Date"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id={`quotation-revision-date-${index}`}
                                            type="date"
                                            value={
                                                revision?.revision_date ?? ''
                                            }
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setValue(
                                                    `revisions.${index}.revision_date`,
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`quotation-revision-user-${index}`}
                                            value="Updated by"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id={`quotation-revision-user-${index}`}
                                            value={revision?.user_name ?? ''}
                                            disabled
                                            readOnly
                                            className={`${inputClassName} cursor-not-allowed bg-muted`}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`quotation-revision-notes-${index}`}
                                            value="Notes"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id={`quotation-revision-notes-${index}`}
                                            value={revision?.notes ?? ''}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setValue(
                                                    `revisions.${index}.notes`,
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={errorMessage(
                                                validationErrors,
                                                `revisions.${index}.notes`,
                                            )}
                                        />
                                    </div>
                                    <div className="flex items-start xl:pt-7">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            aria-label={`Remove revision ${index + 1}`}
                                            onClick={() =>
                                                removeRevision(index)
                                            }
                                        >
                                            <Trash2Icon className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <QuotationReusableTextSection
                    purpose="proposal"
                    options={options}
                    value={data.notes}
                    error={errorMessage(validationErrors, 'notes')}
                    onChange={(html) => setValue('notes', html)}
                />
            </section>

            <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Base Bid
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Add each line the contractor is being quoted.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full shrink-0 sm:w-auto"
                        onClick={() => append(emptyLineItem())}
                    >
                        <PlusIcon className="size-4" />
                        Add item
                    </Button>
                </div>
                {fields.map((field, index) => {
                    return (
                            <div
                                key={field.id}
                                className="flex min-w-0 flex-col gap-3 rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70"
                            >
                                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[7rem_minmax(12rem,16rem)_minmax(13rem,18rem)_auto] xl:items-end">
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`line-quantity-${index}`}
                                            value="Qty"
                                        />
                                        <TextInput
                                            id={`line-quantity-${index}`}
                                            type="number"
                                            step="0.01"
                                            value={
                                                data.line_items?.[index]
                                                    ?.quantity ?? ''
                                            }
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setValue(
                                                    `line_items.${index}.quantity`,
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`line-size-${index}`}
                                            value="Size"
                                        />
                                        <TextInput
                                            id={`line-size-${index}`}
                                            type="text"
                                            value={
                                                data.line_items?.[index]
                                                    ?.size ?? ''
                                            }
                                            className={`${inputClassName} h-12 text-base`}
                                            onChange={(event) =>
                                                setValue(
                                                    `line_items.${index}.size`,
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`line-price-${index}`}
                                            value="Price"
                                        />
                                        <MaskedDecimalInput
                                            id={`line-price-${index}`}
                                            prefix="$"
                                            value={
                                                data.line_items?.[index]
                                                    ?.unit_price ?? ''
                                            }
                                            className={`${inputClassName} h-12 text-base`}
                                            placeholder="0.00"
                                            onChange={(value) =>
                                                setValue(
                                                    `line_items.${index}.unit_price`,
                                                    value,
                                                )
                                            }
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-12 w-12 border-destructive/30 text-destructive hover:bg-destructive/10"
                                        disabled={fields.length === 1}
                                        onClick={() => remove(index)}
                                        aria-label="Remove item"
                                    >
                                        <Trash2Icon className="size-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`line-description-${index}`}
                                        value="Description"
                                    />
                                    <TextInput
                                        id={`line-description-${index}`}
                                        type="text"
                                        value={
                                            data.line_items?.[index]
                                                ?.description ?? ''
                                        }
                                        className={`${inputClassName} h-12 text-base`}
                                        placeholder="Door, handing, finish, and other quoted details"
                                        onChange={(event) =>
                                            setValue(
                                                `line_items.${index}.description`,
                                                event.target.value,
                                                { shouldValidate: true },
                                            )
                                        }
                                    />
                                    <InputError
                                        message={errorMessage(
                                            validationErrors,
                                            `line_items.${index}.description`,
                                        )}
                                    />
                                </div>
                            </div>
                    );
                })}
                <p className="text-right text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Total {formatMoney(lineTotal)}
                </p>
                <InputError
                    message={errorMessage(validationErrors, 'line_items')}
                />
            </section>

            <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <QuotationReusableTextSection
                    purpose="pricing_basis"
                    options={options}
                    value={data.pricing_basis}
                    error={errorMessage(validationErrors, 'pricing_basis')}
                    showPlaceholders
                    placeholderFields={[...QUOTATION_INSERT_FIELDS]}
                    placeholderValues={insertValues}
                    onChange={(html) => setValue('pricing_basis', html)}
                />
            </section>

            <QuotationProductFieldsSection
                options={options}
                tables={data.field_tables ?? []}
                inputClassName={inputClassName}
                onChange={(tables) => setValue('field_tables', tables)}
            />

            <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <QuotationReusableTextSection
                    purpose="pricing"
                    options={options}
                    value={data.pricing_conditions}
                    error={errorMessage(
                        validationErrors,
                        'pricing_conditions',
                    )}
                    onChange={(html) =>
                        setValue('pricing_conditions', html)
                    }
                />
            </section>
        </form>
    );
}
