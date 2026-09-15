import FormActionFab from '@/Components/FormActionFab';
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
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from '@inertiajs/react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { FormEventHandler, useMemo } from 'react';
import {
    FieldErrors,
    useFieldArray,
    useForm,
    useWatch,
} from 'react-hook-form';
import { z } from 'zod';
import {
    emptyLineItem,
    formatMoney,
    quotationToFormData,
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

const schema = z.object({
    customer_id: z.string().trim().min(1, 'Select a customer.'),
    project_id: z.string(),
    title: z.string().trim().min(1, 'Enter a quotation title.').max(255),
    status: z.string().trim().min(1, 'Select a status.'),
    quoted_at: z.string(),
    valid_until: z.string(),
    notes: z.string().max(10000),
    line_items: z
        .array(
            z.object({
                description: z
                    .string()
                    .trim()
                    .min(1, 'Enter a description.')
                    .max(255),
                quantity: z.string(),
                unit_price: z.string(),
            }),
        )
        .min(1, 'Add at least one quoted item.'),
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
    const defaultValues = useMemo(
        () => quotationToFormData(quotation),
        [quotation],
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
    const data = useWatch({
        control,
        defaultValue: defaultValues,
    }) as QuotationFormData;

    const projectsForCustomer = options.projects.filter(
        (project) =>
            !data.customer_id ||
            String(project.customer_id ?? '') === data.customer_id,
    );

    const lineTotal = (data.line_items ?? []).reduce((sum, item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);

        if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
            return sum;
        }

        return sum + quantity * unitPrice;
    }, 0);

    const submit: FormEventHandler = handleSubmit((values) => {
        router[method](action, values, {
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
        <form onSubmit={submit} className="flex flex-col gap-6 pr-14 sm:pr-16">
            <FormActionFab
                cancelHref={route('admin.quotations.index')}
                saveLabel={quotation ? 'Save quotation' : 'Add quotation'}
                disabled={isSubmitting}
            />

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="customer_id"
                            value="Customer / owner"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <select
                            id="customer_id"
                            value={data.customer_id}
                            onChange={(event) => {
                                const customerId = event.target.value;
                                setValue('customer_id', customerId, {
                                    shouldValidate: true,
                                });
                                const selectedProject = options.projects.find(
                                    (project) =>
                                        String(project.id) === data.project_id,
                                );
                                if (
                                    selectedProject &&
                                    String(selectedProject.customer_id ?? '') !==
                                        customerId
                                ) {
                                    setValue('project_id', '');
                                }
                            }}
                            className={inputClassName}
                        >
                            <option value="">Select a customer / owner</option>
                            {options.customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.name}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={errorMessage(validationErrors, 'customer_id')}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="project_id"
                            value="Project"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <select
                            id="project_id"
                            value={data.project_id}
                            onChange={(event) => {
                                const projectId = event.target.value;
                                setValue('project_id', projectId);
                                const project = options.projects.find(
                                    (item) => String(item.id) === projectId,
                                );
                                if (project?.customer_id) {
                                    setValue(
                                        'customer_id',
                                        String(project.customer_id),
                                        { shouldValidate: true },
                                    );
                                }
                            }}
                            className={inputClassName}
                        >
                            <option value="">No project</option>
                            {projectsForCustomer.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.label}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={errorMessage(validationErrors, 'project_id')}
                        />
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                        <InputLabel
                            htmlFor="title"
                            value="Quotation title"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <TextInput
                            id="title"
                            value={data.title}
                            className={inputClassName}
                            onChange={(event) =>
                                setValue('title', event.target.value, {
                                    shouldValidate: true,
                                })
                            }
                        />
                        <InputError
                            message={errorMessage(validationErrors, 'title')}
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
                            className={inputClassName}
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

                    <div className="flex flex-col gap-2">
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
                            message={errorMessage(validationErrors, 'quoted_at')}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
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

                    <div className="flex flex-col gap-2 md:col-span-2">
                        <InputLabel
                            htmlFor="notes"
                            value="Notes"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <textarea
                            id="notes"
                            value={data.notes}
                            className="min-h-28 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                            onChange={(event) =>
                                setValue('notes', event.target.value)
                            }
                        />
                        <InputError
                            message={errorMessage(validationErrors, 'notes')}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                        <CardTitle>Quoted items</CardTitle>
                        <CardDescription>
                            Add each line the customer is being quoted.
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => append(emptyLineItem())}
                    >
                        <PlusIcon className="size-4" />
                        Add item
                    </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {fields.map((field, index) => {
                        const quantity = Number(data.line_items?.[index]?.quantity);
                        const unitPrice = Number(
                            data.line_items?.[index]?.unit_price,
                        );
                        const extended =
                            Number.isFinite(quantity) && Number.isFinite(unitPrice)
                                ? quantity * unitPrice
                                : 0;

                        return (
                            <div
                                key={field.id}
                                className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[minmax(0,2fr)_7rem_8rem_7rem_auto] md:items-end"
                            >
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`line-description-${index}`}
                                        value="Description"
                                    />
                                    <TextInput
                                        id={`line-description-${index}`}
                                        value={
                                            data.line_items?.[index]
                                                ?.description ?? ''
                                        }
                                        className={inputClassName}
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
                                            data.line_items?.[index]?.quantity ??
                                            ''
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
                                        htmlFor={`line-price-${index}`}
                                        value="Unit price"
                                    />
                                    <TextInput
                                        id={`line-price-${index}`}
                                        type="number"
                                        step="0.01"
                                        value={
                                            data.line_items?.[index]
                                                ?.unit_price ?? ''
                                        }
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setValue(
                                                `line_items.${index}.unit_price`,
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel value="Extended" />
                                    <p className="flex h-11 items-center text-sm font-medium text-foreground">
                                        {formatMoney(extended)}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                    disabled={fields.length === 1}
                                    onClick={() => remove(index)}
                                    aria-label="Remove item"
                                >
                                    <Trash2Icon className="size-4" />
                                </Button>
                            </div>
                        );
                    })}
                    <p className="text-right text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        Total {formatMoney(lineTotal)}
                    </p>
                    <InputError
                        message={errorMessage(validationErrors, 'line_items')}
                    />
                </CardContent>
            </Card>
        </form>
    );
}
