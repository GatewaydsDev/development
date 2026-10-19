import CreatableSelect from '@/Components/CreatableSelect';
import DateMaskInput from '@/Components/DateMaskInput';
import QuickContractorContactDialog from '@/Components/QuickContractorContactDialog';
import QuickProjectDialog from '@/Components/QuickProjectDialog';
import FormActionFab from '@/Components/FormActionFab';
import ProjectPricePicker from '@/Components/ProjectPricePicker';
import QuotationTakeoffOpenings from '@/Pages/Admin/Quotations/Partials/QuotationTakeoffOpenings';
import RevisionReviewEmail from '@/Pages/Admin/Quotations/Partials/RevisionReviewEmail';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import { flushPendingTextAutoSaves } from '@/Components/TextAutoSave';
import TextInput from '@/Components/TextInput';
import DocumentPrintLayoutEditor from '@/Components/DocumentPrintLayoutEditor';
import { quotationComponentsHtml } from '@/Pages/Admin/Bids/layoutSections';
import { saveDocumentDraft } from '@/lib/saveDocumentDraft';
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
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import { router, usePage } from '@inertiajs/react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import {
    type DragEvent,
    FormEventHandler,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    FieldErrors,
    useFieldArray,
    useForm,
    useWatch,
} from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { type PageProps } from '@/types';
import {
    blankRevision,
    quotationDocumentHref,
    quotationInsertValues,
    quotationToFormData,
    QUOTATION_INSERT_FIELDS,
    QUOTATION_LAYOUT_FIELD_KEYS,
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

function priceAmount(
    prices: Array<{ id: number; amount: string | number }>,
    ids: string[],
): string {
    if (ids.length === 0) {
        return '';
    }

    const total = prices
        .filter((price) => ids.includes(String(price.id)))
        .reduce((sum, price) => sum + (Number(price.amount) || 0), 0);

    return total.toFixed(2);
}

const schema = z.object({
    quotation_number: z.string(),
    project_id: z.string(),
    contractor_id: z.string(),
    contact_ids: z.array(z.string()),
    title_id: z.string(),
    title: z.string().trim().min(1, 'Select or add a quotation title.').max(255),
    status: z.string().trim().min(1, 'Select a status.'),
    quoted_at: z.string(),
    valid_until: z.string(),
    project_amount: z.string(),
    project_price_ids: z.array(z.string()),
    notes: z.string().max(250000),
    print_layout_id: z.string(),
    print_layout_version: z.string(),
    layout_header: z.string().max(250000),
    layout_elements: z.object({
        elements: z.array(z.any()).max(1000),
        header_height: z.number().min(60).max(4000).optional(),
        header_background: z.string().max(32).optional(),
        text_case: z.string().max(20).optional(),
    }),
    proposal_title: z
        .string()
        .trim()
        .max(255, 'The title must be 255 characters or less.'),
    pricing_conditions: z.string().max(250000),
    pricing_basis: z.string().max(250000),
    include_authorization: z.boolean(),
    line_items: z.array(
        z.object({
            description: z.string().trim().max(255),
            quantity: z.string(),
            size: z.string().max(255),
            unit_price: z.string(),
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
            responsible_user_id: z.string(),
            status_id: z.string(),
            title_id: z.string(),
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

    values.line_items.forEach((item, index) => {
        if (
            lineItemIsBaseBid(item) &&
            item.description.trim() === ''
        ) {
            context.addIssue({
                code: 'custom',
                path: ['line_items', index, 'description'],
                message: 'Enter a description.',
            });
        }
    });

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

function dragHasPicture(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer) {
        return false;
    }

    const types = Array.from(dataTransfer.types);

    return (
        types.includes('Files') ||
        types.includes('application/x-moz-file') ||
        dataTransfer.files.length > 0
    );
}

function blockPictureDropSubmit(event: DragEvent<HTMLFormElement>) {
    if (!dragHasPicture(event.dataTransfer)) {
        return;
    }

    event.preventDefault();
}

function lineItemIsBaseBid(item: {
    quantity: string;
    size: string;
    unit_price: string;
}) {
    return (
        item.quantity.trim() !== '' &&
        item.size.trim() !== '' &&
        item.unit_price.trim() !== ''
    );
}

const inputClassName =
    'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';

const sectionClassName = 'scroll-mt-44';

const QUOTATION_SECTIONS = [
    { id: 'quotation-details', label: 'Details' },
    { id: 'quotation-customer', label: 'Customer' },
    { id: 'quotation-pricing', label: 'Pricing' },
    { id: 'quotation-openings', label: 'Openings' },
    { id: 'quotation-layout', label: 'Layout' },
    { id: 'quotation-revisions', label: 'Revisions' },
    { id: 'quotation-authorization', label: 'Authorization' },
] as const;

function QuotationSectionNav({
    activeId,
    navRef,
}: {
    activeId: string;
    navRef: { current: HTMLDivElement | null };
}) {
    return (
        <div className="sticky top-[7.25rem] z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <nav
                aria-label="Quotation sections"
                className="rounded-xl border border-border bg-card/95 p-1.5 shadow-sm backdrop-blur"
            >
                <div
                    ref={(node) => {
                        navRef.current = node;
                    }}
                    className="flex gap-1 overflow-x-auto"
                >
                    {QUOTATION_SECTIONS.map((section, index) => {
                        const active = activeId === section.id;

                        return (
                            <a
                                key={section.id}
                                href={`#${section.id}`}
                                data-section={section.id}
                                aria-current={active ? 'location' : undefined}
                                className={cn(
                                    'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                                    active
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-foreground hover:bg-muted',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                                        active
                                            ? 'bg-white/20 text-white'
                                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
                                    )}
                                >
                                    {index + 1}
                                </span>
                                {section.label}
                            </a>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}

function isoAddDays(iso: string, days: number): string {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : new Date();
    date.setDate(date.getDate() + days);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
}

function validityPeriodFor(
    quotedAt: string,
    validUntil: string,
): '' | '30' | '60' | '90' {
    if (!validUntil) {
        return '';
    }

    for (const days of [30, 60, 90] as const) {
        if (isoAddDays(quotedAt, days) === validUntil) {
            return String(days) as '30' | '60' | '90';
        }
    }

    return '';
}

export default function QuotationForm({
    action,
    method = 'post',
    title,
    description,
    options,
    quotation,
}: QuotationFormProps) {
    const { auth } = usePage<PageProps>().props;
    const [savedQuotation, setSavedQuotation] = useState(quotation);
    const currentUserId = auth.user?.id ? String(auth.user.id) : '';
    const revisionResponsibleOptions = options.revisionResponsibleUsers ?? [];
    const revisionResponsibleNames = useMemo(
        () =>
            new Map(
                (savedQuotation?.revisions ?? [])
                    .filter((revision) => revision.responsible_user?.name)
                    .map((revision) => [
                        String(revision.responsible_user_id),
                        revision.responsible_user?.name ?? '',
                    ]),
            ),
        [savedQuotation],
    );
    const defaultValues = useMemo(
        () => quotationToFormData(quotation, options),
        [quotation, options],
    );
    const {
        handleSubmit,
        setValue,
        setError,
        clearErrors,
        control,
        getValues,
        reset,
        formState: { errors: validationErrors, isSubmitting },
    } = useForm<QuotationFormData>({
        resolver: zodResolver(schema),
        defaultValues,
    });
    const {
        fields: revisionFields,
        append: appendRevision,
        remove: removeRevision,
    } = useFieldArray({
        control,
        name: 'revisions',
    });
    const [pendingDeleteRevision, setPendingDeleteRevision] = useState<{
        index: number;
        name?: string;
    } | null>(null);
    const [partyRole, setPartyRole] = useState<'contractor' | 'owner'>(() => {
        const selected = (options.contractors ?? []).find(
            (contractor) =>
                String(contractor.id) === defaultValues.contractor_id,
        );

        return selected?.role === 'owner' ? 'owner' : 'contractor';
    });
    const [newPartyName, setNewPartyName] = useState('');
    const [partyError, setPartyError] = useState('');
    const [addingParty, setAddingParty] = useState(false);
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<string>(
        QUOTATION_SECTIONS[0].id,
    );
    const sectionNavRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const nodes = QUOTATION_SECTIONS.map((section) =>
            document.getElementById(section.id),
        ).filter((node): node is HTMLElement => node instanceof HTMLElement);

        if (nodes.length === 0) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (left, right) =>
                            right.intersectionRatio - left.intersectionRatio,
                    );
                const id = visible[0]?.target.id;

                if (id) {
                    setActiveSection(id);
                }
            },
            {
                rootMargin: '-25% 0px -55% 0px',
                threshold: [0.05, 0.2, 0.5],
            },
        );

        nodes.forEach((node) => observer.observe(node));

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const nav = sectionNavRef.current;
        const current = nav?.querySelector<HTMLElement>(
            `[data-section="${activeSection}"]`,
        );

        if (!nav || !current) {
            return;
        }

        const left =
            current.offsetLeft - nav.clientWidth / 2 + current.clientWidth / 2;

        nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }, [activeSection]);

    const canCreateProjects = Boolean(auth.can?.createProjects);
    const canAddProjectPrice = Boolean(auth.can?.viewSensitiveProjectFields);
    const data = useWatch({
        control,
        defaultValue: defaultValues,
    }) as QuotationFormData;
    const quotedAtRef = useRef(data.quoted_at);

    useEffect(() => {
        const previous = quotedAtRef.current ?? '';
        const current = data.quoted_at ?? '';

        if (previous === current) {
            return;
        }

        quotedAtRef.current = current;
        const matched = validityPeriodFor(previous, getValues('valid_until') ?? '');

        if (matched) {
            setValue('valid_until', isoAddDays(current, Number(matched)), {
                shouldDirty: true,
            });
        }
    }, [data.quoted_at, getValues, setValue]);
    const savedBaseline = useRef(JSON.stringify(defaultValues));
    const hasUnsavedChanges = JSON.stringify(data) !== savedBaseline.current;

    const allContractors = options.contractors ?? [];
    const selectedContractor = allContractors.find(
        (contractor) => String(contractor.id) === data.contractor_id,
    );
    const contractorOptions = allContractors.filter(
        (contractor) =>
            (contractor.role === 'owner' ? 'owner' : 'contractor') ===
            partyRole,
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
    const layoutLiterals = {
        company_name: options.company?.name ?? '',
        company_speciality: options.company?.speciality ?? '',
        company_legal_name: options.company?.legal_name ?? '',
        company_address: options.company?.address ?? '',
        company_phone: options.company?.phone ?? '',
        company_email: options.company?.email ?? '',
        company_contact_phone: options.company?.contact_phone ?? '',
        company_website: options.company?.website ?? '',
        company_contact_url: options.company?.contact_url ?? '',
    };

    const quotationPayload = (values: QuotationFormData) => ({
        ...values,
        project_amount: values.project_amount,
        project_price_ids: values.project_price_ids,
        print_layout_id: values.print_layout_id || null,
        print_layout_version: values.print_layout_version || null,
        layout_header: values.layout_elements.elements.length
            ? quotationComponentsHtml(
                  values.layout_elements,
                  layoutLiterals,
                  QUOTATION_LAYOUT_FIELD_KEYS,
              ) || values.layout_header
            : values.layout_header,
        revisions: values.revisions.filter(
            (revision) => revision.number.trim() !== '',
        ),
        line_items: values.line_items.filter(
            (item) => item.description.trim() !== '' || lineItemIsBaseBid(item),
        ),
        field_tables: [],
    });
    const applyServerErrors = (serverErrors: Record<string, string>) => {
        Object.entries(serverErrors).forEach(([field, message]) => {
            setError(field as keyof QuotationFormData, {
                type: 'server',
                message,
            });
        });
    };
    const ensureParty = (
        values: QuotationFormData,
    ): Promise<QuotationFormData | null> => {
        if (values.contractor_id.trim()) return Promise.resolve(values);
        const ownerName = newPartyName.trim();
        if (partyRole !== 'owner' || ownerName === '') {
            setError('contractor_id', {
                type: 'manual',
                message:
                    partyRole === 'owner'
                        ? 'Enter the owner name.'
                        : 'Select a contractor.',
            });
            return Promise.resolve(null);
        }
        setAddingParty(true);
        setPartyError('');
        return new Promise((resolve) => {
            router.post(
                route('admin.contractors.store'),
                { name: ownerName, role: 'owner' },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: (page) => {
                        const contractors =
                            (page.props.options as QuotationOptions)
                                ?.contractors ?? [];
                        const created = contractors.find(
                            (contractor) =>
                                contractor.name.toLowerCase() ===
                                ownerName.toLowerCase(),
                        );
                        if (!created) {
                            setPartyError(
                                'The owner was saved, but it could not be selected. Choose that owner and save the quotation again.',
                            );
                            resolve(null);
                            return;
                        }
                        const contactIds = defaultContactIds(created);
                        setValue('contractor_id', String(created.id));
                        setValue('contact_ids', contactIds);
                        setNewPartyName('');
                        resolve({
                            ...values,
                            contractor_id: String(created.id),
                            contact_ids: contactIds,
                        });
                    },
                    onError: (errors) => {
                        setPartyError(
                            String(
                                errors.name ||
                                    'That owner could not be added.',
                            ),
                        );
                        resolve(null);
                    },
                    onCancel: () => resolve(null),
                    onFinish: () => {
                        setAddingParty(false);
                        resolve(null);
                    },
                },
            );
        });
    };
    const saveCurrent = () =>
        new Promise<boolean>((resolve) => {
            void handleSubmit(
                async () => {
                    try {
                        const values = await ensureParty(getValues());
                        if (!values) {
                            toast.error(
                                'Select or add the contractor/owner before saving and updating the layout.',
                            );
                            resolve(false);
                            return;
                        }
                        if (!(await flushPendingTextAutoSaves())) {
                            toast.error(
                                'The quotation text could not be saved. Try again before updating the layout.',
                            );
                            resolve(false);
                            return;
                        }
                        const result =
                            await saveDocumentDraft<QuotationPayload>(
                                savedQuotation
                                    ? route(
                                          'admin.quotations.update',
                                          savedQuotation.uuid,
                                      )
                                    : action,
                                savedQuotation ? 'patch' : method,
                                quotationPayload(values),
                                applyServerErrors,
                            );
                        setSavedQuotation(result);
                        const savedValues = {
                            ...values,
                            quotation_number: result.quotation_number,
                            revisions: quotationToFormData(result).revisions,
                        };
                        savedBaseline.current = JSON.stringify(savedValues);
                        reset(savedValues);
                        toast.success(
                            'Current quotation changes saved. The new layout will remain a draft until you save again.',
                        );
                        resolve(true);
                    } catch (error) {
                        toast.error(
                            error instanceof Error
                                ? error.message
                                : 'The quotation could not be saved. Your edits are unchanged.',
                        );
                        resolve(false);
                    }
                },
                () => {
                    toast.error(
                        'Check the highlighted quotation fields before saving and updating the layout.',
                    );
                    resolve(false);
                },
            )();
        });
    const postQuotation = async (values: QuotationFormData) => {
        if (!(await flushPendingTextAutoSaves())) {
            toast.error(
                'The quotation text could not be saved. Try again before saving the quotation.',
            );
            return;
        }
        router[savedQuotation ? 'patch' : method](
            savedQuotation
                ? route('admin.quotations.update', savedQuotation.uuid)
                : action,
            quotationPayload(values),
            {
                onError: (serverErrors: Record<string, string>) => {
                    Object.entries(serverErrors).forEach(([field, message]) => {
                        setError(field as keyof QuotationFormData, {
                            type: 'server',
                            message: String(message),
                        });
                    });
                },
            },
        );
    };

    const submit: FormEventHandler = (event) => {
        void handleSubmit(
            async (values) => {
                clearErrors('contractor_id');
                const withParty = await ensureParty(values);
                if (!withParty) {
                    toast.error(
                        'Select or add the contractor/owner before saving the quotation.',
                    );
                    return;
                }
                await postQuotation(withParty);
            },
            () => {
                toast.error(
                    'Check the highlighted quotation fields before saving.',
                );
            },
        )(event);
    };

    const printQuotation = async () => {
        if (!savedQuotation) {
            return;
        }

        const printWindow = window.open('about:blank', '_blank');

        if (!printWindow) {
            toast.error('Allow pop-ups to open the quotation print preview.');

            return;
        }

        printWindow.opener = null;

        if (!(await flushPendingTextAutoSaves())) {
            printWindow.close();
            toast.error(
                'The quotation text could not be saved. Please try again before printing.',
            );

            return;
        }

        printWindow.location.href = quotationDocumentHref(
            'admin.quotations.print',
            savedQuotation.uuid,
            data.proposal_title,
        );
    };

    return (
        <form
            onSubmit={submit}
            onDragEnter={blockPictureDropSubmit}
            onDragOver={blockPictureDropSubmit}
            onDrop={blockPictureDropSubmit}
            className="flex w-full min-w-0 max-w-none flex-col gap-6 pb-28 lg:pb-8"
        >
            <FormActionFab
                cancelHref={route('admin.quotations.index')}
                saveLabel={savedQuotation ? 'Save quotation' : 'Add quotation'}
                disabled={isSubmitting}
                printHref={
                    savedQuotation
                        ? quotationDocumentHref(
                              'admin.quotations.print',
                              savedQuotation.uuid,
                              data.proposal_title,
                          )
                        : undefined
                }
                onPrint={savedQuotation ? printQuotation : undefined}
                printLabel={savedQuotation ? 'Print quotation' : 'Print'}
                showPrint={true}
            />

            <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-foreground">
                    {title}
                </h3>
                <p className="max-w-3xl text-sm text-muted-foreground">
                    {description}
                </p>
            </div>

            <QuotationSectionNav
                activeId={activeSection}
                navRef={sectionNavRef}
            />

            <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card id="quotation-details" className={`${sectionClassName} shadow-sm`}>
                <CardHeader>
                    <CardTitle className="text-base font-semibold text-foreground">
                        Details
                    </CardTitle>
                    <CardDescription>
                        Project, title, status, and how long this quotation
                        stays valid.
                    </CardDescription>
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
                    <div className="flex flex-col gap-2 sm:col-span-2">
                        <div className="flex items-center justify-between gap-2">
                            <InputLabel
                                htmlFor="project_id"
                                value="Project"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            {canCreateProjects ? (
                                <Button
                                    type="button"
                                    className="h-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                                    onClick={() => setProjectDialogOpen(true)}
                                >
                                    <PlusIcon className="size-3.5" />
                                    New project
                                </Button>
                            ) : null}
                        </div>
                        <select
                            id="project_id"
                            value={data.project_id}
                            onChange={(event) => {
                                const projectId = event.target.value;
                                setValue('project_id', projectId);
                                const prices =
                                    options.projects.find(
                                        (project) =>
                                            String(project.id) === projectId,
                                    )?.prices ?? [];
                                const kept = data.project_price_ids.filter(
                                    (id) =>
                                        prices.some(
                                            (price) => String(price.id) === id,
                                        ),
                                );

                                setValue('project_price_ids', kept);
                                setValue(
                                    'project_amount',
                                    kept.length === 0
                                        ? ''
                                        : priceAmount(prices, kept),
                                );
                            }}
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

                    <div className="flex min-w-0 flex-col gap-2">
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
                    <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
                            <InputLabel
                                htmlFor="valid_until_period"
                                value="Valid until"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <div className="grid gap-2 sm:grid-cols-2">
                            <select
                                id="valid_until_period"
                                aria-label="Valid until period"
                                value={validityPeriodFor(
                                    data.quoted_at ?? '',
                                    data.valid_until ?? '',
                                )}
                                className={inputClassName}
                                onChange={(event) => {
                                    const next = event.target.value;

                                    if (
                                        next === '30' ||
                                        next === '60' ||
                                        next === '90'
                                    ) {
                                        setValue(
                                            'valid_until',
                                            isoAddDays(
                                                data.quoted_at ?? '',
                                                Number(next),
                                            ),
                                            { shouldDirty: true },
                                        );

                                        return;
                                    }

                                    setValue('valid_until', '', {
                                        shouldDirty: true,
                                    });
                                }}
                            >
                                <option value="">MM/DD/YYYY</option>
                                <option value="30">30 days</option>
                                <option value="60">60 days</option>
                                <option value="90">90 days</option>
                            </select>
                            <DateMaskInput
                                id="valid_until"
                                value={data.valid_until ?? ''}
                                aria-label="Valid until date"
                                className={inputClassName}
                                onValueChange={(value) =>
                                    setValue('valid_until', value, {
                                        shouldDirty: true,
                                    })
                                }
                            />
                            </div>
                            <InputError
                                message={errorMessage(
                                    validationErrors,
                                    'valid_until',
                                )}
                            />
                        </div>
                </CardContent>
            </Card>

            <Card id="quotation-customer" className={`${sectionClassName} shadow-sm`}>
                <CardHeader>
                    <CardTitle className="text-base font-semibold text-foreground">
                        Customer
                    </CardTitle>
                    <CardDescription>
                        Choose a contractor or the project owner, then check
                        the contacts that should appear on the quotation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 sm:col-span-2">
            <InputLabel
                value="Quoted for"
                className="text-emerald-700 dark:text-emerald-300"
            />
            <div className="grid grid-cols-2 gap-2">
                <label
                    className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm',
                        partyRole === 'contractor'
                            ? 'border-emerald-500 bg-emerald-50 font-medium text-foreground dark:border-emerald-700 dark:bg-emerald-950/40'
                            : 'border-border bg-background text-foreground',
                    )}
                >
                    <input
                        type="radio"
                        name="quotation-party-role"
                        checked={partyRole === 'contractor'}
                        onChange={() => {
                            setPartyRole('contractor');
                            setPartyError('');
                            clearErrors('contractor_id');
                            if (
                                selectedContractor?.role === 'owner'
                            ) {
                                setValue('contractor_id', '');
                                setValue('contact_ids', []);
                            }
                        }}
                    />
                    Contractor
                </label>
                <label
                    className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm',
                        partyRole === 'owner'
                            ? 'border-emerald-500 bg-emerald-50 font-medium text-foreground dark:border-emerald-700 dark:bg-emerald-950/40'
                            : 'border-border bg-background text-foreground',
                    )}
                >
                    <input
                        type="radio"
                        name="quotation-party-role"
                        checked={partyRole === 'owner'}
                        onChange={() => {
                            setPartyRole('owner');
                            setPartyError('');
                            clearErrors('contractor_id');
                            if (
                                selectedContractor &&
                                selectedContractor.role !== 'owner'
                            ) {
                                setValue('contractor_id', '');
                                setValue('contact_ids', []);
                            }
                        }}
                    />
                    Owner of the project
                </label>
            </div>
            <InputLabel
                htmlFor="contractor_id"
                value={
                    partyRole === 'owner'
                        ? 'Owner name'
                        : 'Contractor name'
                }
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
                    clearErrors('contractor_id');
                    setValue('contractor_id', contractorId);
                    setValue(
                        'contact_ids',
                        defaultContactIds(contractor),
                    );
                }}
                className={`${inputClassName} min-w-0 max-w-full`}
            >
                <option value="">
                    {partyRole === 'owner'
                        ? 'Select an owner'
                        : 'Select a contractor'}
                </option>
                {contractorOptions.map((contractor) => (
                    <option
                        key={contractor.id}
                        value={contractor.id}
                    >
                        {contractor.name}
                    </option>
                ))}
            </select>
            <div className="flex flex-col gap-2 sm:flex-row">
                <TextInput
                    value={newPartyName}
                    placeholder={
                        partyRole === 'owner'
                            ? 'New owner name'
                            : 'New contractor name'
                    }
                    className={inputClassName}
                    onChange={(event) => {
                        setNewPartyName(event.target.value);
                        setPartyError('');
                    }}
                />
                <Button
                    type="button"
                    className="h-11 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={
                        addingParty || newPartyName.trim() === ''
                    }
                    onClick={() => {
                        const name = newPartyName.trim();

                        if (name === '') {
                            return;
                        }

                        setAddingParty(true);
                        setPartyError('');
                        router.post(
                            route('admin.contractors.store'),
                            { name, role: partyRole },
                            {
                                preserveScroll: true,
                                preserveState: true,
                                onSuccess: (page) => {
                                    const contractors =
                                        (
                                            page.props
                                                .options as QuotationOptions
                                        )?.contractors ?? [];
                                    const created =
                                        contractors.find(
                                            (contractor) =>
                                                contractor.name.toLowerCase() ===
                                                    name.toLowerCase() &&
                                                (contractor.role ===
                                                'owner'
                                                    ? 'owner'
                                                    : 'contractor') ===
                                                    partyRole,
                                        );

                                    if (!created) {
                                        return;
                                    }

                                    setValue(
                                        'contractor_id',
                                        String(created.id),
                                        { shouldValidate: true },
                                    );
                                    setValue(
                                        'contact_ids',
                                        defaultContactIds(created),
                                    );
                                    setNewPartyName('');
                                },
                                onError: (errors) => {
                                    setPartyError(
                                        String(
                                            errors.name ||
                                                'That name could not be added.',
                                        ),
                                    );
                                },
                                onFinish: () =>
                                    setAddingParty(false),
                            },
                        );
                    }}
                >
                    {addingParty
                        ? 'Adding...'
                        : partyRole === 'owner'
                          ? 'Add owner'
                          : 'Add contractor'}
                </Button>
            </div>
            <InputError
                message={
                    partyError ||
                    errorMessage(
                        validationErrors,
                        'contractor_id',
                    )
                }
            />
        </div>

        <div className="flex flex-col gap-2 min-w-0 sm:col-span-2">
            <InputLabel
                value="Contacts on this quotation"
                className="text-emerald-700 dark:text-emerald-300"
            />
            <p className="text-sm text-muted-foreground">
                Every contact for this{' '}
                {partyRole === 'owner' ? 'owner' : 'contractor'} is
                listed. Check the ones that should appear on the
                quotation.
            </p>
            {data.contractor_id ? (
                <div>
                    <Button
                        type="button"
                        className="h-9 bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => setContactDialogOpen(true)}
                    >
                        <PlusIcon className="size-3.5" />
                        Add contact
                    </Button>
                </div>
            ) : null}
            {!data.contractor_id ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    Select a{' '}
                    {partyRole === 'owner'
                        ? 'owner'
                        : 'contractor'}{' '}
                    to see their contacts.
                </p>
            ) : contractorContacts.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    This{' '}
                    {partyRole === 'owner'
                        ? 'owner'
                        : 'contractor'}{' '}
                    has no contacts yet. Add one here.
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
                </CardContent>
            </Card>
            </div>

            <section id="quotation-pricing" className={`${sectionClassName} flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5`}>
                <div>
                    <h3 className="text-base font-semibold text-foreground">
                        Project price
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Check every price that belongs on this quotation, such
                        as one price for 2 windows and another for 3 windows.
                        The amount is the total of the prices you check.
                    </p>
                </div>
                {data.project_id ? (
                    <ProjectPricePicker
                        prices={
                            options.projects.find(
                                (project) =>
                                    String(project.id) === data.project_id,
                            )?.prices ?? []
                        }
                        value={data.project_price_ids}
                        onChange={(ids) => {
                            const prices =
                                options.projects.find(
                                    (project) =>
                                        String(project.id) === data.project_id,
                                )?.prices ?? [];

                            setValue('project_price_ids', ids, {
                                shouldDirty: true,
                            });
                            setValue('project_amount', priceAmount(prices, ids), {
                                shouldDirty: true,
                                shouldValidate: true,
                            });
                        }}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Select a project to use the prices set up on it.
                    </p>
                )}
                <InputError
                    message={errorMessage(
                        validationErrors,
                        'project_price_ids',
                    )}
                />
                <div className="flex max-w-sm flex-col gap-2">
                    <InputLabel
                        htmlFor="project_amount"
                        value="Amount for this quotation"
                    />
                    <MaskedDecimalInput
                        id="project_amount"
                        value={data.project_amount}
                        prefix="$"
                        placeholder="0.00"
                        className={inputClassName}
                        onChange={(value) =>
                            setValue('project_amount', value, {
                                shouldDirty: true,
                                shouldValidate: true,
                            })
                        }
                    />
                    <InputError
                        message={errorMessage(
                            validationErrors,
                            'project_amount',
                        )}
                    />
                </div>
            </section>

            <QuotationTakeoffOpenings
                key={data.project_id || 'no-project'}
                projectSelected={Boolean(data.project_id)}
                takeoffs={options.projects.find((project) => String(project.id) === data.project_id)?.takeoffs ?? []}
                lineItems={data.line_items}
                onChange={(items) => setValue('line_items', items, { shouldDirty: true })}
            />

            <section
                id="quotation-layout"
                aria-labelledby="quotation-layout-header-title"
                className={`${sectionClassName} flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5`}
            >
                <div>
                    <h3
                        id="quotation-layout-header-title"
                        className="text-base font-semibold"
                    >
                        Quotation layout header
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Choose a print layout. Switching to another layout asks
                        you to confirm before the page is replaced.
                    </p>
                </div>
                <DocumentPrintLayoutEditor
                    componentCanvas
                    document="quotation"
                    catalog={{
                        printLayouts: options.printLayouts ?? [],
                        assignedPrintLayoutId: options.assignedPrintLayoutId,
                    }}
                    layoutId={data.print_layout_id}
                    version={data.print_layout_version}
                    design={data.layout_elements}
                    onDesignChange={(design, html) => {
                        setValue('layout_elements', design, { shouldDirty: true });
                        setValue('layout_header', html, { shouldDirty: true });
                    }}
                    onLayoutChange={(id, version) => {
                        setValue('print_layout_id', id, { shouldDirty: true });
                        setValue('print_layout_version', version, {
                            shouldDirty: true,
                        });
                    }}
                    literals={layoutLiterals}
                    fieldKeys={QUOTATION_LAYOUT_FIELD_KEYS}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onSaveCurrent={saveCurrent}
                    id="quotation-layout-header"
                    value={data.layout_header}
                    onChange={(html) =>
                        setValue('layout_header', html, { shouldDirty: true })
                    }
                    error={errorMessage(validationErrors, 'layout_header')}
                    placeholder="Load a layout or write the quotation header…"
                    placeholderCatalog="provided"
                    placeholderFields={[...QUOTATION_INSERT_FIELDS]}
                    placeholderValues={{
                        ...insertValues,
                        authorized_representative: auth.user?.name ?? '',
                    }}
                />
            </section>

            <section
                id="quotation-revisions"
                className={`${sectionClassName} flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5`}
            >
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
                        className="w-full shrink-0 bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
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
                        No revisions added yet. Use Add revision to set its
                        title, status, and responsible user.
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {revisionFields.map((field, index) => {
                            const revision = data.revisions?.[index];

                            return (
                                <div
                                    key={field.id}
                                    className="grid min-w-0 gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70 sm:grid-cols-2 xl:grid-cols-4"
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
                                    <CreatableSelect
                                        id={`quotation-revision-title-${index}`}
                                        label="Title"
                                        value={revision?.title_id ?? ''}
                                        options={options.revisionTitles ?? []}
                                        createRoute={route(
                                            'admin.quotation-revision-titles.store',
                                        )}
                                        catalogKey="revisionTitles"
                                        entityLabel="revision title"
                                        placeholder="Select a title"
                                        compact
                                        showCreateFooter
                                        error={errorMessage(
                                            validationErrors,
                                            `revisions.${index}.title_id`,
                                        )}
                                        onChange={(titleId) =>
                                            setValue(
                                                `revisions.${index}.title_id`,
                                                titleId,
                                            )
                                        }
                                    />
                                    <CreatableSelect
                                        id={`quotation-revision-status-${index}`}
                                        label="Status"
                                        value={revision?.status_id ?? ''}
                                        options={options.revisionStatuses ?? []}
                                        createRoute={route(
                                            'admin.quotation-revision-statuses.store',
                                        )}
                                        catalogKey="revisionStatuses"
                                        entityLabel="revision status"
                                        placeholder="Select a status"
                                        compact
                                        showCreateFooter
                                        error={errorMessage(
                                            validationErrors,
                                            `revisions.${index}.status_id`,
                                        )}
                                        onChange={(statusId) =>
                                            setValue(
                                                `revisions.${index}.status_id`,
                                                statusId,
                                            )
                                        }
                                    />
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
                                            htmlFor={`quotation-revision-responsible-${index}`}
                                            value="Responsible"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <select
                                            id={`quotation-revision-responsible-${index}`}
                                            value={
                                                revision?.responsible_user_id ??
                                                ''
                                            }
                                            onChange={(event) =>
                                                setValue(
                                                    `revisions.${index}.responsible_user_id`,
                                                    event.target.value,
                                                )
                                            }
                                            className={`${inputClassName} min-w-0 max-w-full`}
                                        >
                                            <option value="">
                                                Select a user
                                            </option>
                                            {revisionResponsibleOptions.map(
                                                (user) => (
                                                    <option
                                                        key={user.id}
                                                        value={String(user.id)}
                                                    >
                                                        {user.name}
                                                    </option>
                                                ),
                                            )}
                                            {revision?.responsible_user_id &&
                                            !revisionResponsibleOptions.some(
                                                (user) =>
                                                    String(user.id) ===
                                                    revision.responsible_user_id,
                                            ) ? (
                                                <option
                                                    value={
                                                        revision.responsible_user_id
                                                    }
                                                    disabled
                                                >
                                                    {revisionResponsibleNames.get(
                                                        revision.responsible_user_id,
                                                    ) ?? 'Unavailable user'}
                                                </option>
                                            ) : null}
                                        </select>
                                        <InputError
                                            message={errorMessage(
                                                validationErrors,
                                                `revisions.${index}.responsible_user_id`,
                                            )}
                                        />
                                    </div>
                                    <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
                                        <InputLabel
                                            htmlFor={`quotation-revision-notes-${index}`}
                                            value="Notes"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <div className="flex min-w-0 items-start gap-2">
                                            <TextInput
                                                id={`quotation-revision-notes-${index}`}
                                                value={revision?.notes ?? ''}
                                                className={`${inputClassName} min-w-0 flex-1`}
                                                onChange={(event) =>
                                                    setValue(
                                                        `revisions.${index}.notes`,
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                className="h-11 shrink-0"
                                                aria-label={`Remove revision ${index + 1}`}
                                                onClick={() =>
                                                    setPendingDeleteRevision({
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
                                        <InputError
                                            message={errorMessage(
                                                validationErrors,
                                                `revisions.${index}.notes`,
                                            )}
                                        />
                                    </div>
                                    <div className="sm:col-span-2 xl:col-span-4">
                                        <RevisionReviewEmail
                                            quotationUuid={
                                                quotation?.uuid ?? ''
                                            }
                                            revisionId={revision?.id}
                                            revisionNumber={revision?.number}
                                            reviews={
                                                quotation?.revisions?.find(
                                                    (item) =>
                                                        String(item.id) ===
                                                        revision?.id,
                                                )?.reviews ?? []
                                            }
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section
                id="quotation-authorization"
                className={`${sectionClassName} flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5`}
            >
                <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold text-foreground">
                        Authorization
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Should this document include an authorization section
                        for signatures?
                    </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50/70 dark:has-[:checked]:border-emerald-900 dark:has-[:checked]:bg-emerald-950/30">
                        <input
                            type="radio"
                            name="include_authorization"
                            className="mt-1"
                            checked={data.include_authorization}
                            onChange={() =>
                                setValue('include_authorization', true)
                            }
                        />
                        <span>
                            <span className="block text-sm font-medium text-foreground">
                                Yes
                            </span>
                            <span className="mt-1 block text-sm text-muted-foreground">
                                Print signature lines for the company and the
                                customer.
                            </span>
                        </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50/70 dark:has-[:checked]:border-emerald-900 dark:has-[:checked]:bg-emerald-950/30">
                        <input
                            type="radio"
                            name="include_authorization"
                            className="mt-1"
                            checked={!data.include_authorization}
                            onChange={() =>
                                setValue('include_authorization', false)
                            }
                        />
                        <span>
                            <span className="block text-sm font-medium text-foreground">
                                No
                            </span>
                            <span className="mt-1 block text-sm text-muted-foreground">
                                Leave the authorization section off this
                                document.
                            </span>
                        </span>
                    </label>
                </div>
            </section>

            <AlertDialog
                open={pendingDeleteRevision !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDeleteRevision(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove revision?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove {pendingDeleteRevision?.name ? pendingDeleteRevision.name : `revision ${(pendingDeleteRevision?.index ?? 0) + 1}`}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (pendingDeleteRevision !== null) {
                                    removeRevision(pendingDeleteRevision.index);
                                    setPendingDeleteRevision(null);
                                }
                            }}
                        >
                            Remove revision
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <QuickProjectDialog
                show={projectDialogOpen}
                contractorId={data.contractor_id}
                contractorRole={partyRole}
                showContractorName={!data.contractor_id}
                allowPrice={canAddProjectPrice}
                onClose={() => setProjectDialogOpen(false)}
                onCreated={(project) => {
                    const priceIds = (project.prices ?? []).map((price) =>
                        String(price.id),
                    );

                    setValue('project_id', String(project.id), {
                        shouldValidate: true,
                    });
                    setValue('project_price_ids', priceIds);
                    setValue(
                        'project_amount',
                        priceIds.length === 0
                            ? ''
                            : priceAmount(project.prices ?? [], priceIds),
                    );
                }}
            />
            <QuickContractorContactDialog
                show={contactDialogOpen && Boolean(data.contractor_id)}
                contractorId={data.contractor_id}
                partyLabel={partyRole === 'owner' ? 'owner' : 'contractor'}
                onClose={() => setContactDialogOpen(false)}
                onCreated={(contactId) => {
                    const current = data.contact_ids ?? [];

                    if (!current.includes(contactId)) {
                        setValue('contact_ids', [...current, contactId]);
                    }
                }}
            />
        </form>
    );
}
