import CreatableSelect from '@/Components/CreatableSelect';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import TextInput from '@/Components/TextInput';
import { Badge } from '@/Components/ui/badge';
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
    AppWindowIcon,
    DoorOpenIcon,
    FileTextIcon,
    PackageIcon,
    PlusIcon,
    Trash2Icon,
    XIcon,
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
    blankStatePrice,
    existingModel,
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
    manufacturer_id: z.string(),
    name: z.string().trim().min(1, 'Enter a name.').max(255),
    abbreviation: z.string().trim().max(255),
    description: z.string().trim().max(5000),
    notes: z.string().trim().max(5000),
    rf_shielding: z.string().max(255),
    stc_rating: z.string().max(255),
    ada: z.string(),
    fire_label: z.string().max(255),
    thickness: z.string().max(255),
    area_tested: z.string().max(255),
    weight: z.string().max(255),
    window_glass_type_id: z.string(),
    window_glazing_type_id: z.string(),
    window_seal_id: z.string(),
    spec_pdf: z.union([z.instanceof(File), z.null()]),
    remove_spec_pdf: z.boolean(),
    price: z.string(),
    markup_percent: z.string(),
    min_markup_percent: z.string(),
    tax_state_id: z.string(),
    tax_rate: z.string(),
    state_prices: z.array(
        z.object({
            tax_state_id: z.string(),
            tax_rate: z.string(),
            price: z.string(),
            markup_percent: z.string(),
            min_markup_percent: z.string(),
        }),
    ),
    configurations: z.array(
        z.object({
            configuration_id: z.string(),
        }),
    ),
    handings: z.array(
        z.object({
            handing_id: z.string(),
        }),
    ),
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
        clearErrors,
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
        fields: configurationFields,
        append: appendConfiguration,
        remove: removeConfiguration,
    } = useFieldArray({
        control,
        name: 'configurations',
    });

    const {
        fields: handingFields,
        append: appendHanding,
        remove: removeHanding,
    } = useFieldArray({
        control,
        name: 'handings',
    });

    const {
        fields: constructionFields,
        append: appendConstruction,
        remove: removeConstruction,
    } = useFieldArray({
        control,
        name: 'constructions',
    });

    const {
        fields: statePriceFields,
        append: appendStatePrice,
        remove: removeStatePrice,
    } = useFieldArray({
        control,
        name: 'state_prices',
    });

    const data = useWatch({
        control,
        defaultValue: defaultValues,
    }) as ProductFormData;
    const selectedType = (options.types ?? []).find(
        (type) => String(type.id) === String(data.product_type_id),
    );
    const selectedKind =
        selectedType?.kind ??
        (selectedType?.allows_parts ? 'door' : 'part');
    const isWindow = selectedKind === 'window';
    const isDoor = selectedKind === 'door';
    const isAssembly = isDoor || isWindow;
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
        kind?: string | null;
        allows_parts?: boolean | null;
    }) => {
        const nextTypeName = nextType?.name ?? '';

        if (
            !nextTypeName ||
            nextType?.allows_parts
        ) {
            previousTypeNameRef.current = nextTypeName;
            return;
        }

        const previousName = previousTypeNameRef.current;
        const currentName = (data.name ?? '').trim();
        const currentDescription = (data.description ?? '').trim();

        if (currentName === '' || currentName === previousName) {
            setData('name', nextTypeName);
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

    const currentModelId = product?.product_model_id ?? product?.model?.id ?? null;

    const checkModelName = (typed: string) => {
        const existing = existingModel(
            typed,
            options.models,
            currentModelId,
        );

        if (existing) {
            setError('name', {
                type: 'manual',
                message: 'This model already exists.',
            });

            return false;
        }

        clearErrors('name');

        return true;
    };

    const submit = handleSubmit(
        (values) => {
            if (!checkModelName(values.name)) {
                return;
            }

            if (!values.manufacturer_id.trim()) {
                setError('manufacturer_id', {
                    type: 'manual',
                    message: 'Select a manufacturer.',
                });

                return;
            }

            const payload = {
                product_type_id: values.product_type_id,
                manufacturer_id: values.manufacturer_id,
                name: values.name.trim(),
                abbreviation: values.abbreviation.trim() || null,
                description: isAssembly
                    ? values.description
                    : values.description.trim() || typeName,
                notes: values.notes,
                price: isAssembly ? null : inputToDecimal(values.price) || null,
                markup_percent: isAssembly
                    ? null
                    : inputToDecimal(values.markup_percent) || null,
                min_markup_percent: isAssembly
                    ? null
                    : inputToDecimal(values.min_markup_percent) || null,
                tax_state_id: isAssembly
                    ? null
                    : values.tax_state_id.trim() || null,
                tax_rate: isAssembly
                    ? null
                    : inputToDecimal(values.tax_rate) || null,
                state_prices: isAssembly
                    ? values.state_prices
                          .filter((item) => item.tax_state_id.trim() !== '')
                          .map((item) => ({
                              tax_state_id: item.tax_state_id,
                              tax_rate: inputToDecimal(item.tax_rate) || null,
                              price: inputToDecimal(item.price) || null,
                              markup_percent:
                                  inputToDecimal(item.markup_percent) || null,
                              min_markup_percent:
                                  inputToDecimal(item.min_markup_percent) ||
                                  null,
                          }))
                    : [],
                parts: isAssembly
                    ? values.parts.filter((part) => part.part_id.trim() !== '')
                    : [],
                constructions: isDoor
                    ? values.constructions.filter(
                          (item) => item.construction_id.trim() !== '',
                      )
                    : [],
                configurations: isDoor
                    ? values.configurations.filter(
                          (item) => item.configuration_id.trim() !== '',
                      )
                    : [],
                handings: isDoor
                    ? values.handings.filter(
                          (item) => item.handing_id.trim() !== '',
                      )
                    : [],
                rf_shielding: isDoor ? values.rf_shielding : null,
                stc_rating: isAssembly
                    ? values.stc_rating.trim() || null
                    : null,
                ada: isDoor && values.ada !== '' ? values.ada === '1' : null,
                fire_label: isDoor ? values.fire_label : null,
                thickness: isAssembly ? values.thickness : null,
                area_tested: isWindow ? values.area_tested : null,
                weight: isWindow ? values.weight.trim() || null : null,
                window_glass_type_id: isWindow
                    ? values.window_glass_type_id.trim() || null
                    : null,
                window_glazing_type_id: isWindow
                    ? values.window_glazing_type_id.trim() || null
                    : null,
                window_seal_id: isWindow
                    ? values.window_seal_id.trim() || null
                    : null,
                spec_pdf:
                    isAssembly && values.spec_pdf instanceof File
                        ? values.spec_pdf
                        : undefined,
                remove_spec_pdf: isAssembly ? values.remove_spec_pdf : false,
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
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-6 pr-16 sm:pr-20">
            <Card className="overflow-visible shadow-sm">
                <CardHeader>
                    <CardTitle>Product type</CardTitle>
                    <CardDescription>
                        {description} Choose door, window, or part first and
                        the rest of the form will adjust automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {(options.types ?? []).map((type) => {
                            const selected =
                                String(type.id) ===
                                String(data.product_type_id);
                            const typeKind =
                                type.kind ??
                                (type.allows_parts ? 'door' : 'part');
                            const assemblyType =
                                typeKind === 'door' || typeKind === 'window';

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
                                        {typeKind === 'window' ? (
                                            <AppWindowIcon className="size-5" />
                                        ) : typeKind === 'door' ||
                                          type.allows_parts ? (
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
                                            {typeKind === 'window'
                                                ? 'Typed STC, glass, glazing, seal, parts, and pricing.'
                                                : assemblyType
                                                    ? 'Model, construction, ratings, PDF, parts, and pricing.'
                                                    : 'Model, pricing, and part details.'}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <InputError
                        message={errorMessage(
                            validationErrors,
                            'product_type_id',
                        )}
                    />
                </CardContent>
            </Card>

            {selectedType ? (
                <>
                    <Card className="overflow-visible shadow-sm">
                        <CardHeader>
                            <CardTitle>
                                {title || `${typeName} information`}
                            </CardTitle>
                            <CardDescription>
                                {isAssembly
                                    ? `Enter the ${typeName.toLowerCase()} model and specification details, then pricing.`
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
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="product-model"
                                    value="Model"
                                    className="text-emerald-700 dark:text-emerald-300"
                                />
                                <TextInput
                                    id="product-model"
                                    value={data.name ?? ''}
                                    className={inputClassName}
                                    placeholder={
                                        isWindow
                                            ? 'KriegerShield 46 dB Window'
                                            : isDoor
                                              ? 'KriegerShield 40 dB Hollow Metal Door'
                                              : selectedType?.name ||
                                                'Hinge, lockset, closer...'
                                    }
                                    onChange={(event) => {
                                        setData('name', event.target.value);
                                        clearErrors('name');
                                    }}
                                    onBlur={(event) =>
                                        checkModelName(event.target.value)
                                    }
                                />
                                <p className="text-sm text-muted-foreground">
                                    Each product has one model. We check that
                                    the name is not already used.
                                </p>
                                <InputError
                                    message={errorMessage(
                                        validationErrors,
                                        'name',
                                    )}
                                />
                            </div>
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
                                        isWindow
                                            ? 'RF-W-46'
                                            : isDoor
                                              ? 'RF-HM-40dB'
                                              : 'HD-Hinge'
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

                            {isWindow ? (
                                <div className="flex flex-col gap-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">
                                            Window specifications
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Enter ratings, glass details, an
                                            optional specification PDF, and the
                                            parts used on this window.
                                        </p>
                                    </div>
                                    <div className="grid gap-5 lg:grid-cols-2">
                                        <div className="flex flex-col gap-2">
                                            <InputLabel
                                                htmlFor="product-stc-rating"
                                                value="STC Rating"
                                                className="text-emerald-700 dark:text-emerald-300"
                                            />
                                            <MaskedDecimalInput
                                                id="product-stc-rating"
                                                value={data.stc_rating ?? ''}
                                                className={inputClassName}
                                                placeholder="46"
                                                maxDecimals={0}
                                                withThousands={false}
                                                onChange={(value) =>
                                                    setData('stc_rating', value)
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
                                                htmlFor="product-weight"
                                                value="Weight"
                                                className="text-emerald-700 dark:text-emerald-300"
                                            />
                                            <MaskedDecimalInput
                                                id="product-weight"
                                                value={data.weight ?? ''}
                                                className={inputClassName}
                                                placeholder="30.1"
                                                maxDecimals={2}
                                                withThousands={false}
                                                onChange={(value) =>
                                                    setData('weight', value)
                                                }
                                            />
                                            <InputError
                                                message={errorMessage(
                                                    validationErrors,
                                                    'weight',
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
                                                placeholder='14"'
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
                                        <CreatableSelect
                                            id="product-glass-type"
                                            label="Glass Type"
                                            value={
                                                data.window_glass_type_id ?? ''
                                            }
                                            options={options.glassTypes ?? []}
                                            createRoute={route(
                                                'admin.window-glass-types.store',
                                            )}
                                            catalogKey="glassTypes"
                                            entityLabel="glass type"
                                            placeholder='1/2" LAM x 1/4" LAM'
                                            error={errorMessage(
                                                validationErrors,
                                                'window_glass_type_id',
                                            )}
                                            onChange={(glassTypeId) =>
                                                setData(
                                                    'window_glass_type_id',
                                                    glassTypeId,
                                                )
                                            }
                                        />
                                        <div className="flex flex-col gap-2">
                                            <InputLabel
                                                htmlFor="product-area-tested"
                                                value="Area Tested"
                                                className="text-emerald-700 dark:text-emerald-300"
                                            />
                                            <TextInput
                                                id="product-area-tested"
                                                value={data.area_tested ?? ''}
                                                className={inputClassName}
                                                placeholder="18 SQ. FT."
                                                onChange={(event) =>
                                                    setData(
                                                        'area_tested',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={errorMessage(
                                                    validationErrors,
                                                    'area_tested',
                                                )}
                                            />
                                        </div>
                                        <CreatableSelect
                                            id="product-seal"
                                            label="Seal"
                                            value={data.window_seal_id ?? ''}
                                            options={options.seals ?? []}
                                            createRoute={route(
                                                'admin.window-seals.store',
                                            )}
                                            catalogKey="seals"
                                            entityLabel="seal"
                                            placeholder="NC3"
                                            error={errorMessage(
                                                validationErrors,
                                                'window_seal_id',
                                            )}
                                            onChange={(sealId) =>
                                                setData(
                                                    'window_seal_id',
                                                    sealId,
                                                )
                                            }
                                        />
                                        <CreatableSelect
                                            id="product-glazing-type"
                                            label="Glazing Type"
                                            value={
                                                data.window_glazing_type_id ??
                                                ''
                                            }
                                            options={
                                                options.glazingTypes ?? []
                                            }
                                            createRoute={route(
                                                'admin.window-glazing-types.store',
                                            )}
                                            catalogKey="glazingTypes"
                                            entityLabel="glazing type"
                                            placeholder="Neoprene"
                                            error={errorMessage(
                                                validationErrors,
                                                'window_glazing_type_id',
                                            )}
                                            onChange={(glazingTypeId) =>
                                                setData(
                                                    'window_glazing_type_id',
                                                    glazingTypeId,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="product-spec-pdf"
                                            value="Specification PDF (optional)"
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
                                            Optional manufacturer PDF. Window
                                            ratings above are typed in, not
                                            taken from this file.
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
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground">
                                                Window parts
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                Attach reusable parts, or type a
                                                new part name to create it.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                appendPart(blankPart())
                                            }
                                        >
                                            <PlusIcon className="size-4" />
                                            Add part
                                        </Button>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        {partFields.map((field, index) => {
                                            const selectedIds = (
                                                data.parts ?? []
                                            )
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
                                                        id={`product-window-part-${index}`}
                                                        label="Part"
                                                        value={
                                                            data.parts?.[index]
                                                                ?.part_id ?? ''
                                                        }
                                                        options={options.parts}
                                                        disabledIds={
                                                            selectedIds
                                                        }
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
                                                                removePart(
                                                                    index,
                                                                )
                                                            }
                                                        >
                                                            <Trash2Icon className="size-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}

                            {isDoor ? (
                                <div className="flex flex-col gap-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                                    <div className="flex flex-col gap-3">
                                        <CreatableSelect
                                            id="product-configuration"
                                            label="Configuration"
                                            value=""
                                            options={
                                                options.configurations ?? []
                                            }
                                            disabledIds={configurationFields
                                                .map(
                                                    (_, index) =>
                                                        data.configurations?.[
                                                            index
                                                        ]?.configuration_id ??
                                                        '',
                                                )
                                                .filter(Boolean)}
                                            createRoute={route(
                                                'admin.door-configurations.store',
                                            )}
                                            catalogKey="configurations"
                                            entityLabel="configuration"
                                            clearOnSelect
                                            placeholder="Single, Uneven, Double"
                                            hint="Select a configuration to add it. A door can have more than one."
                                            error={errorMessage(
                                                validationErrors,
                                                'configurations',
                                            )}
                                            onChange={(configurationId) => {
                                                if (
                                                    !configurationId ||
                                                    (
                                                        data.configurations ??
                                                        []
                                                    ).some(
                                                        (item) =>
                                                            item.configuration_id ===
                                                            configurationId,
                                                    )
                                                ) {
                                                    return;
                                                }

                                                appendConfiguration({
                                                    configuration_id:
                                                        configurationId,
                                                });
                                            }}
                                        />
                                        {configurationFields.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {configurationFields.map(
                                                    (field, index) => {
                                                        const selectedId =
                                                            data
                                                                .configurations?.[
                                                                index
                                                            ]
                                                                ?.configuration_id ??
                                                            '';
                                                        const selected = (
                                                            options.configurations ??
                                                            []
                                                        ).find(
                                                            (option) =>
                                                                String(
                                                                    option.id,
                                                                ) ===
                                                                selectedId,
                                                        );

                                                        if (
                                                            !selected &&
                                                            !selectedId
                                                        ) {
                                                            return null;
                                                        }

                                                        return (
                                                            <Badge
                                                                key={field.id}
                                                                variant="outline"
                                                                className="h-7 gap-1.5 border-emerald-200 bg-background pr-1 text-sm dark:border-emerald-900/70"
                                                            >
                                                                {selected?.name ??
                                                                    'Configuration'}
                                                                <button
                                                                    type="button"
                                                                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                    aria-label={`Remove ${selected?.name ?? 'configuration'}`}
                                                                    onClick={() =>
                                                                        removeConfiguration(
                                                                            index,
                                                                        )
                                                                    }
                                                                >
                                                                    <XIcon className="size-3.5" />
                                                                </button>
                                                            </Badge>
                                                        );
                                                    },
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <CreatableSelect
                                            id="product-handing"
                                            label="Door handing"
                                            value=""
                                            options={options.handings ?? []}
                                            disabledIds={handingFields
                                                .map(
                                                    (_, index) =>
                                                        data.handings?.[index]
                                                            ?.handing_id ?? '',
                                                )
                                                .filter(Boolean)}
                                            createRoute={route(
                                                'admin.door-handings.store',
                                            )}
                                            catalogKey="handings"
                                            entityLabel="handing"
                                            clearOnSelect
                                            placeholder="Left Hand, Right Hand Reverse..."
                                            hint="Select a handing to add it. A door can have more than one."
                                            error={errorMessage(
                                                validationErrors,
                                                'handings',
                                            )}
                                            onChange={(handingId) => {
                                                if (
                                                    !handingId ||
                                                    (
                                                        data.handings ?? []
                                                    ).some(
                                                        (item) =>
                                                            item.handing_id ===
                                                            handingId,
                                                    )
                                                ) {
                                                    return;
                                                }

                                                appendHanding({
                                                    handing_id: handingId,
                                                });
                                            }}
                                        />
                                        {handingFields.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {handingFields.map(
                                                    (field, index) => {
                                                        const selectedId =
                                                            data.handings?.[
                                                                index
                                                            ]?.handing_id ?? '';
                                                        const selected = (
                                                            options.handings ??
                                                            []
                                                        ).find(
                                                            (option) =>
                                                                String(
                                                                    option.id,
                                                                ) ===
                                                                selectedId,
                                                        );

                                                        if (
                                                            !selected &&
                                                            !selectedId
                                                        ) {
                                                            return null;
                                                        }

                                                        return (
                                                            <Badge
                                                                key={field.id}
                                                                variant="outline"
                                                                className="h-7 gap-1.5 border-emerald-200 bg-background pr-1 text-sm dark:border-emerald-900/70"
                                                            >
                                                                {selected?.name ??
                                                                    'Handing'}
                                                                <button
                                                                    type="button"
                                                                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                    aria-label={`Remove ${selected?.name ?? 'handing'}`}
                                                                    onClick={() =>
                                                                        removeHanding(
                                                                            index,
                                                                        )
                                                                    }
                                                                >
                                                                    <XIcon className="size-3.5" />
                                                                </button>
                                                            </Badge>
                                                        );
                                                    },
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
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
                                            value={`${typeName} information PDF`}
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
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">
                                            Pricing
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {isAssembly
                                                ? 'Add a price for each state. You can create new states anytime, and each state can have its own price, markup, and tax percent.'
                                                : 'Enter the product price, then the markup we sell it at and the lowest markup we can accept. Choose a state and tax percent to add that sales tax to the sell prices.'}
                                        </p>
                                    </div>
                                    {isAssembly ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                appendStatePrice(
                                                    blankStatePrice(),
                                                )
                                            }
                                        >
                                            <PlusIcon className="size-4" />
                                            Add state price
                                        </Button>
                                    ) : null}
                                </div>
                                {isAssembly ? (
                                    <div className="flex flex-col gap-4">
                                        {statePriceFields.map(
                                            (field, index) => {
                                                const row =
                                                    data.state_prices?.[
                                                        index
                                                    ];
                                                const selectedIds = (
                                                    data.state_prices ?? []
                                                )
                                                    .map((item, itemIndex) =>
                                                        itemIndex === index
                                                            ? ''
                                                            : item.tax_state_id,
                                                    )
                                                    .filter(Boolean);
                                                const selectedState = (
                                                    options.taxStates ?? []
                                                ).find(
                                                    (state) =>
                                                        String(state.id) ===
                                                        String(
                                                            row?.tax_state_id ??
                                                                '',
                                                        ),
                                                );
                                                const rowTaxRate =
                                                    parseDecimal(
                                                        row?.tax_rate ?? '',
                                                    ) ??
                                                    selectedState?.rate ??
                                                    null;
                                                const rowSellPrice =
                                                    applyMarkup(
                                                        row?.price,
                                                        row?.markup_percent,
                                                    );
                                                const rowMinSellPrice =
                                                    applyMarkup(
                                                        row?.price,
                                                        row?.min_markup_percent,
                                                    );
                                                const rowSellTax = applyTax(
                                                    rowSellPrice,
                                                    rowTaxRate,
                                                );
                                                const rowSellTotal =
                                                    applyTaxTotal(
                                                        rowSellPrice,
                                                        rowTaxRate,
                                                    );
                                                const rowMinSellTax = applyTax(
                                                    rowMinSellPrice,
                                                    rowTaxRate,
                                                );
                                                const rowMinSellTotal =
                                                    applyTaxTotal(
                                                        rowMinSellPrice,
                                                        rowTaxRate,
                                                    );

                                                return (
                                                    <div
                                                        key={field.id}
                                                        className="flex flex-col gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <p className="text-sm font-semibold text-foreground">
                                                                {selectedState?.name ||
                                                                    `State ${index + 1}`}
                                                            </p>
                                                            {statePriceFields.length >
                                                            1 ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    aria-label={`Remove state price ${index + 1}`}
                                                                    onClick={() =>
                                                                        removeStatePrice(
                                                                            index,
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2Icon className="size-4" />
                                                                    Remove
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-4">
                                                            <CreatableSelect
                                                                id={`product-state-price-${index}`}
                                                                label="State"
                                                                value={
                                                                    row?.tax_state_id ??
                                                                    ''
                                                                }
                                                                options={
                                                                    options.taxStates ??
                                                                    []
                                                                }
                                                                disabledIds={
                                                                    selectedIds
                                                                }
                                                                createRoute={route(
                                                                    'admin.tax-states.store',
                                                                )}
                                                                catalogKey="taxStates"
                                                                entityLabel="state"
                                                                withRate
                                                                compact
                                                                placeholder="New Jersey, New York, Pennsylvania"
                                                                error={errorMessage(
                                                                    validationErrors,
                                                                    `state_prices.${index}.tax_state_id`,
                                                                )}
                                                                onChange={(
                                                                    taxStateId,
                                                                    option,
                                                                ) => {
                                                                    setData(
                                                                        `state_prices.${index}.tax_state_id`,
                                                                        taxStateId,
                                                                    );

                                                                    if (
                                                                        !taxStateId
                                                                    ) {
                                                                        setData(
                                                                            `state_prices.${index}.tax_rate`,
                                                                            '',
                                                                        );
                                                                        return;
                                                                    }

                                                                    if (
                                                                        option?.rate !==
                                                                            undefined &&
                                                                        option.rate !==
                                                                            null &&
                                                                        option.rate !==
                                                                            ''
                                                                    ) {
                                                                        setData(
                                                                            `state_prices.${index}.tax_rate`,
                                                                            String(
                                                                                option.rate,
                                                                            ),
                                                                        );
                                                                    }
                                                                }}
                                                            />
                                                            <div className="flex flex-col gap-2">
                                                                <InputLabel
                                                                    htmlFor={`product-state-tax-rate-${index}`}
                                                                    value="Tax percent"
                                                                    className="text-emerald-700 dark:text-emerald-300"
                                                                />
                                                                <MaskedDecimalInput
                                                                    id={`product-state-tax-rate-${index}`}
                                                                    suffix="%"
                                                                    withThousands={
                                                                        false
                                                                    }
                                                                    maxDecimals={
                                                                        3
                                                                    }
                                                                    value={
                                                                        row?.tax_rate ??
                                                                        ''
                                                                    }
                                                                    className={
                                                                        inputClassName
                                                                    }
                                                                    placeholder="6.625"
                                                                    onChange={(
                                                                        value,
                                                                    ) =>
                                                                        setData(
                                                                            `state_prices.${index}.tax_rate`,
                                                                            value,
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={errorMessage(
                                                                        validationErrors,
                                                                        `state_prices.${index}.tax_rate`,
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="grid gap-5 lg:grid-cols-3">
                                                            <div className="flex flex-col gap-2">
                                                                <InputLabel
                                                                    htmlFor={`product-state-price-amount-${index}`}
                                                                    value="Price"
                                                                    className="text-emerald-700 dark:text-emerald-300"
                                                                />
                                                                <MaskedDecimalInput
                                                                    id={`product-state-price-amount-${index}`}
                                                                    prefix="$"
                                                                    value={
                                                                        row?.price ??
                                                                        ''
                                                                    }
                                                                    className={
                                                                        inputClassName
                                                                    }
                                                                    placeholder="0.00"
                                                                    onChange={(
                                                                        value,
                                                                    ) =>
                                                                        setData(
                                                                            `state_prices.${index}.price`,
                                                                            value,
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={errorMessage(
                                                                        validationErrors,
                                                                        `state_prices.${index}.price`,
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <InputLabel
                                                                    htmlFor={`product-state-markup-${index}`}
                                                                    value="Sell markup"
                                                                    className="text-emerald-700 dark:text-emerald-300"
                                                                />
                                                                <MaskedDecimalInput
                                                                    id={`product-state-markup-${index}`}
                                                                    suffix="%"
                                                                    withThousands={
                                                                        false
                                                                    }
                                                                    value={
                                                                        row?.markup_percent ??
                                                                        ''
                                                                    }
                                                                    className={
                                                                        inputClassName
                                                                    }
                                                                    placeholder="25"
                                                                    onChange={(
                                                                        value,
                                                                    ) =>
                                                                        setData(
                                                                            `state_prices.${index}.markup_percent`,
                                                                            value,
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={errorMessage(
                                                                        validationErrors,
                                                                        `state_prices.${index}.markup_percent`,
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <InputLabel
                                                                    htmlFor={`product-state-min-markup-${index}`}
                                                                    value="Minimum markup"
                                                                    className="text-emerald-700 dark:text-emerald-300"
                                                                />
                                                                <MaskedDecimalInput
                                                                    id={`product-state-min-markup-${index}`}
                                                                    suffix="%"
                                                                    withThousands={
                                                                        false
                                                                    }
                                                                    value={
                                                                        row?.min_markup_percent ??
                                                                        ''
                                                                    }
                                                                    className={
                                                                        inputClassName
                                                                    }
                                                                    placeholder="15"
                                                                    onChange={(
                                                                        value,
                                                                    ) =>
                                                                        setData(
                                                                            `state_prices.${index}.min_markup_percent`,
                                                                            value,
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={errorMessage(
                                                                        validationErrors,
                                                                        `state_prices.${index}.min_markup_percent`,
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="grid gap-4 md:grid-cols-2">
                                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                                                                <p className="text-sm text-muted-foreground">
                                                                    Sell price
                                                                </p>
                                                                <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                                                                    {rowSellPrice ===
                                                                    null
                                                                        ? 'Add a price and markup'
                                                                        : formatCurrency(
                                                                              rowSellPrice,
                                                                          )}
                                                                </p>
                                                                {rowTaxRate !==
                                                                    null &&
                                                                rowSellTax !==
                                                                    null ? (
                                                                    <div className="mt-3 flex flex-col gap-1 text-sm">
                                                                        <p className="text-muted-foreground">
                                                                            {selectedState?.name ||
                                                                                'State'}{' '}
                                                                            tax
                                                                            (
                                                                            {
                                                                                rowTaxRate
                                                                            }
                                                                            %){' '}
                                                                            {formatCurrency(
                                                                                rowSellTax,
                                                                            )}
                                                                        </p>
                                                                        <p className="font-medium text-foreground">
                                                                            Total
                                                                            with
                                                                            tax{' '}
                                                                            {formatCurrency(
                                                                                rowSellTotal,
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                                                                <p className="text-sm text-muted-foreground">
                                                                    Minimum sell
                                                                    price
                                                                </p>
                                                                <p className="mt-1 text-lg font-semibold text-foreground">
                                                                    {rowMinSellPrice ===
                                                                    null
                                                                        ? 'Add a price and minimum markup'
                                                                        : formatCurrency(
                                                                              rowMinSellPrice,
                                                                          )}
                                                                </p>
                                                                {rowTaxRate !==
                                                                    null &&
                                                                rowMinSellTax !==
                                                                    null ? (
                                                                    <div className="mt-3 flex flex-col gap-1 text-sm">
                                                                        <p className="text-muted-foreground">
                                                                            {selectedState?.name ||
                                                                                'State'}{' '}
                                                                            tax
                                                                            (
                                                                            {
                                                                                rowTaxRate
                                                                            }
                                                                            %){' '}
                                                                            {formatCurrency(
                                                                                rowMinSellTax,
                                                                            )}
                                                                        </p>
                                                                        <p className="font-medium text-foreground">
                                                                            Total
                                                                            with
                                                                            tax{' '}
                                                                            {formatCurrency(
                                                                                rowMinSellTotal,
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            },
                                        )}
                                    </div>
                                ) : (
                                <>
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
                                </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {isDoor ? (
                        <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        {typeName} parts
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
                    ) : !isWindow ? (
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
                    ) : null}

                    <section className="flex flex-col gap-5 rounded-xl border border-border bg-background p-5">
                        <div>
                            <h3 className="text-base font-semibold text-foreground">
                                Additional information
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Optional notes
                                {isAssembly ? ' and description' : ''} kept separate
                                from the {typeName.toLowerCase()}{' '}
                                details above.
                            </p>
                        </div>
                        {isAssembly ? (
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
                                    placeholder={`What this ${typeName.toLowerCase()} includes`}
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
