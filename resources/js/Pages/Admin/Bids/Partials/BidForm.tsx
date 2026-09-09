import CreatableSelect from '@/Components/CreatableSelect';
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
import { CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { FormEventHandler, useMemo } from 'react';
import {
    FieldErrors,
    FieldPath,
    PathValue,
    useFieldArray,
    useForm,
    useWatch,
} from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
    bidToFormData,
    blankPricing,
    blankPricingItem,
    blankScope,
    blankScopeProduct,
    blankStage,
    formatMoney,
    type BidFormData,
    type BidOptions,
    type BidPayload,
} from '../types';

type BidFormProps = {
    action: string;
    method?: 'post' | 'patch';
    title: string;
    description: string;
    options: BidOptions;
    bid?: BidPayload;
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
        'Amount must be zero or greater.',
    );

const schema = z.object({
    project_id: z.string().trim().min(1, 'Select a project.'),
    notes: z.string().trim().max(5000, 'Notes must be 5,000 characters or less.'),
    stages: z.array(
        z.object({
            stage_type_id: z.string(),
            stage_date: optionalDateSchema,
            notes: z.string().trim().max(2000),
        }),
    ),
    scopes: z.array(
        z.object({
            title_id: z.string(),
            notations: z.string().trim().max(5000),
            products: z.array(
                z.object({
                    product_id: z.string(),
                }),
            ),
        }),
    ),
    pricings: z.array(
        z.object({
            name: z.string().trim().min(1, 'Enter the pricing revision name.'),
            revision_date: optionalDateSchema,
            notes: z.string().trim().max(2000),
            items: z.array(
                z.object({
                    description: z.string(),
                    pricing_basis: z.string(),
                    status_id: z.string(),
                    amount: optionalMoneySchema,
                }),
            ),
        }),
    ),
});

function errorMessage(
    errors: FieldErrors<BidFormData>,
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

    return typeof current === 'object' && current && 'message' in current
        ? String((current as { message?: string }).message)
        : undefined;
}

function PricingTotal({
    control,
    index,
}: {
    control: ReturnType<typeof useForm<BidFormData>>['control'];
    index: number;
}) {
    const items = useWatch({
        control,
        name: `pricings.${index}.items`,
    });
    const total = (items ?? []).reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0,
    );

    return (
        <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
            {formatMoney(total)}
        </p>
    );
}

