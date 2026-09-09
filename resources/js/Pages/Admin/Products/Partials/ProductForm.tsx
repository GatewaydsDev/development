import CreatableSelect from '@/Components/CreatableSelect';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { cn } from '@/lib/utils';
import {
    applyMarkup,
    applyTax,
    applyTaxTotal,
    formatCurrency,
    inputToDecimal,
    parseDecimal,
} from '@/lib/money';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from '@inertiajs/react';
import {
    DoorOpenIcon,
    FileTextIcon,
    PackageIcon,
    PlusIcon,
    Trash2Icon,
} from 'lucide-react';
import { FormEventHandler, useMemo, useRef } from 'react';
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
    blankConstruction,
    blankPart,
    productToFormData,
    type ProductFormData,
    type ProductOptions,
    type ProductPayload,
    type ProductTypeOption,
} from '../types';

type ProductFormProps = {
    action: string;
    method?: 'post' | 'patch';
    title: string;
    description: string;
    options: ProductOptions;
    product?: ProductPayload;
};

const schema = z.object({
    product_type_id: z.string().trim().min(1, 'Select a type.'),
    manufacturer_id: z.string().trim().min(1, 'Select a manufacturer.'),
    product_model_id: z.string().trim().min(1, 'Select a model.'),
    abbreviation: z.string().trim().max(255),
    door_configuration_id: z.string(),
    door_handing_id: z.string(),
    description: z.string().trim().max(5000),
    notes: z.string().trim().max(5000),
    rf_shielding: z.string().max(255),
    stc_rating: z.string().max(255),
    ada: z.string(),
    fire_label: z.string().max(255),
    thickness: z.string().max(255),
    spec_pdf: z.union([z.instanceof(File), z.null()]),
    remove_spec_pdf: z.boolean(),
    price: z.string(),
    markup_percent: z.string(),
    min_markup_percent: z.string(),
    tax_state_id: z.string(),
    tax_rate: z.string(),
    constructions: z.array(
        z.object({
            construction_id: z.string(),
        }),
    ),
    parts: z.array(
        z.object({
            part_id: z.string(),
        }),
    ),
});

