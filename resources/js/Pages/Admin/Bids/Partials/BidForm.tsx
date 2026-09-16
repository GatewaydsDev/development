import CreatableSelect from '@/Components/CreatableSelect';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
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
import { router, usePage } from '@inertiajs/react';
import { PlusIcon, Trash2Icon, FileUpIcon } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useRef, useState } from 'react';
import {
    Control,
    FieldErrors,
    FieldPath,
    PathValue,
    UseFormSetValue,
    useFieldArray,
    useForm,
    useWatch,
} from 'react-hook-form';
import { inputToDecimal } from '@/lib/money';
import { toast } from 'sonner';
import { z } from 'zod';
import { type PageProps } from '@/types';
import BidApplicationTextSection from './BidApplicationTextSection';
import {
    bidToFormData,
    blankRevision,
    blankScope,
    blankScopeProduct,
    blankStage,
    formatMoney,
    lineAmountsForProduct,
    scopeExtendedAmount,
    combinedPriceAmount,
    pricingFromQuotation,
    quotationImportHtml,
    scopesFromProject,
    scopesTotalAmount,
    scopesCombinedPriceAmount,
    type BidFormData,
    type BidOptions,
    type BidPayload,
    type BidQuotationOption,
} from '../types';

type BidFormProps = {
    action: string;
    method?: 'post' | 'patch';
    title: string;
    description: string;
    options: BidOptions;
    bid?: BidPayload;
    importQuotationId?: number | null;
    onSelectedProjectNameChange?: (name: string) => void;
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
    quotation_id: z.string(),
    notes: z
        .string()
        .max(250000, 'Shipping and handling exclusions/adjustments must be 250,000 characters or less.'),
    bid_shipping_text_template_id: z.string(),
    bid_text_template_id: z.string(),
    application_text: z
        .string()
        .max(250000, 'Bid text must be 250,000 characters or less.'),
    bid_scope_text_template_id: z.string(),
    scope_of_work_text: z
        .string()
        .max(250000, 'Scope of work text must be 250,000 characters or less.'),
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
            scope_type: z.string(),
            title_name: z.string(),
            notations: z
                .string()
                .max(250000, 'Scope information must be 250,000 characters or less.'),
            products: z.array(
                z.object({
                    product_id: z.string(),
                    service_id: z.string(),
                    location: z
                        .string()
                        .trim()
                        .max(255, 'Location must be 255 characters or less.'),
                    quantity: optionalMoneySchema,
                    unit_bid: optionalMoneySchema,
                    extended: optionalMoneySchema,
                    allocated_handling: optionalMoneySchema,
                }),
            ),
        }),
    ),
    pricings: z.array(
        z.object({
            name: z.string(),
            revision_date: optionalDateSchema,
            notes: z.string().max(2000),
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
}).superRefine((values, context) => {
    values.scopes.forEach((scope, scopeIndex) => {
        scope.products.forEach((product, productIndex) => {
            const productId = product.product_id.trim();
            const serviceId = product.service_id.trim();

            if (productId === '' && serviceId === '') {
                return;
            }

            if (productId === '') {
                context.addIssue({
                    code: 'custom',
                    path: [
                        'scopes',
                        scopeIndex,
                        'products',
                        productIndex,
                        'product_id',
                    ],
                    message: 'Select a product.',
                });
            }

            if (serviceId === '') {
                context.addIssue({
                    code: 'custom',
                    path: [
                        'scopes',
                        scopeIndex,
                        'products',
                        productIndex,
                        'service_id',
                    ],
                    message: 'Select a service.',
                });
            }
        });
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

export default function BidForm({
    action,
    method = 'post',
    title,
    description,
    options,
    bid,
    importQuotationId = null,
    onSelectedProjectNameChange,
}: BidFormProps) {
    const { auth } = usePage<PageProps>().props;
    const currentUserId = auth.user?.id ? String(auth.user.id) : '';
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
        getValues,
        formState: { errors: validationErrors, isSubmitting },
    } = useForm<BidFormData>({
        resolver: zodResolver(schema),
        defaultValues,
    });

    const {
        fields: revisionFields,
        append: appendRevision,
        remove: removeRevision,
    } = useFieldArray({ control, name: 'revisions' });
    const {
        fields: stageFields,
        append: appendStage,
        remove: removeStage,
    } = useFieldArray({ control, name: 'stages' });
    const {
        fields: scopeFields,
        append: appendScope,
        remove: removeScope,
        replace: replaceScopes,
    } = useFieldArray({ control, name: 'scopes' });

    const data = useWatch({
        control,
        defaultValue: defaultValues,
    }) as BidFormData;
    const selectedProject = options.projects.find(
        (project) => String(project.id) === (data.project_id ?? ''),
    );

    useEffect(() => {
        onSelectedProjectNameChange?.(selectedProject?.name ?? '');
    }, [onSelectedProjectNameChange, selectedProject?.name]);

    const setData = <Field extends FieldPath<BidFormData>>(
        field: Field,
        value: PathValue<BidFormData, Field>,
    ) => {
        setValue(field, value, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const quotations = options.quotations ?? [];
    const [importQuotationValue, setImportQuotationValue] = useState(
        importQuotationId ? String(importQuotationId) : '',
    );
    const autoImported = useRef(false);

    const applyQuotation = (quotation: BidQuotationOption, confirmReplace = true) => {
        if (!quotation.project_id) {
            toast.error(
                'Link this quotation to a project before importing it onto a bid.',
            );
            return false;
        }

        const current = getValues();
        const replacingProject =
            current.project_id !== '' &&
            current.project_id !== String(quotation.project_id);

        if (
            confirmReplace &&
            (replacingProject || current.scope_of_work_text.trim() !== '') &&
            !window.confirm(
                'Import this quotation onto the bid form? The quotation stays saved. Project and quoted items on this form will be replaced.',
            )
        ) {
            return false;
        }

        const project = options.projects.find(
            (item) => item.id === quotation.project_id,
        );

        setData('quotation_id', String(quotation.id));
        setData('project_id', String(quotation.project_id));
        replaceScopes(
            scopesFromProject(project, options.scopeTitles, options.products),
        );
        setData('scope_of_work_text', quotationImportHtml(quotation));
        setData('pricings', [pricingFromQuotation(quotation)]);

        if (current.notes.trim() === '' && quotation.notes) {
            setData(
                'notes',
                `<p>${quotation.notes
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br />')}</p>`,
            );
        }

        if (current.application_text.trim() === '') {
            setData(
                'application_text',
                `<p>Created from quotation ${quotation.quotation_number} — ${quotation.title}.</p>`,
            );
        }

        toast.success(
            `Imported ${quotation.quotation_number}. The quotation stays saved and linked to this bid.`,
        );

        return true;
    };

    useEffect(() => {
        if (autoImported.current || !importQuotationId) {
            return;
        }

        const quotation = quotations.find((item) => item.id === importQuotationId);

        if (!quotation) {
            return;
        }

        autoImported.current = true;
        setImportQuotationValue(String(quotation.id));
        applyQuotation(quotation, false);
    }, [importQuotationId, quotations]);

    const submit = handleSubmit(
        (values) => {
            const payload = {
                ...values,
                quotation_id: values.quotation_id.trim() || null,
                bid_shipping_text_template_id:
                    values.bid_shipping_text_template_id.trim() || null,
                bid_text_template_id: values.bid_text_template_id.trim() || null,
                application_text: values.application_text,
                bid_scope_text_template_id:
                    values.bid_scope_text_template_id.trim() || null,
                scope_of_work_text: values.scope_of_work_text,
                stages: values.stages.filter(
                    (stage) => stage.stage_type_id.trim() !== '',
                ),
                revisions: (values.revisions ?? [])
                    .filter((revision) => revision.number.trim() !== '')
                    .map((revision) => ({
                        id: revision.id.trim() || null,
                        number: revision.number,
                        revision_date: revision.revision_date,
                        notes: revision.notes,
                    })),
                scopes: values.scopes
                    .filter(
                        (scope) =>
                            scope.title_id.trim() !== '' ||
                            scope.scope_type.trim() !== '',
                    )
                    .map((scope) => ({
                        ...scope,
                        products: scope.products
                            .filter(
                                (product) =>
                                    product.product_id.trim() !== '' ||
                                    product.service_id.trim() !== '',
                            )
                            .map((product) => ({
                                ...product,
                                location: product.location.trim() || null,
                                quantity: inputToDecimal(product.quantity) || null,
                                unit_bid: inputToDecimal(product.unit_bid) || null,
                                extended:
                                    inputToDecimal(
                                        scopeExtendedAmount(
                                            product.quantity,
                                            product.unit_bid,
                                            product.allocated_handling,
                                        ),
                                    ) || null,
                                allocated_handling:
                                    inputToDecimal(product.allocated_handling) ||
                                    null,
                            })),
                    })),
                pricings: values.pricings
                    .map((pricing) => ({
                        ...pricing,
                        items: pricing.items.filter(
                            (item) =>
                                item.description.trim() !== '' ||
                                item.pricing_basis.trim() !== '' ||
                                String(item.amount ?? '').trim() !== '',
                        ),
                    }))
                    .filter(
                        (pricing) =>
                            pricing.items.length > 0 ||
                            pricing.notes.trim() !== '' ||
                            pricing.revision_date.trim() !== '',
                    ),
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
    const latestTotal = scopesTotalAmount(data.scopes ?? []);
    const combinedPriceValue = scopesCombinedPriceAmount(data.scopes ?? []);
    const selectedProjectScopes = selectedProject?.scopes ?? [];

    return (
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-6 pr-16 sm:pr-20">
            <Card className="overflow-visible shadow-sm">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    <div className="flex flex-col gap-5">
                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                            <CreatableSelect
                                id="bid-project"
                                label="Project name"
                                value={data.project_id ?? ''}
                                options={options.projects}
                                allowCreate={false}
                                placeholder="Type to find a project"
                                error={errorMessage(validationErrors, 'project_id')}
                                onChange={(projectId) => {
                                    const previousProjectId = data.project_id;
                                    setData('project_id', projectId);

                                    if (projectId === previousProjectId) {
                                        return;
                                    }

                                    const project = options.projects.find(
                                        (item) => String(item.id) === projectId,
                                    );

                                    replaceScopes(
                                        scopesFromProject(
                                            project,
                                            options.scopeTitles,
                                            options.products,
                                        ),
                                    );

                                    const linkedQuotation = quotations.find(
                                        (item) =>
                                            String(item.id) ===
                                            (data.quotation_id ?? ''),
                                    );

                                    if (
                                        linkedQuotation?.project_id &&
                                        String(linkedQuotation.project_id) !==
                                            projectId
                                    ) {
                                        setData('quotation_id', '');
                                    }
                                }}
                            />
                        </div>
                        {selectedProject ? (
                            <p className="text-sm text-muted-foreground">
                                Contractor:{' '}
                                {selectedProject.contractor_name ||
                                    'Not assigned on this project'}
                            </p>
                        ) : null}
                        {quotations.length > 0 ? (
                            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-end">
                                <CreatableSelect
                                    id="bid-import-quotation"
                                    label="Import quotation"
                                    value={importQuotationValue}
                                    options={quotations}
                                    allowCreate={false}
                                    placeholder="Type to find a saved quotation"
                                    hint="The quotation stays in Quotations. Import copies the project and line items onto this bid."
                                    onChange={(quotationId) =>
                                        setImportQuotationValue(quotationId)
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11"
                                    onClick={() => {
                                        const quotation = quotations.find(
                                            (item) =>
                                                String(item.id) ===
                                                importQuotationValue,
                                        );

                                        if (!quotation) {
                                            toast.error(
                                                'Select a quotation to import.',
                                            );
                                            return;
                                        }

                                        applyQuotation(quotation);
                                    }}
                                >
                                    <FileUpIcon className="size-4" />
                                    Import quotation
                                </Button>
                            </div>
                        ) : null}
                        {data.quotation_id ? (
                            <p className="text-sm text-muted-foreground">
                                Linked to quotation{' '}
                                {quotations.find(
                                    (item) =>
                                        String(item.id) === data.quotation_id,
                                )?.quotation_number ??
                                    bid?.quotation?.quotation_number ??
                                    `#${data.quotation_id}`}
                                . The original quote remains saved.
                            </p>
                        ) : null}
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="bid-project-address"
                                value="Project address"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <TextInput
                                id="bid-project-address"
                                value={selectedProject?.site_address ?? ''}
                                disabled
                                readOnly
                                className="h-11 w-full cursor-not-allowed border-border bg-muted text-foreground"
                                placeholder="Select a project to see the address"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Bid revisions
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Track drawing or document revisions for this bid.
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
                                    className="grid gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_auto]"
                                >
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`bid-revision-number-${index}`}
                                            value="Revision"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id={`bid-revision-number-${index}`}
                                            value={revision?.number ?? ''}
                                            className={inputClassName}
                                            placeholder="A, B, 1"
                                            onChange={(event) =>
                                                setData(
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
                                            htmlFor={`bid-revision-date-${index}`}
                                            value="Date"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id={`bid-revision-date-${index}`}
                                            type="date"
                                            value={
                                                revision?.revision_date ?? ''
                                            }
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    `revisions.${index}.revision_date`,
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`bid-revision-user-${index}`}
                                            value="Updated by"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id={`bid-revision-user-${index}`}
                                            value={revision?.user_name ?? ''}
                                            disabled
                                            readOnly
                                            className={`${inputClassName} cursor-not-allowed bg-muted`}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`bid-revision-notes-${index}`}
                                            value="Notes"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id={`bid-revision-notes-${index}`}
                                            value={revision?.notes ?? ''}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    `revisions.${index}.notes`,
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="flex items-start lg:pt-7">
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
                            {selectedProjectScopes.length > 0
                                ? 'Start with predefined scope wording, then add or remove service and product lines from the selected project.'
                                : 'Start with predefined scope wording. Select a project to load its scopes, then add or remove service and product lines.'}
                        </p>
                    </div>
                    {selectedProjectScopes.length === 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => appendScope(blankScope())}
                        >
                            <PlusIcon className="size-4" />
                            Add scope
                        </Button>
                    )}
                </div>

                <BidApplicationTextSection
                    embedded
                    purpose="scope"
                    options={options}
                    project={selectedProject}
                    scopes={data.scopes ?? []}
                    value={data.scope_of_work_text ?? ''}
                    templateId={data.bid_scope_text_template_id ?? ''}
                    error={errorMessage(validationErrors, 'scope_of_work_text')}
                    onChange={(html) => setData('scope_of_work_text', html)}
                    onTemplateIdChange={(id) =>
                        setData('bid_scope_text_template_id', id)
                    }
                />

                {scopeFields.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                        {data.project_id
                            ? 'This project does not have a scope of work yet.'
                            : 'Select a project to load its scope of work.'}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {scopeFields.map((field, index) => (
                            <ScopeWorkCard
                                key={field.id}
                                control={control}
                                data={data}
                                index={index}
                                options={options}
                                projectState={selectedProject?.site_state}
                                validationErrors={validationErrors}
                                inputClassName={inputClassName}
                                locked={selectedProjectScopes.length > 0}
                                onChange={setData}
                                setValue={setValue}
                                onRemove={() => removeScope(index)}
                            />
                        ))}
                    </div>
                )}
            </section>

            <BidApplicationTextSection
                purpose="shipping"
                options={options}
                project={selectedProject}
                scopes={data.scopes ?? []}
                value={data.notes ?? ''}
                templateId={data.bid_shipping_text_template_id ?? ''}
                error={errorMessage(validationErrors, 'notes')}
                onChange={(html) => setData('notes', html)}
                onTemplateIdChange={(id) =>
                    setData('bid_shipping_text_template_id', id)
                }
            />

            <BidApplicationTextSection
                options={options}
                project={selectedProject}
                scopes={data.scopes ?? []}
                value={data.application_text ?? ''}
                templateId={data.bid_text_template_id ?? ''}
                error={errorMessage(validationErrors, 'application_text')}
                onChange={(html) => setData('application_text', html)}
                onTemplateIdChange={(id) =>
                    setData('bid_text_template_id', id)
                }
            />

            <div className="sticky bottom-4 z-10 mr-16 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:mr-20 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/70">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Latest revision total
                    </p>
                    <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatMoney(latestTotal)}
                    </p>
                </div>
                <div className="sm:text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Combined price
                    </p>
                    <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                        {combinedPriceValue
                            ? formatMoney(combinedPriceValue)
                            : '—'}
                    </p>
                </div>
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
    projectState,
    validationErrors,
    inputClassName,
    locked,
    onChange,
    setValue,
    onRemove,
}: {
    control: Control<BidFormData>;
    data: BidFormData;
    index: number;
    options: BidOptions;
    projectState?: string | null;
    validationErrors: FieldErrors<BidFormData>;
    inputClassName: string;
    locked: boolean;
    onChange: <Field extends FieldPath<BidFormData>>(
        field: Field,
        value: PathValue<BidFormData, Field>,
    ) => void;
    setValue: UseFormSetValue<BidFormData>;
    onRemove: () => void;
}) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `scopes.${index}.products`,
    });
    const scope = data.scopes?.[index];
    const titleName =
        scope?.title_name ||
        options.scopeTitles.find(
            (title) => String(title.id) === (scope?.title_id ?? ''),
        )?.name ||
        '';
    const hasEmptyLine = (scope?.products ?? []).some(
        (item) =>
            item.product_id.trim() === '' && item.service_id.trim() === '',
    );
    const canAddProduct = !hasEmptyLine;
    const setLineAmount = (
        productIndex: number,
        field: 'quantity' | 'unit_bid' | 'allocated_handling',
        value: string,
    ) => {
        const line = scope?.products?.[productIndex];
        const quantity = field === 'quantity' ? value : (line?.quantity ?? '');
        const unitBid = field === 'unit_bid' ? value : (line?.unit_bid ?? '');
        const allocated =
            field === 'allocated_handling'
                ? value
                : (line?.allocated_handling ?? '');

        onChange(`scopes.${index}.products.${productIndex}.${field}`, value);
        onChange(
            `scopes.${index}.products.${productIndex}.extended`,
            scopeExtendedAmount(quantity, unitBid, allocated),
        );
    };

    return (
        <div className="flex flex-col gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                {locked || scope?.scope_type ? (
                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor={`bid-scope-title-${index}`}
                            value="Scope"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <TextInput
                            id={`bid-scope-title-${index}`}
                            value={titleName}
                            disabled
                            readOnly
                            className="h-11 w-full cursor-not-allowed border-border bg-muted text-foreground"
                        />
                    </div>
                ) : (
                    <CreatableSelect
                        id={`bid-scope-title-${index}`}
                        label="Scope type"
                        value={scope?.title_id ?? ''}
                        options={options.scopeTitles}
                        createRoute={route('admin.project-scope-types.store')}
                        catalogKey="scopeTitles"
                        entityLabel="scope type"
                        placeholder="Select a scope"
                        error={errorMessage(
                            validationErrors,
                            `scopes.${index}.title_id`,
                        )}
                        onChange={(titleId) =>
                            onChange(`scopes.${index}.title_id`, titleId)
                        }
                    />
                )}
                {!locked && (
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
                )}
            </div>

            <div className="flex flex-col gap-2">
                <InputLabel
                    htmlFor={`bid-scope-notations-${index}`}
                    value="Information"
                    className="text-emerald-700 dark:text-emerald-300"
                />
                <RichTextEditor
                    id={`bid-scope-notations-${index}`}
                    compact
                    showPlaceholders={false}
                    value={scope?.notations ?? ''}
                    placeholder="Add details for this scope of work…"
                    error={errorMessage(
                        validationErrors,
                        `scopes.${index}.notations`,
                    )}
                    onChange={(html) =>
                        onChange(`scopes.${index}.notations`, html)
                    }
                />
                <InputError
                    message={errorMessage(
                        validationErrors,
                        `scopes.${index}.notations`,
                    )}
                />
            </div>

            <div className="flex flex-col gap-3">
                <InputLabel
                    value="Service and product"
                    className="text-emerald-700 dark:text-emerald-300"
                />
                {fields.map((productField, productIndex) => {
                    const line = scope?.products?.[productIndex];
                    const currentProductId = line?.product_id ?? '';

                    return (
                    <Card
                        key={productField.id}
                        size="sm"
                        className="overflow-visible border-rose-200 bg-rose-50/90 ring-rose-200/80 dark:border-rose-900/70 dark:bg-rose-950/40 dark:ring-rose-900/50"
                    >
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div>
                                <CardTitle className="text-rose-800 dark:text-rose-200">
                                    Line {productIndex + 1}
                                </CardTitle>
                                <CardDescription>
                                    Location, service, product, and pricing for this item.
                                </CardDescription>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                aria-label={`Remove line ${productIndex + 1}`}
                                onClick={() => remove(productIndex)}
                            >
                                <Trash2Icon className="size-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`bid-scope-location-${index}-${productIndex}`}
                                value="Location"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <TextInput
                                id={`bid-scope-location-${index}-${productIndex}`}
                                value={line?.location ?? ''}
                                className={inputClassName}
                                placeholder="Bldg 19, Room 54"
                                onChange={(event) =>
                                    onChange(
                                        `scopes.${index}.products.${productIndex}.location`,
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError
                                message={errorMessage(
                                    validationErrors,
                                    `scopes.${index}.products.${productIndex}.location`,
                                )}
                            />
                        </div>
                        <div className="grid gap-4">
                        <CreatableSelect
                            id={`bid-scope-service-${index}-${productIndex}`}
                            label="Service"
                            compact
                            value={line?.service_id ?? ''}
                            options={options.services ?? []}
                            createRoute={route('admin.services.store')}
                            catalogKey="services"
                            entityLabel="service"
                            placeholder="Assembly w/ vision glazing"
                            error={errorMessage(
                                validationErrors,
                                `scopes.${index}.products.${productIndex}.service_id`,
                            )}
                            onChange={(serviceId) =>
                                onChange(
                                    `scopes.${index}.products.${productIndex}.service_id`,
                                    serviceId,
                                )
                            }
                        />
                        <CreatableSelect
                            id={`bid-scope-product-${index}-${productIndex}`}
                            label="Product"
                            compact
                            wrapOptions
                            menuMinWidth={560}
                            value={currentProductId}
                            options={options.products}
                            createRoute={route('admin.products.catalog')}
                            catalogKey="products"
                            entityLabel="product"
                            createExtras={{ kind: 'door' }}
                            placeholder="8x8 blast door"
                            error={errorMessage(
                                validationErrors,
                                `scopes.${index}.products.${productIndex}.product_id`,
                            )}
                            onChange={(productId) => {
                                const amounts = lineAmountsForProduct(
                                    productId,
                                    options.products,
                                    projectState,
                                    line,
                                );

                                setValue(
                                    `scopes.${index}.products.${productIndex}`,
                                    {
                                        product_id: productId,
                                        service_id: line?.service_id ?? '',
                                        location: line?.location ?? '',
                                        allocated_handling:
                                            line?.allocated_handling ?? '',
                                        quantity: amounts.quantity,
                                        unit_bid: amounts.unit_bid,
                                        extended: amounts.extended,
                                    },
                                    {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                    },
                                );
                            }}
                        />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`bid-scope-quantity-${index}-${productIndex}`}
                                value="Qty"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <MaskedDecimalInput
                                id={`bid-scope-quantity-${index}-${productIndex}`}
                                value={line?.quantity ?? ''}
                                className={inputClassName}
                                placeholder="0"
                                withThousands={false}
                                onChange={(value) =>
                                    setLineAmount(productIndex, 'quantity', value)
                                }
                            />
                            <InputError
                                message={errorMessage(
                                    validationErrors,
                                    `scopes.${index}.products.${productIndex}.quantity`,
                                )}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`bid-scope-unit-${index}-${productIndex}`}
                                value="Unit value"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <MaskedDecimalInput
                                id={`bid-scope-unit-${index}-${productIndex}`}
                                prefix="$"
                                value={line?.unit_bid ?? ''}
                                className={inputClassName}
                                placeholder="0.00"
                                onChange={(value) =>
                                    setLineAmount(productIndex, 'unit_bid', value)
                                }
                            />
                            <InputError
                                message={errorMessage(
                                    validationErrors,
                                    `scopes.${index}.products.${productIndex}.unit_bid`,
                                )}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`bid-scope-allocated-${index}-${productIndex}`}
                                value="Allocated Install / Freight / Handling"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <MaskedDecimalInput
                                id={`bid-scope-allocated-${index}-${productIndex}`}
                                prefix="$"
                                value={line?.allocated_handling ?? ''}
                                className={inputClassName}
                                placeholder="0.00"
                                onChange={(value) =>
                                    setLineAmount(
                                        productIndex,
                                        'allocated_handling',
                                        value,
                                    )
                                }
                            />
                            <InputError
                                message={errorMessage(
                                    validationErrors,
                                    `scopes.${index}.products.${productIndex}.allocated_handling`,
                                )}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`bid-scope-combined-${index}-${productIndex}`}
                                value="Combined price"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <MaskedDecimalInput
                                id={`bid-scope-combined-${index}-${productIndex}`}
                                prefix="$"
                                disabled
                                value={
                                    combinedPriceAmount(
                                        line?.unit_bid ?? '',
                                        line?.allocated_handling ?? '',
                                    ) || ''
                                }
                                className={inputClassName}
                                placeholder="0.00"
                                onChange={() => undefined}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`bid-scope-extended-${index}-${productIndex}`}
                                value="Total"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <MaskedDecimalInput
                                id={`bid-scope-extended-${index}-${productIndex}`}
                                prefix="$"
                                disabled
                                value={
                                    scopeExtendedAmount(
                                        line?.quantity ?? '',
                                        line?.unit_bid ?? '',
                                        line?.allocated_handling ?? '',
                                    ) ||
                                    line?.extended ||
                                    ''
                                }
                                className={inputClassName}
                                placeholder="0.00"
                                onChange={() => undefined}
                            />
                        </div>
                        </div>
                        </CardContent>
                    </Card>
                    );
                })}
                <div className="flex">
                    <Button
                        type="button"
                        size="sm"
                        disabled={!canAddProduct}
                        onClick={() => append(blankScopeProduct())}
                        className="border-rose-600 bg-rose-600 text-white hover:bg-rose-700 hover:text-white"
                    >
                        <PlusIcon className="size-3.5" />
                        Add item
                    </Button>
                </div>
            </div>
        </div>
    );
}