export default function BidForm({
    action,
    method = 'post',
    title,
    description,
    options,
    bid,
}: BidFormProps) {
    const defaultValues = useMemo(() => {
        const values = bidToFormData(bid);

        if (!bid && options.stageTypes.length > 0) {
            const preliminary =
                options.stageTypes.find((type) =>
                    type.name.toLowerCase().includes('preliminary'),
                ) ?? options.stageTypes[0];

            values.stages[0].stage_type_id = String(preliminary.id);
        }

        return values;
    }, [bid, options.stageTypes]);

    const {
        control,
        handleSubmit,
        setValue,
        setError,
        formState: { errors: validationErrors, isSubmitting },
    } = useForm<BidFormData>({
        resolver: zodResolver(schema),
        defaultValues,
    });

    const {
        fields: stageFields,
        append: appendStage,
        remove: removeStage,
    } = useFieldArray({ control, name: 'stages' });
    const {
        fields: scopeFields,
        append: appendScope,
        remove: removeScope,
    } = useFieldArray({ control, name: 'scopes' });
    const {
        fields: pricingFields,
        append: appendPricing,
        remove: removePricing,
    } = useFieldArray({ control, name: 'pricings' });

    const data = useWatch({
        control,
        defaultValue: defaultValues,
    }) as BidFormData;

    const setData = <Field extends FieldPath<BidFormData>>(
        field: Field,
        value: PathValue<BidFormData, Field>,
    ) => {
        setValue(field, value, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const submit = handleSubmit(
        (values) => {
            const payload = {
                ...values,
                stages: values.stages.filter(
                    (stage) => stage.stage_type_id.trim() !== '',
                ),
                scopes: values.scopes
                    .filter((scope) => scope.title_id.trim() !== '')
                    .map((scope) => ({
                        ...scope,
                        products: scope.products.filter(
                            (product) => product.product_id.trim() !== '',
                        ),
                    })),
                pricings: values.pricings
                    .filter((pricing) => pricing.name.trim() !== '')
                    .map((pricing) => ({
                        ...pricing,
                        items: pricing.items
                            .filter(
                                (item) =>
                                    item.description.trim() !== '' ||
                                    item.amount.trim() !== '',
                            )
                            .map((item) => ({
                                ...item,
                                status_id: item.status_id.trim() || null,
                                amount:
                                    item.amount.trim() === ''
                                        ? null
                                        : item.amount,
                            })),
                    })),
            };

            const submitOptions = {
                onError: (serverErrors: Record<string, string>) => {
                    Object.entries(serverErrors).forEach(([field, message]) => {
                        setError(field as FieldPath<BidFormData>, {
                            type: 'server',
                            message: String(message),
                        });
                    });
                    toast.error(
                        Object.values(serverErrors)[0] ||
                            'The bid could not be saved. Check the form and try again.',
                    );
                },
            };

            if (method === 'patch') {
                router.patch(action, payload, submitOptions);
                return;
            }

            router.post(action, payload, submitOptions);
        },
        () => {
            toast.error(
                'The bid could not be saved. Check the highlighted fields and try again.',
            );
        },
    ) as FormEventHandler;

    const inputClassName =
        'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const latestTotal = (data.pricings ?? []).reduce((latest, pricing) => {
        const total = (pricing.items ?? []).reduce(
            (sum, item) => sum + (Number(item.amount) || 0),
            0,
        );

        return total;
    }, 0);
    const lastPricing = data.pricings?.[data.pricings.length - 1];
    const lastPricingTotal = (lastPricing?.items ?? []).reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0,
    );

    return (
        <form onSubmit={submit} className="flex flex-col gap-6 pr-14 sm:pr-16">
            <Card className="overflow-visible shadow-sm">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                        <CreatableSelect
                            id="bid-project"
                            label="Project name"
                            value={data.project_id ?? ''}
                            options={options.projects}
                            allowCreate={false}
                            placeholder="Type to find a project"
                            error={errorMessage(validationErrors, 'project_id')}
                            onChange={(projectId) =>
                                setData('project_id', projectId)
                            }
                        />
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="bid-notes"
                                value="Bid notes"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <textarea
                                id="bid-notes"
                                value={data.notes ?? ''}
                                rows={3}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                                placeholder="Optional notes for this bid"
                                onChange={(event) =>
                                    setData('notes', event.target.value)
                                }
                            />
                            <InputError
                                message={errorMessage(validationErrors, 'notes')}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Bid stages
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Track preliminary, revised, and later stages. Type a
                            new stage name to create it.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => appendStage(blankStage())}
                    >
                        <PlusIcon className="size-4" />
                        Add stage
                    </Button>
                </div>

                <div className="flex flex-col gap-4">
                    {stageFields.map((field, index) => {
                        const selectedIds = (data.stages ?? [])
                            .map((item, itemIndex) =>
                                itemIndex === index ? '' : item.stage_type_id,
                            )
                            .filter(Boolean);

                        return (
                            <div
                                key={field.id}
                                className="grid gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70 lg:grid-cols-[minmax(0,1.3fr)_10rem_minmax(0,1fr)_auto]"
                            >
                                <CreatableSelect
                                    id={`bid-stage-${index}`}
                                    label="Stage"
                                    value={data.stages?.[index]?.stage_type_id ?? ''}
                                    options={options.stageTypes}
                                    disabledIds={selectedIds}
                                    createRoute={route(
                                        'admin.bid-stage-types.store',
                                    )}
                                    catalogKey="stageTypes"
                                    entityLabel="stage"
                                    placeholder="Preliminary Bid"
                                    error={errorMessage(
                                        validationErrors,
                                        `stages.${index}.stage_type_id`,
                                    )}
                                    onChange={(stageTypeId) =>
                                        setData(
                                            `stages.${index}.stage_type_id`,
                                            stageTypeId,
                                        )
                                    }
                                />
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`bid-stage-date-${index}`}
                                        value="Date"
                                        className="text-emerald-700 dark:text-emerald-300"
                                    />
                                    <TextInput
                                        id={`bid-stage-date-${index}`}
                                        type="date"
                                        value={
                                            data.stages?.[index]?.stage_date ??
                                            ''
                                        }
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setData(
                                                `stages.${index}.stage_date`,
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`bid-stage-notes-${index}`}
                                        value="Notes"
                                        className="text-emerald-700 dark:text-emerald-300"
                                    />
                                    <TextInput
                                        id={`bid-stage-notes-${index}`}
                                        value={data.stages?.[index]?.notes ?? ''}
                                        className={inputClassName}
                                        placeholder="Optional"
                                        onChange={(event) =>
                                            setData(
                                                `stages.${index}.notes`,
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="flex items-start lg:pt-7">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        aria-label={`Remove stage ${index + 1}`}
                                        onClick={() => removeStage(index)}
                                    >
                                        <Trash2Icon className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Scope of work
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Choose or add a title, list the products in that
                            scope, and capture notations.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => appendScope(blankScope())}
                    >
                        <PlusIcon className="size-4" />
                        Add scope
                    </Button>
                </div>

                <div className="flex flex-col gap-4">
                    {scopeFields.map((field, index) => (
                        <ScopeWorkCard
                            key={field.id}
                            control={control}
                            data={data}
                            index={index}
                            options={options}
                            validationErrors={validationErrors}
                            onChange={setData}
                            onRemove={() => removeScope(index)}
                        />
                    ))}
                </div>
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Preliminary pricing
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Add revisions as pricing changes. Each line has a
                            product, basis, status, and amount.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            appendPricing(
                                blankPricing(
                                    `Revision ${pricingFields.length}`,
                                ),
                            )
                        }
                    >
                        <PlusIcon className="size-4" />
                        Add pricing revision
                    </Button>
                </div>

                <div className="flex flex-col gap-5">
                    {pricingFields.map((field, pricingIndex) => (
                        <PricingRevisionCard
                            key={field.id}
                            control={control}
                            data={data}
                            index={pricingIndex}
                            options={options}
                            validationErrors={validationErrors}
                            inputClassName={inputClassName}
                            canRemove={pricingFields.length > 1}
                            onChange={setData}
                            onRemove={() => removePricing(pricingIndex)}
                            onDuplicate={() =>
                                appendPricing({
                                    ...blankPricing(
                                        `${data.pricings?.[pricingIndex]?.name || 'Pricing'} copy`,
                                    ),
                                    items: (
                                        data.pricings?.[pricingIndex]?.items ??
                                        []
                                    ).map((item) => ({ ...item })),
                                })
                            }
                        />
                    ))}
                </div>
            </section>

            <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl border border-emerald-200 bg-background/95 px-4 py-3 shadow-lg backdrop-blur dark:border-emerald-900/70">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Latest revision total
                    </p>
                    <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatMoney(lastPricingTotal || latestTotal)}
                    </p>
                </div>
                <p className="text-sm text-muted-foreground">
                    {lastPricing?.name || 'No pricing yet'}
                </p>
            </div>

            <FormActionFab
                cancelHref={route('admin.bids.index')}
                saveLabel="Save bid"
                disabled={isSubmitting}
            />
        </form>
    );
}

