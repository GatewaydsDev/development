import CreatableSelect from '@/Components/CreatableSelect';
import Checkbox from '@/Components/Checkbox';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
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
    FieldErrors,
    FieldPath,
    PathValue,
    useFieldArray,
    useForm,
    useWatch,
} from 'react-hook-form';
import { inputToDecimal } from '@/lib/money';
import { toast } from 'sonner';
import { z } from 'zod';
import { type PageProps } from '@/types';
import BidApplicationTextSection from './BidApplicationTextSection';
import PreBidSection from './PreBidSection';
import {
    bidToFormData,
    blankRevision,
    blankScope,
    blankStage,
    scopeExtendedAmount,
    combinedPriceAmount,
    pricingFromQuotation,
    quotationImportHtml,
    scopesFromProject,
    type BidFormData,
    type BidOptions,
    type BidPayload,
    type BidQuotationOption,
    type PreBidOption,
} from '../types';

type BidFormProps = {
    action: string;
    method?: 'post' | 'patch';
    title: string;
    description: string;
    options: BidOptions;
    bid?: BidPayload;
    importQuotationUuid?: string | null;
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
    assigned_to: z.string(),
    quotation_id: z.string(),
    notes: z
        .string()
        .max(250000, 'Bid information must be 250,000 characters or less.'),
    bid_shipping_text_template_id: z.string(),
    bid_scope_text_template_id: z.string(),
    print_layout_id: z.string(),
    include_signature: z.boolean(),
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
                    description: z
                        .string()
                        .trim()
                        .max(
                            2000,
                            'Product description must be 2,000 characters or less.',
                        ),
                    quantity: optionalMoneySchema,
                    unit_bid: optionalMoneySchema,
                    extended: optionalMoneySchema,
                    allocated_handling: optionalMoneySchema,
                    combined_price: optionalMoneySchema,
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
            const hasValues =
                product.location.trim() !== '' ||
                product.quantity.trim() !== '' ||
                product.unit_bid.trim() !== '' ||
                product.allocated_handling.trim() !== '' ||
                product.combined_price.trim() !== '';

            if (product.description.trim() === '' && hasValues) {
                context.addIssue({
                    code: 'custom',
                    path: [
                        'scopes',
                        scopeIndex,
                        'products',
                        productIndex,
                        'description',
                    ],
                    message: 'Enter a product description.',
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
    importQuotationUuid = null,
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

        if (!bid && currentUserId) {
            const canAssign = (options.assignees ?? []).some(
                (assignee) => String(assignee.id) === currentUserId,
            );

            if (canAssign) {
                values.assigned_to = currentUserId;
            }
        }

        if (!values.scopes.length) {
            values.scopes = [blankScope()];
        }

        return values;
    }, [bid, currentUserId, options.assignees, options.stageTypes]);

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
        replace: replaceRevisions,
    } = useFieldArray({ control, name: 'revisions' });
    const {
        fields: stageFields,
        append: appendStage,
        remove: removeStage,
        replace: replaceStages,
    } = useFieldArray({ control, name: 'stages' });
    const {
        fields: scopeFields,
        remove: removeScope,
        replace: replaceScopes,
    } = useFieldArray({ control, name: 'scopes' });

    const isCreate = !bid;
    const [selectedPreBidId, setSelectedPreBidId] = useState('');
    const [pendingDelete, setPendingDelete] = useState<{
        type: 'revision' | 'stage' | 'scope';
        index: number;
        name?: string;
    } | null>(null);
    const [pendingImportQuotation, setPendingImportQuotation] =
        useState<BidQuotationOption | null>(null);

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

    useEffect(() => {
        if (scopeFields.length > 0) {
            return;
        }

        replaceScopes([blankScope()]);
    }, [replaceScopes, scopeFields.length]);

    const setData = <Field extends FieldPath<BidFormData>>(
        field: Field,
        value: PathValue<BidFormData, Field>,
    ) => {
        setValue(field, value, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const applyPreBid = (preBid: PreBidOption) => {
        if (
            preBid.project_id &&
            options.projects.some(
                (p) => String(p.id) === String(preBid.project_id),
            )
        ) {
            setData('project_id', String(preBid.project_id));
        }

        if (preBid.assigned_to) {
            setData('assigned_to', String(preBid.assigned_to));
        }

        if (preBid.notes !== undefined && preBid.notes !== null) {
            setData('notes', preBid.notes);
        }

        if (preBid.bid_shipping_text_template_id) {
            setData(
                'bid_shipping_text_template_id',
                String(preBid.bid_shipping_text_template_id),
            );
        }

        if (
            preBid.scope_of_work_text !== undefined &&
            preBid.scope_of_work_text !== null
        ) {
            setData('scope_of_work_text', preBid.scope_of_work_text);
        }

        if (preBid.bid_scope_text_template_id) {
            setData(
                'bid_scope_text_template_id',
                String(preBid.bid_scope_text_template_id),
            );
        }

        if (preBid.scopes && preBid.scopes.length > 0) {
            replaceScopes(preBid.scopes);
        }

        if (preBid.stages && preBid.stages.length > 0) {
            replaceStages(preBid.stages);
        }

        if (preBid.revisions && preBid.revisions.length > 0) {
            replaceRevisions(preBid.revisions);
        }

        if (preBid.pricings && preBid.pricings.length > 0) {
            setValue('pricings', preBid.pricings, {
                shouldDirty: true,
                shouldValidate: true,
            });
        }

        toast.success(`Pre-bid “${preBid.name}” applied.`);
    };

    const quotations = options.quotations ?? [];
    const [importQuotationValue, setImportQuotationValue] = useState(
        '',
    );
    const autoImported = useRef(false);

    const applyQuotation = (quotation: BidQuotationOption) => {
        if (!quotation.project_id) {
            toast.error(
                'Link this quotation to a project before importing it onto a bid.',
            );
            return false;
        }

        const current = getValues();
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

        toast.success(
            `Imported ${quotation.quotation_number}. The quotation stays saved and linked to this bid.`,
        );

        return true;
    };

    const handleImportQuotationClick = () => {
        const quotation = quotations.find(
            (item) => String(item.id) === importQuotationValue,
        );

        if (!quotation) {
            toast.error('Select a quotation to import.');
            return;
        }

        if (!quotation.project_id) {
            toast.error(
                'Link this quotation to a project before importing it onto a bid.',
            );
            return;
        }

        const current = getValues();
        const replacingProject =
            current.project_id !== '' &&
            current.project_id !== String(quotation.project_id);

        if (replacingProject || current.scope_of_work_text.trim() !== '') {
            setPendingImportQuotation(quotation);
            return;
        }

        applyQuotation(quotation);
    };

    useEffect(() => {
        if (autoImported.current || !importQuotationUuid) {
            return;
        }

        const quotation = quotations.find((item) => item.uuid === importQuotationUuid);

        if (!quotation) {
            return;
        }

        autoImported.current = true;
        setImportQuotationValue(String(quotation.id));
        applyQuotation(quotation);
    }, [importQuotationUuid, quotations]);

    const submit = handleSubmit(
        (values) => {
            const payload = {
                ...values,
                assigned_to: values.assigned_to.trim() || null,
                quotation_id: values.quotation_id.trim() || null,
                bid_shipping_text_template_id:
                    values.bid_shipping_text_template_id.trim() || null,
                bid_scope_text_template_id:
                    values.bid_scope_text_template_id.trim() || null,
                scope_of_work_text: values.scope_of_work_text,
                print_layout_id: values.print_layout_id.trim() || null,
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
                        notations: '',
                        products: scope.products
                            .filter(
                                (product) =>
                                    product.description.trim() !== '' ||
                                    product.location.trim() !== '' ||
                                    product.quantity.trim() !== '' ||
                                product.unit_bid.trim() !== '' ||
                                product.allocated_handling.trim() !== '' ||
                                product.combined_price.trim() !== '',
                            )
                            .map((product) => ({
                                ...product,
                                product_id: product.product_id.trim() || null,
                                service_id: product.service_id.trim() || null,
                                location: product.location.trim() || null,
                                description: product.description.trim() || null,
                                quantity: inputToDecimal(product.quantity) || null,
                                unit_bid: inputToDecimal(product.unit_bid) || null,
                                extended:
                                    inputToDecimal(
                                        scopeExtendedAmount(
                                            product.quantity,
                                            product.unit_bid,
                                            product.allocated_handling,
                                            combinedPriceAmount(
                                                product.unit_bid,
                                                product.allocated_handling,
                                            ),
                                        ),
                                    ) || null,
                                allocated_handling:
                                    inputToDecimal(product.allocated_handling) ||
                                    null,
                                combined_price:
                                    inputToDecimal(
                                        combinedPriceAmount(
                                            product.unit_bid,
                                            product.allocated_handling,
                                        ),
                                    ) || null,
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
    const extraFieldValues = useMemo(() => {
        const assignee = (options.assignees ?? []).find(
            (item) => String(item.id) === (data.assigned_to ?? ''),
        );
        const quotation = quotations.find(
            (item) => String(item.id) === (data.quotation_id ?? ''),
        );

        return {
            authorized_representative: assignee?.name ?? '',
            quotation_number: quotation
                ? `${quotation.quotation_number} — ${quotation.title}`
                : '',
        };
    }, [
        options.assignees,
        quotations,
        data.assigned_to,
        data.quotation_id,
    ]);
    return (
        <form onSubmit={submit} className="flex w-full min-w-0 max-w-full flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6">
            <Card className="overflow-visible shadow-sm">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    {isCreate ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                            <PreBidSection
                                options={options}
                                formData={data}
                                selectedPreBidId={selectedPreBidId}
                                onSelectPreBidId={setSelectedPreBidId}
                                onApplyPreBid={applyPreBid}
                            />
                        </div>
                    ) : null}

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
                                            options.services,
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
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="bid-assigned-to"
                                    value="Assigned to / Authorized representative"
                                    className="text-emerald-700 dark:text-emerald-300"
                                />
                                <select
                                    id="bid-assigned-to"
                                    value={data.assigned_to ?? ''}
                                    onChange={(event) =>
                                        setData(
                                            'assigned_to',
                                            event.target.value,
                                        )
                                    }
                                    className={`${inputClassName} rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-2`}
                                >
                                    <option value="">Unassigned</option>
                                    {(options.assignees ?? []).map(
                                        (assignee) => (
                                            <option
                                                key={assignee.id}
                                                value={assignee.id}
                                            >
                                                {assignee.name}
                                            </option>
                                        ),
                                    )}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    This name appears on the printed bid
                                    signature.
                                </p>
                                <InputError
                                    message={errorMessage(
                                        validationErrors,
                                        'assigned_to',
                                    )}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="bid-include-signature" className="flex items-center gap-2 text-sm font-medium">
                                <Checkbox
                                    id="bid-include-signature"
                                    checked={data.include_signature ?? true}
                                    onChange={(event) => setData('include_signature', event.target.checked)}
                                    aria-describedby="bid-include-signature-help"
                                    aria-invalid={Boolean(errorMessage(validationErrors, 'include_signature'))}
                                />
                                Include signature section
                            </label>
                            <p id="bid-include-signature-help" className="text-xs text-muted-foreground">
                                Include the authorization and signature fields in the printed bid, PDF, and Word document.
                            </p>
                            <InputError message={errorMessage(validationErrors, 'include_signature')} />
                        </div>
                        {selectedProject ? (
                            <p className="text-sm text-muted-foreground">
                                Contractor:{' '}
                                {selectedProject.contractor_name ||
                                    'Not assigned on this project'}
                            </p>
                        ) : null}
                        {quotations.length > 0 ? (
                            <div className="grid min-w-0 w-full gap-5 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-end">
                                <CreatableSelect
                                    id="bid-import-quotation"
                                    label="Import quotation"
                                    value={importQuotationValue}
                                    options={quotations}
                                    allowCreate={false}
                                    placeholder="Type to find a saved quotation"
                                    hint="The quotation stays in Quotations. Import copies the project and line items onto this bid."
                                    wrapOptions
                                    onChange={(quotationId) =>
                                        setImportQuotationValue(quotationId)
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11 w-full lg:w-auto"
                                    onClick={handleImportQuotationClick}
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
                                    className="grid min-w-0 gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_auto]"
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
                                                setPendingDelete({
                                                    type: 'revision',
                                                    index,
                                                    name: revision?.number
                                                        ? `Revision ${revision.number}`
                                                        : undefined,
                                                })
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
                                className="grid min-w-0 gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70 xl:grid-cols-[minmax(0,1.3fr)_10rem_minmax(0,1fr)_auto]"
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
                                        onClick={() => {
                                            const stageName =
                                                options.stageTypes.find(
                                                    (type) =>
                                                        String(type.id) ===
                                                        data.stages?.[index]
                                                            ?.stage_type_id,
                                                )?.name;

                                            setPendingDelete({
                                                type: 'stage',
                                                index,
                                                name: stageName,
                                            });
                                        }}
                                    >
                                        <Trash2Icon className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <BidApplicationTextSection
                purpose="shipping"
                options={options}
                project={selectedProject}
                scopes={data.scopes ?? []}
                extraFieldValues={extraFieldValues}
                printLayoutId={data.print_layout_id ?? ''}
                onPrintLayoutIdChange={(id) => setData('print_layout_id', id)}
                value={data.notes ?? ''}
                templateId={data.bid_shipping_text_template_id ?? ''}
                error={errorMessage(validationErrors, 'notes')}
                onChange={(html) => setData('notes', html)}
                onTemplateIdChange={(id) =>
                    setData('bid_shipping_text_template_id', id)
                }
                autoSave={{
                    persistKey: bid ? `bid:${bid.id}` : null,
                    url: bid ? route('admin.bids.autosave', bid.uuid) : null,
                    field: 'notes',
                    unavailableMessage:
                        'AutoSave on. Add the bid to start saving this text.',
                }}
            />

            <FormActionFab
                cancelHref={route('admin.bids.index')}
                saveLabel={bid ? 'Save bid' : 'Add bid'}
                disabled={isSubmitting}
                printHref={
                    bid
                        ? route('admin.bids.print', bid.uuid)
                        : undefined
                }
                printLabel={bid ? 'Print bid' : 'Print'}
                showPrint={true}
            />

            {/* Delete confirmation dialog */}
            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDelete(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingDelete?.type === 'revision'
                                ? 'Remove revision?'
                                : pendingDelete?.type === 'stage'
                                  ? 'Remove stage?'
                                  : pendingDelete?.type === 'scope'
                                    ? 'Remove scope?'
                                    : 'Remove item?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDelete?.type === 'revision'
                                ? `Are you sure you want to remove ${pendingDelete.name ? pendingDelete.name : `revision ${pendingDelete.index + 1}`}? This action cannot be undone.`
                                : pendingDelete?.type === 'stage'
                                  ? `Are you sure you want to remove ${pendingDelete.name ? `the “${pendingDelete.name}” stage` : `stage ${pendingDelete.index + 1}`}? This action cannot be undone.`
                                  : pendingDelete?.type === 'scope'
                                    ? `Are you sure you want to remove ${pendingDelete.name ? `the “${pendingDelete.name}” scope` : `scope ${pendingDelete.index + 1}`}? All line items within this scope will also be removed.`
                                    : 'Are you sure you want to remove this item? This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (pendingDelete?.type === 'revision') {
                                    removeRevision(pendingDelete.index);
                                } else if (pendingDelete?.type === 'stage') {
                                    removeStage(pendingDelete.index);
                                } else if (pendingDelete?.type === 'scope') {
                                    removeScope(pendingDelete.index);
                                }
                                setPendingDelete(null);
                            }}
                        >
                            {pendingDelete?.type === 'revision'
                                ? 'Remove revision'
                                : pendingDelete?.type === 'stage'
                                  ? 'Remove stage'
                                  : pendingDelete?.type === 'scope'
                                    ? 'Remove scope'
                                    : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Import quotation confirmation */}
            <AlertDialog
                open={pendingImportQuotation !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingImportQuotation(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Import this quotation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Import “{pendingImportQuotation?.quotation_number}” onto the bid form? The quotation stays saved. Project and quoted items on this form will be replaced.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">
                            Keep current bid
                        </AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            onClick={() => {
                                if (pendingImportQuotation) {
                                    applyQuotation(pendingImportQuotation);
                                    setPendingImportQuotation(null);
                                }
                            }}
                        >
                            Import quotation
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </form>
    );
}