function errorMessage(
    errors: FieldErrors<ProductFormData>,
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

export default function ProductForm({
    action,
    method = 'post',
    title,
    description,
    options,
    product,
}: ProductFormProps) {
    const defaultValues = useMemo(
        () => productToFormData(product, options.types),
        [product, options.types],
    );
    const specPdfInputRef = useRef<HTMLInputElement>(null);

    const {
        control,
        handleSubmit,
        setValue,
        setError,
        formState: { errors: validationErrors, isSubmitting },
    } = useForm<ProductFormData>({
        resolver: zodResolver(schema),
        defaultValues,
    });

    const {
        fields: partFields,
        append: appendPart,
        remove: removePart,
    } = useFieldArray({
        control,
        name: 'parts',
    });

    const {
        fields: constructionFields,
        append: appendConstruction,
        remove: removeConstruction,
    } = useFieldArray({
        control,
        name: 'constructions',
    });

    const data = useWatch({
        control,
        defaultValue: defaultValues,
    }) as ProductFormData;
    const selectedType = (options.types ?? []).find(
        (type) => String(type.id) === String(data.product_type_id),
    );
    const isDoor = Boolean(selectedType?.allows_parts);
    const typeName = selectedType?.name ?? 'product';
    const previousTypeNameRef = useRef(selectedType?.name ?? '');
    const hasExistingPdf =
        Boolean(product?.spec_pdf_url) && !data.remove_spec_pdf && !data.spec_pdf;

    const setData = <Field extends FieldPath<ProductFormData>>(
        field: Field,
        value: PathValue<ProductFormData, Field>,
    ) => {
        setValue(field, value, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const applyTypeDefaults = (nextType?: {
        name?: string | null;
        allows_parts?: boolean | null;
    }) => {
        const nextTypeName = nextType?.name ?? '';

        if (!nextTypeName || nextType?.allows_parts) {
            previousTypeNameRef.current = nextTypeName;
            return;
        }

        const previousName = previousTypeNameRef.current;
        const selectedModel = (options.models ?? []).find(
            (model) => String(model.id) === String(data.product_model_id),
        );
        const currentName = (selectedModel?.name ?? '').trim();
        const currentDescription = (data.description ?? '').trim();

        if (currentName === '' || currentName === previousName) {
            const matchingModel = (options.models ?? []).find(
                (model) =>
                    !model.in_use &&
                    model.name.toLowerCase() === nextTypeName.toLowerCase(),
            );

            setData(
                'product_model_id',
                matchingModel ? String(matchingModel.id) : '',
            );
        }

        if (currentDescription === '' || currentDescription === previousName) {
            setData('description', nextTypeName);
        }

        previousTypeNameRef.current = nextTypeName;
    };

    const selectType = (type: ProductTypeOption) => {
        setData('product_type_id', String(type.id));
        applyTypeDefaults(type);
    };

    const submit = handleSubmit(
        (values) => {
            const payload = {
                product_type_id: values.product_type_id,
                manufacturer_id: values.manufacturer_id,
                product_model_id: values.product_model_id,
                abbreviation: values.abbreviation.trim() || null,
                door_configuration_id:
                    isDoor && values.door_configuration_id.trim() !== ''
                        ? values.door_configuration_id
                        : null,
                door_handing_id:
                    isDoor && values.door_handing_id.trim() !== ''
                        ? values.door_handing_id
                        : null,
                description: isDoor
                    ? values.description
                    : values.description.trim() || typeName,
                notes: values.notes,
                price: inputToDecimal(values.price) || null,
                markup_percent: inputToDecimal(values.markup_percent) || null,
                min_markup_percent:
                    inputToDecimal(values.min_markup_percent) || null,
                tax_state_id: values.tax_state_id.trim() || null,
                tax_rate: inputToDecimal(values.tax_rate) || null,
                parts: isDoor
                    ? values.parts.filter((part) => part.part_id.trim() !== '')
                    : [],
                constructions: isDoor
                    ? values.constructions.filter(
                          (item) => item.construction_id.trim() !== '',
                      )
                    : [],
                rf_shielding: isDoor ? values.rf_shielding : null,
                stc_rating: isDoor ? values.stc_rating : null,
                ada: isDoor && values.ada !== '' ? values.ada === '1' : null,
                fire_label: isDoor ? values.fire_label : null,
                thickness: isDoor ? values.thickness : null,
                spec_pdf:
                    isDoor && values.spec_pdf instanceof File
                        ? values.spec_pdf
                        : undefined,
                remove_spec_pdf: isDoor ? values.remove_spec_pdf : false,
                ...(method === 'patch' ? { _method: 'patch' } : {}),
            };

            router.post(action, payload, {
                forceFormData: true,
                onError: (serverErrors: Record<string, string>) => {
                    Object.entries(serverErrors).forEach(([field, message]) => {
                        setError(field as FieldPath<ProductFormData>, {
                            type: 'server',
                            message: String(message),
                        });
                    });
                    toast.error(
                        Object.values(serverErrors)[0] ||
                            'The product could not be saved. Check the form and try again.',
                    );
                },
            });
        },
        () => {
            toast.error(
                'The product could not be saved. Check the highlighted fields and try again.',
            );
        },
    ) as FormEventHandler;

    const inputClassName =
        'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const sellPrice = applyMarkup(data.price, data.markup_percent);
    const minSellPrice = applyMarkup(data.price, data.min_markup_percent);
    const selectedTax = (options.taxStates ?? []).find(
        (state) => String(state.id) === String(data.tax_state_id),
    );
    const taxRate = parseDecimal(data.tax_rate) ?? selectedTax?.rate ?? null;
    const sellTax = applyTax(sellPrice, taxRate);
    const sellTotal = applyTaxTotal(sellPrice, taxRate);
    const minSellTax = applyTax(minSellPrice, taxRate);
    const minSellTotal = applyTaxTotal(minSellPrice, taxRate);
    const specPdfName =
        data.spec_pdf instanceof File
            ? data.spec_pdf.name
            : product?.spec_pdf_name;

    return (
        <form onSubmit={submit} className="flex flex-col gap-6 pr-14 sm:pr-16">
            <Card className="overflow-visible shadow-sm">
                <CardHeader>
                    <CardTitle>Product type</CardTitle>
                    <CardDescription>
                        {description} Choose door or part first and the rest of
                        the form will adjust automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {(options.types ?? []).map((type) => {
                            const selected =
                                String(type.id) ===
                                String(data.product_type_id);
                            const doorType = Boolean(type.allows_parts);

                            return (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => selectType(type)}
                                    className={cn(
                                        'flex items-start gap-3 rounded-xl border p-4 text-left transition',
                                        selected
                                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30 dark:border-emerald-400 dark:bg-emerald-950/40'
                                            : 'border-border bg-background hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:border-emerald-800',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg',
                                            selected
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-muted text-muted-foreground',
                                        )}
                                    >
                                        {doorType ? (
                                            <DoorOpenIcon className="size-5" />
                                        ) : (
                                            <PackageIcon className="size-5" />
                                        )}
                                    </span>
                                    <span>
                                        <span className="block font-semibold text-foreground">
                                            {type.name}
                                        </span>
                                        <span className="mt-1 block text-sm text-muted-foreground">
                                            {doorType
                                                ? 'Model, construction, ratings, PDF, parts, and pricing.'
                                                : 'Model, pricing, and part details.'}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <CreatableSelect
                        id="product-type"
                        label="Or add another type"
                        value={data.product_type_id ?? ''}
                        options={options.types ?? []}
                        createRoute={route('admin.product-types.store')}
                        catalogKey="types"
                        entityLabel="type"
                        placeholder="Frame, Hardware..."
                        hint="Use this if the product is not a door or a part."
                        error={errorMessage(
                            validationErrors,
                            'product_type_id',
                        )}
                        onChange={(typeId, option) => {
                            setData('product_type_id', typeId);
                            applyTypeDefaults(
                                option ??
                                    (options.types ?? []).find(
                                        (type) => String(type.id) === typeId,
                                    ),
                            );
                        }}
                    />
                </CardContent>
            </Card>

            {selectedType ? (
                <>
                    <Card className="overflow-visible shadow-sm">
                        <CardHeader>
                            <CardTitle>
                                {title ||
                                    (isDoor
                                        ? 'Door information'
                                        : `${typeName} information`)}
                            </CardTitle>
                            <CardDescription>
                                {isDoor
                                    ? 'Enter the door model and specification details, then pricing.'
                                    : `Enter the ${typeName.toLowerCase()} model, then pricing.`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-5">
                            <CreatableSelect
                                id="product-manufacturer"
                                label="Manufacturer"
                                value={data.manufacturer_id ?? ''}
                                options={options.manufacturers ?? []}
                                createRoute={route(
                                    'admin.manufacturers.store',
                                )}
                                catalogKey="manufacturers"
                                entityLabel="manufacturer"
                                placeholder="Select or add a manufacturer"
                                hint="Who makes this product, for example Assa Abloy or Curries."
                                error={errorMessage(
                                    validationErrors,
                                    'manufacturer_id',
                                )}
                                onChange={(manufacturerId) =>
                                    setData('manufacturer_id', manufacturerId)
                                }
                            />
                            <CreatableSelect
                                id="product-model"
                                label="Model"
                                value={data.product_model_id ?? ''}
                                options={options.models ?? []}
                                disabledIds={(options.models ?? [])
                                    .filter((model) => model.in_use)
                                    .map((model) => String(model.id))}
                                createRoute={route('admin.product-models.store')}
                                catalogKey="models"
                                entityLabel="model"
                                placeholder={
                                    isDoor
                                        ? 'KriegerShield 40 dB Hollow Metal Door'
                                        : selectedType.name ||
                                          'Hinge, lockset, closer...'
                                }
                                hint="Each product has one model. Select an unused model or type a new name to add it."
                                error={errorMessage(
                                    validationErrors,
                                    'product_model_id',
                                )}
                                onChange={(modelId) =>
                                    setData('product_model_id', modelId)
                                }
                            />
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="product-abbreviation"
                                    value="Abbreviation"
                                    className="text-emerald-700 dark:text-emerald-300"
                                />
                                <TextInput
                                    id="product-abbreviation"
                                    value={data.abbreviation ?? ''}
                                    className={inputClassName}
                                    placeholder={
                                        isDoor ? 'RF-HM-40dB' : 'HD-Hinge'
                                    }
                                    onChange={(event) =>
                                        setData(
                                            'abbreviation',
                                            event.target.value,
                                        )
                                    }
                                />
                                <p className="text-sm text-muted-foreground">
                                    Short code for this model, for example
                                    RF-HM-40dB.
                                </p>
                                <InputError
                                    message={errorMessage(
                                        validationErrors,
                                        'abbreviation',
                                    )}
                                />
                            </div>

                            {isDoor ? (
                                <div className="flex flex-col gap-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                                    <CreatableSelect
                                        id="product-configuration"
                                        label="Configuration"
                                        value={data.door_configuration_id ?? ''}
                                        options={options.configurations ?? []}
                                        createRoute={route(
                                            'admin.door-configurations.store',
                                        )}
                                        catalogKey="configurations"
                                        entityLabel="configuration"
                                        placeholder="Single, Uneven, Double"
                                        hint="Each door has one configuration."
                                        error={errorMessage(
                                            validationErrors,
                                            'door_configuration_id',
                                        )}
                                        onChange={(configurationId) =>
                                            setData(
                                                'door_configuration_id',
                                                configurationId,
                                            )
                                        }
                                    />
                                    <CreatableSelect
                                        id="product-handing"
                                        label="Door handing"
                                        value={data.door_handing_id ?? ''}
                                        options={options.handings ?? []}
                                        createRoute={route(
                                            'admin.door-handings.store',
                                        )}
                                        catalogKey="handings"
                                        entityLabel="handing"
                                        placeholder="Left Hand, Right Hand Reverse..."
                                        hint="Each door has one handing option."
                                        error={errorMessage(
                                            validationErrors,
                                            'door_handing_id',
                                        )}
                                        onChange={(handingId) =>
                                            setData(
                                                'door_handing_id',
                                                handingId,
                                            )
                                        }
                                    />
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground">
                                                Construction
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                Metal, wood, or another
                                                construction. Add more if the
                                                door uses more than one.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                appendConstruction(
                                                    blankConstruction(),
                                                )
                                            }
                                        >
                                            <PlusIcon className="size-4" />
                                            Add construction
                                        </Button>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        {constructionFields.map(
                                            (field, index) => {
                                                const selectedIds = (
                                                    data.constructions ?? []
                                                )
                                                    .map((item, itemIndex) =>
                                                        itemIndex === index
                                                            ? ''
                                                            : item.construction_id,
                                                    )
                                                    .filter(Boolean);

                                                return (
                                                    <div
                                                        key={field.id}
                                                        className="grid gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70 lg:grid-cols-[minmax(0,1fr)_auto]"
                                                    >
                                                        <CreatableSelect
                                                            id={`product-construction-${index}`}
                                                            label="Construction"
                                                            value={
                                                                data
                                                                    .constructions?.[
                                                                    index
                                                                ]
                                                                    ?.construction_id ??
                                                                ''
                                                            }
                                                            options={
                                                                options.constructions ??
                                                                []
                                                            }
                                                            disabledIds={
                                                                selectedIds
                                                            }
                                                            createRoute={route(
                                                                'admin.door-constructions.store',
                                                            )}
                                                            catalogKey="constructions"
                                                            entityLabel="construction"
                                                            placeholder="Metal, Wood..."
                                                            error={errorMessage(
                                                                validationErrors,
                                                                `constructions.${index}.construction_id`,
                                                            )}
                                                            onChange={(
                                                                constructionId,
                                                            ) =>
                                                                setData(
                                                                    `constructions.${index}.construction_id`,
                                                                    constructionId,
                                                                )
                                                            }
                                                        />
                                                        <div className="flex items-start lg:pt-7">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                aria-label={`Remove construction ${index + 1}`}
                                                                onClick={() =>
                                                                    removeConstruction(
                                                                        index,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2Icon className="size-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            },
                                        )}
                                    </div>

                                    <div className="grid gap-5 lg:grid-cols-2">
                                        <div className="flex flex-col gap-2">
                                            <InputLabel
                                                htmlFor="product-rf-shielding"
                                                value="RF shielding"
                                                className="text-emerald-700 dark:text-emerald-300"
                                            />
                                            <TextInput
                                                id="product-rf-shielding"
                                                value={data.rf_shielding ?? ''}
                                                className={inputClassName}
                                                placeholder="60 dB"
                                                onChange={(event) =>
                                                    setData(
                                                        'rf_shielding',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={errorMessage(
                                                    validationErrors,
                                                    'rf_shielding',
                                                )}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <InputLabel
                                                htmlFor="product-stc-rating"
                                                value="STC rating"
                                                className="text-emerald-700 dark:text-emerald-300"
                                            />
                                            <TextInput
                                                id="product-stc-rating"
                                                value={data.stc_rating ?? ''}
                                                className={inputClassName}
                                                placeholder="50"
                                                onChange={(event) =>
                                                    setData(
                                                        'stc_rating',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={errorMessage(
                                                    validationErrors,
                                                    'stc_rating',
                                                )}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <InputLabel
                                                htmlFor="product-fire-label"
                                                value="Fire label"
                                                className="text-emerald-700 dark:text-emerald-300"
                                            />
                                            <TextInput
                                                id="product-fire-label"
                                                value={data.fire_label ?? ''}
                                                className={inputClassName}
                                                placeholder="90 min"
                                                onChange={(event) =>
                                                    setData(
                                                        'fire_label',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={errorMessage(
                                                    validationErrors,
                                                    'fire_label',
                                                )}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <InputLabel
                                                htmlFor="product-thickness"
                                                value="Thickness"
                                                className="text-emerald-700 dark:text-emerald-300"
                                            />
                                            <TextInput
                                                id="product-thickness"
                                                value={data.thickness ?? ''}
                                                className={inputClassName}
                                                placeholder='1 3/4"'
                                                onChange={(event) =>
                                                    setData(
                                                        'thickness',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={errorMessage(
                                                    validationErrors,
                                                    'thickness',
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            value="ADA"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                                            {[
                                                { value: '1', label: 'Yes' },
                                                { value: '0', label: 'No' },
                                            ].map((choice) => {
                                                const selected =
                                                    data.ada === choice.value;

                                                return (
                                                    <button
                                                        key={choice.value}
                                                        type="button"
                                                        onClick={() =>
                                                            setData(
                                                                'ada',
                                                                selected
                                                                    ? ''
                                                                    : choice.value,
                                                            )
                                                        }
                                                        className={cn(
                                                            'h-11 rounded-md border text-sm font-medium transition',
                                                            selected
                                                                ? 'border-emerald-500 bg-emerald-600 text-white'
                                                                : 'border-border bg-background text-foreground hover:border-emerald-300',
                                                        )}
                                                    >
                                                        {choice.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <InputError
                                            message={errorMessage(
                                                validationErrors,
                                                'ada',
                                            )}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="product-spec-pdf"
                                            value="Door information PDF"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <input
                                            ref={specPdfInputRef}
                                            id="product-spec-pdf"
                                            type="file"
                                            accept="application/pdf"
                                            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
                                            onChange={(event) => {
                                                const file =
                                                    event.target.files?.[0] ??
                                                    null;

                                                setData('spec_pdf', file);
                                                setData(
                                                    'remove_spec_pdf',
                                                    false,
                                                );
                                            }}
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            PDF up to 10 MB. Uploading a new
                                            file replaces the current one.
                                        </p>
                                        {(hasExistingPdf ||
                                            data.spec_pdf instanceof File) && (
                                            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-background px-3 py-2 dark:border-emerald-900/70">
                                                <FileTextIcon className="size-4 text-emerald-700 dark:text-emerald-300" />
                                                {hasExistingPdf &&
                                                product?.spec_pdf_url ? (
                                                    <a
                                                        href={
                                                            product.spec_pdf_url
                                                        }
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
                                                    >
                                                        {specPdfName ||
                                                            'Current PDF'}
                                                    </a>
                                                ) : (
                                                    <span className="text-sm font-medium text-foreground">
                                                        {specPdfName}
                                                    </span>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setData(
                                                            'spec_pdf',
                                                            null,
                                                        );
                                                        setData(
                                                            'remove_spec_pdf',
                                                            true,
                                                        );

                                                        if (
                                                            specPdfInputRef.current
                                                        ) {
                                                            specPdfInputRef.current.value =
                                                                '';
                                                        }
                                                    }}
                                                >
                                                    Remove PDF
                                                </Button>
                                            </div>
                                        )}
                                        <InputError
                                            message={errorMessage(
                                                validationErrors,
                                                'spec_pdf',
                                            )}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        Pricing
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Enter the product price, then the markup
                                        we sell it at and the lowest markup we
                                        can accept. Choose a state and tax
                                        percent to add that sales tax to the
                                        sell prices.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-4">
                                        <CreatableSelect
                                            id="product-tax-state"
                                            label="State tax"
                                            value={data.tax_state_id ?? ''}
                                            options={options.taxStates ?? []}
                                            createRoute={route(
                                                'admin.tax-states.store',
                                            )}
                                            catalogKey="taxStates"
                                            entityLabel="state tax"
                                            withRate
                                            compact
                                            placeholder="New Jersey, New York, Pennsylvania"
                                            error={errorMessage(
                                                validationErrors,
                                                'tax_state_id',
                                            )}
                                            onChange={(
                                                taxStateId,
                                                option,
                                            ) => {
                                                setData(
                                                    'tax_state_id',
                                                    taxStateId,
                                                );

                                                if (!taxStateId) {
                                                    setData('tax_rate', '');
                                                    return;
                                                }

                                                if (
                                                    option?.rate !==
                                                        undefined &&
                                                    option.rate !== null &&
                                                    option.rate !== ''
                                                ) {
                                                    setData(
                                                        'tax_rate',
                                                        String(option.rate),
                                                    );
                                                }
                                            }}
                                        />
                                        <div className="flex flex-col gap-2">
                                            <InputLabel
                                                htmlFor="product-tax-rate"
                                                value="Tax percent"
                                                className="text-emerald-700 dark:text-emerald-300"
                                            />
                                            <MaskedDecimalInput
                                                id="product-tax-rate"
                                                suffix="%"
                                                withThousands={false}
                                                maxDecimals={3}
                                                value={data.tax_rate ?? ''}
                                                className={inputClassName}
                                                placeholder="6.625"
                                                onChange={(value) =>
                                                    setData('tax_rate', value)
                                                }
                                            />
                                            <InputError
                                                message={errorMessage(
                                                    validationErrors,
                                                    'tax_rate',
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedTax
                                            ? `Saved on ${selectedTax.name} and reused on other products. Change it here anytime.`
                                            : 'Select a state, then enter or change its sales tax percent.'}
                                    </p>
                                </div>
                                <div className="grid gap-5 lg:grid-cols-3">
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="product-price"
                                            value="Price"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <MaskedDecimalInput
                                            id="product-price"
                                            prefix="$"
                                            value={data.price ?? ''}
                                            className={inputClassName}
                                            placeholder="0.00"
                                            onChange={(value) =>
                                                setData('price', value)
                                            }
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Unit cost or catalog price.
                                        </p>
                                        <InputError
                                            message={errorMessage(
                                                validationErrors,
                                                'price',
                                            )}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="product-markup"
                                            value="Sell markup"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <MaskedDecimalInput
                                            id="product-markup"
                                            suffix="%"
                                            withThousands={false}
                                            value={data.markup_percent ?? ''}
                                            className={inputClassName}
                                            placeholder="25"
                                            onChange={(value) =>
                                                setData(
                                                    'markup_percent',
                                                    value,
                                                )
                                            }
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Standard percent added when we sell.
                                        </p>
                                        <InputError
                                            message={errorMessage(
                                                validationErrors,
                                                'markup_percent',
                                            )}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="product-min-markup"
                                            value="Minimum markup"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <MaskedDecimalInput
                                            id="product-min-markup"
                                            suffix="%"
                                            withThousands={false}
                                            value={
                                                data.min_markup_percent ?? ''
                                            }
                                            className={inputClassName}
                                            placeholder="15"
                                            onChange={(value) =>
                                                setData(
                                                    'min_markup_percent',
                                                    value,
                                                )
                                            }
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Lowest percent we can sell this at.
                                        </p>
                                        <InputError
                                            message={errorMessage(
                                                validationErrors,
                                                'min_markup_percent',
                                            )}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70">
                                        <p className="text-sm text-muted-foreground">
                                            Sell price
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                                            {sellPrice === null
                                                ? 'Add a price and markup'
                                                : formatCurrency(sellPrice)}
                                        </p>
                                        {taxRate !== null &&
                                        sellTax !== null ? (
                                            <div className="mt-3 space-y-1 text-sm">
                                                <p className="text-muted-foreground">
                                                    {selectedTax?.name ||
                                                        'State'}{' '}
                                                    tax ({taxRate}%){' '}
                                                    {formatCurrency(sellTax)}
                                                </p>
                                                <p className="font-medium text-foreground">
                                                    Total with tax{' '}
                                                    {formatCurrency(
                                                        sellTotal,
                                                    )}
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70">
                                        <p className="text-sm text-muted-foreground">
                                            Minimum sell price
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-foreground">
                                            {minSellPrice === null
                                                ? 'Add a price and minimum markup'
                                                : formatCurrency(minSellPrice)}
                                        </p>
                                        {taxRate !== null &&
                                        minSellTax !== null ? (
                                            <div className="mt-3 space-y-1 text-sm">
                                                <p className="text-muted-foreground">
                                                    {selectedTax?.name ||
                                                        'State'}{' '}
                                                    tax ({taxRate}%){' '}
                                                    {formatCurrency(
                                                        minSellTax,
                                                    )}
                                                </p>
                                                <p className="font-medium text-foreground">
                                                    Total with tax{' '}
                                                    {formatCurrency(
                                                        minSellTotal,
                                                    )}
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {isDoor ? (
                        <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        Door parts
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Attach reusable parts, or type a new
                                        part name to create it.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => appendPart(blankPart())}
                                >
                                    <PlusIcon className="size-4" />
                                    Add part
                                </Button>
                            </div>

                            <div className="flex flex-col gap-4">
                                {partFields.map((field, index) => {
                                    const selectedIds = (data.parts ?? [])
                                        .map((item, itemIndex) =>
                                            itemIndex === index
                                                ? ''
                                                : item.part_id,
                                        )
                                        .filter(Boolean);

                                    return (
                                        <div
                                            key={field.id}
                                            className="grid gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70 lg:grid-cols-[minmax(0,1fr)_auto]"
                                        >
                                            <CreatableSelect
                                                id={`product-part-${index}`}
                                                label="Part"
                                                value={
                                                    data.parts?.[index]
                                                        ?.part_id ?? ''
                                                }
                                                options={options.parts}
                                                disabledIds={selectedIds}
                                                createRoute={route(
                                                    'admin.products.catalog',
                                                )}
                                                catalogKey="parts"
                                                entityLabel="part"
                                                createExtras={{
                                                    kind: 'part',
                                                }}
                                                placeholder="Hinge, lockset, closer..."
                                                error={errorMessage(
                                                    validationErrors,
                                                    `parts.${index}.part_id`,
                                                )}
                                                onChange={(partId) =>
                                                    setData(
                                                        `parts.${index}.part_id`,
                                                        partId,
                                                    )
                                                }
                                            />
                                            <div className="flex items-start lg:pt-7">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    aria-label={`Remove part ${index + 1}`}
                                                    onClick={() =>
                                                        removePart(index)
                                                    }
                                                >
                                                    <Trash2Icon className="size-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ) : (
                        <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                            <div>
                                <h3 className="text-base font-semibold text-foreground">
                                    {typeName} details
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Default text for this{' '}
                                    {typeName.toLowerCase()}. Edit it or add
                                    more detail.
                                </p>
                            </div>
                            <textarea
                                id="product-type-details"
                                value={data.description || typeName}
                                rows={4}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                                placeholder={typeName}
                                onChange={(event) =>
                                    setData('description', event.target.value)
                                }
                            />
                        </section>
                    )}

                    <section className="flex flex-col gap-5 rounded-xl border border-border bg-background p-5">
                        <div>
                            <h3 className="text-base font-semibold text-foreground">
                                Additional information
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Optional notes
                                {isDoor ? ' and description' : ''} kept separate
                                from the {isDoor ? 'door' : typeName.toLowerCase()}{' '}
                                details above.
                            </p>
                        </div>
                        {isDoor ? (
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="product-description"
                                    value="Description"
                                    className="text-emerald-700 dark:text-emerald-300"
                                />
                                <textarea
                                    id="product-description"
                                    value={data.description ?? ''}
                                    rows={3}
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                                    placeholder="What this door includes"
                                    onChange={(event) =>
                                        setData(
                                            'description',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                        ) : null}
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="product-notes"
                                value="Notes"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <textarea
                                id="product-notes"
                                value={data.notes ?? ''}
                                rows={3}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                                placeholder="Optional internal notes"
                                onChange={(event) =>
                                    setData('notes', event.target.value)
                                }
                            />
                        </div>
                    </section>
                </>
            ) : null}

            <FormActionFab
                cancelHref={route('admin.products.index')}
                saveLabel="Save product"
                disabled={isSubmitting}
            />
        </form>
    );
}