function ScopeWorkCard({
    control,
    data,
    index,
    options,
    validationErrors,
    onChange,
    onRemove,
}: {
    control: ReturnType<typeof useForm<BidFormData>>['control'];
    data: BidFormData;
    index: number;
    options: BidOptions;
    validationErrors: FieldErrors<BidFormData>;
    onChange: <Field extends FieldPath<BidFormData>>(
        field: Field,
        value: PathValue<BidFormData, Field>,
    ) => void;
    onRemove: () => void;
}) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `scopes.${index}.products`,
    });
    const scope = data.scopes?.[index];

    return (
        <div className="flex flex-col gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                <CreatableSelect
                    id={`bid-scope-title-${index}`}
                    label="Title"
                    value={scope?.title_id ?? ''}
                    options={options.scopeTitles}
                    createRoute={route('admin.bid-scopes.store')}
                    catalogKey="scopeTitles"
                    entityLabel="scope title"
                    placeholder="RF doors, hardware, frames..."
                    error={errorMessage(
                        validationErrors,
                        `scopes.${index}.title_id`,
                    )}
                    onChange={(titleId) =>
                        onChange(`scopes.${index}.title_id`, titleId)
                    }
                />
                <div className="flex items-start lg:pt-7">
                    <Button
                        type="button"
                        variant="outline"
                        aria-label={`Remove scope ${index + 1}`}
                        onClick={onRemove}
                    >
                        <Trash2Icon className="size-4" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <InputLabel
                        value="Product"
                        className="text-emerald-700 dark:text-emerald-300"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => append(blankScopeProduct())}
                    >
                        <PlusIcon className="size-4" />
                        Add product
                    </Button>
                </div>
                {fields.map((productField, productIndex) => {
                    const selectedIds = (scope?.products ?? [])
                        .map((item, itemIndex) =>
                            itemIndex === productIndex ? '' : item.product_id,
                        )
                        .filter(Boolean);

                    return (
                    <div
                        key={productField.id}
                        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                        <CreatableSelect
                            id={`bid-scope-product-${index}-${productIndex}`}
                            label=""
                            compact
                            value={
                                scope?.products?.[productIndex]?.product_id ??
                                ''
                            }
                            options={options.products}
                            disabledIds={selectedIds}
                            createRoute={route('admin.products.catalog')}
                            catalogKey="products"
                            entityLabel="product"
                            createExtras={{ kind: 'door' }}
                            placeholder="Select or add a door or part"
                            onChange={(productId) =>
                                onChange(
                                    `scopes.${index}.products.${productIndex}.product_id`,
                                    productId,
                                )
                            }
                        />
                        <Button
                            type="button"
                            variant="outline"
                            aria-label={`Remove product ${productIndex + 1}`}
                            onClick={() => remove(productIndex)}
                        >
                            <Trash2Icon className="size-4" />
                        </Button>
                    </div>
                    );
                })}
            </div>

            <div className="flex flex-col gap-2">
                <InputLabel
                    htmlFor={`bid-scope-notations-${index}`}
                    value="Descriptions or notations"
                    className="text-emerald-700 dark:text-emerald-300"
                />
                <textarea
                    id={`bid-scope-notations-${index}`}
                    value={scope?.notations ?? ''}
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    placeholder="Notes for this scope of work"
                    onChange={(event) =>
                        onChange(
                            `scopes.${index}.notations`,
                            event.target.value,
                        )
                    }
                />
            </div>
        </div>
    );
}

function PricingRevisionCard({
    control,
    data,
    index,
    options,
    validationErrors,
    inputClassName,
    canRemove,
    onChange,
    onRemove,
    onDuplicate,
}: {
    control: ReturnType<typeof useForm<BidFormData>>['control'];
    data: BidFormData;
    index: number;
    options: BidOptions;
    validationErrors: FieldErrors<BidFormData>;
    inputClassName: string;
    canRemove: boolean;
    onChange: <Field extends FieldPath<BidFormData>>(
        field: Field,
        value: PathValue<BidFormData, Field>,
    ) => void;
    onRemove: () => void;
    onDuplicate: () => void;
}) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `pricings.${index}.items`,
    });
    const pricing = data.pricings?.[index];

    return (
        <div className="flex flex-col gap-4 rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_10rem_minmax(0,1fr)_auto]">
                <div className="flex flex-col gap-2">
                    <InputLabel
                        htmlFor={`pricing-name-${index}`}
                        value="Revision name"
                        className="text-emerald-700 dark:text-emerald-300"
                    />
                    <TextInput
                        id={`pricing-name-${index}`}
                        value={pricing?.name ?? ''}
                        className={inputClassName}
                        onChange={(event) =>
                            onChange(
                                `pricings.${index}.name`,
                                event.target.value,
                            )
                        }
                    />
                    <InputError
                        message={errorMessage(
                            validationErrors,
                            `pricings.${index}.name`,
                        )}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <InputLabel
                        htmlFor={`pricing-date-${index}`}
                        value="Date"
                        className="text-emerald-700 dark:text-emerald-300"
                    />
                    <TextInput
                        id={`pricing-date-${index}`}
                        type="date"
                        value={pricing?.revision_date ?? ''}
                        className={inputClassName}
                        onChange={(event) =>
                            onChange(
                                `pricings.${index}.revision_date`,
                                event.target.value,
                            )
                        }
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <InputLabel
                        htmlFor={`pricing-notes-${index}`}
                        value="Notes"
                        className="text-emerald-700 dark:text-emerald-300"
                    />
                    <TextInput
                        id={`pricing-notes-${index}`}
                        value={pricing?.notes ?? ''}
                        className={inputClassName}
                        placeholder="What changed"
                        onChange={(event) =>
                            onChange(
                                `pricings.${index}.notes`,
                                event.target.value,
                            )
                        }
                    />
                </div>
                <div className="flex items-start gap-2 lg:pt-7">
                    <Button
                        type="button"
                        variant="outline"
                        aria-label="Duplicate revision"
                        onClick={onDuplicate}
                    >
                        <CopyIcon className="size-4" />
                    </Button>
                    {canRemove ? (
                        <Button
                            type="button"
                            variant="outline"
                            aria-label="Remove revision"
                            onClick={onRemove}
                        >
                            <Trash2Icon className="size-4" />
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="hidden min-w-[52rem] grid-cols-[minmax(14rem,1.4fr)_minmax(12rem,1.1fr)_minmax(12rem,1fr)_8rem_auto] gap-3 border-b border-border px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                    <div>Line item</div>
                    <div>Pricing basis</div>
                    <div>Status</div>
                    <div>Amount</div>
                    <div />
                </div>
                <div className="flex min-w-[52rem] flex-col gap-3 pt-3">
                    {fields.map((itemField, itemIndex) => (
                        <div
                            key={itemField.id}
                            className="grid gap-3 md:grid-cols-[minmax(14rem,1.4fr)_minmax(12rem,1.1fr)_minmax(12rem,1fr)_8rem_auto] md:items-start"
                        >
                            <TextInput
                                value={
                                    pricing?.items?.[itemIndex]?.description ??
                                    ''
                                }
                                className={inputClassName}
                                placeholder="Product to be priced"
                                onChange={(event) =>
                                    onChange(
                                        `pricings.${index}.items.${itemIndex}.description`,
                                        event.target.value,
                                    )
                                }
                            />
                            <TextInput
                                value={
                                    pricing?.items?.[itemIndex]
                                        ?.pricing_basis ?? ''
                                }
                                className={inputClassName}
                                placeholder="Per opening, lump sum..."
                                onChange={(event) =>
                                    onChange(
                                        `pricings.${index}.items.${itemIndex}.pricing_basis`,
                                        event.target.value,
                                    )
                                }
                            />
                            <CreatableSelect
                                id={`pricing-status-${index}-${itemIndex}`}
                                label=""
                                compact
                                value={
                                    pricing?.items?.[itemIndex]?.status_id ?? ''
                                }
                                options={options.pricingStatuses}
                                createRoute={route(
                                    'admin.bid-pricing-statuses.store',
                                )}
                                catalogKey="pricingStatuses"
                                entityLabel="pricing status"
                                placeholder="Budget allowance"
                                onChange={(statusId) =>
                                    onChange(
                                        `pricings.${index}.items.${itemIndex}.status_id`,
                                        statusId,
                                    )
                                }
                            />
                            <TextInput
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                    pricing?.items?.[itemIndex]?.amount ?? ''
                                }
                                className={inputClassName}
                                placeholder="0.00"
                                onChange={(event) =>
                                    onChange(
                                        `pricings.${index}.items.${itemIndex}.amount`,
                                        event.target.value,
                                    )
                                }
                            />
                            <Button
                                type="button"
                                variant="outline"
                                aria-label="Remove line item"
                                onClick={() => remove(itemIndex)}
                            >
                                <Trash2Icon className="size-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => append(blankPricingItem())}
                >
                    <PlusIcon className="size-4" />
                    Add line item
                </Button>
                <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Revision total
                    </p>
                    <PricingTotal control={control} index={index} />
                </div>
            </div>
        </div>
    );
}
