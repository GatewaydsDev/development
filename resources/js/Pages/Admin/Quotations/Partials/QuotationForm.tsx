import CreatableSelect from '@/Components/CreatableSelect';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import { flushPendingTextAutoSaves } from '@/Components/TextAutoSave';
import TextInput from '@/Components/TextInput';
import DocumentPrintLayoutEditor from '@/Components/DocumentPrintLayoutEditor';
import { saveDocumentDraft } from '@/lib/saveDocumentDraft';
import QuotationReusableTextSection from './QuotationReusableTextSection';
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
import { router, usePage } from '@inertiajs/react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { type DragEvent, FormEventHandler, useMemo, useRef, useState } from 'react';
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
    notes: z.string().max(250000),
    print_layout_id: z.string(),
    print_layout_version: z.string(),
    layout_header: z.string().max(250000),
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
    const data = useWatch({
        control,
        defaultValue: defaultValues,
    }) as QuotationFormData;
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

    const quotationPayload = (values: QuotationFormData) => ({
        ...values,
        print_layout_id: values.print_layout_id || null,
        print_layout_version: values.print_layout_version || null,
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
                        if (!values)
                            throw new Error(
                                'Select or add the contractor/owner before saving and updating the layout.',
                            );
                        if (!(await flushPendingTextAutoSaves()))
                            throw new Error(
                                'The quotation text could not be saved. Try again before updating the layout.',
                            );
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
        void handleSubmit(async (values) => {
            clearErrors('contractor_id');
            const withParty = await ensureParty(values);
            if (withParty) await postQuotation(withParty);
        })(event);
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
            className="flex w-full min-w-0 max-w-full flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6"
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

                    <div className="flex flex-col gap-2 sm:col-span-2">
                        <InputLabel
                            value="Quoted for"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
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
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
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
                                variant="outline"
                                className="h-11 shrink-0"
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
                                has no contacts yet.
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

            <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5">
                <div>
                    <h3 className="text-base font-semibold text-foreground">
                        Total project amount
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Set the overall amount for the project. This is
                        separate from the quotation line-item total.
                    </p>
                </div>
                <div className="flex max-w-sm flex-col gap-2">
                    <InputLabel
                        htmlFor="project_amount"
                        value="Project amount"
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

            <section
                aria-labelledby="quotation-layout-header-title"
                className="flex min-w-0 flex-col gap-4"
            >
                <div>
                    <h3
                        id="quotation-layout-header-title"
                        className="text-base font-semibold"
                    >
                        Quotation layout header
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Load and customize a print layout header. Proposal and
                        pricing text stay unchanged.
                    </p>
                </div>
                <DocumentPrintLayoutEditor
                    document="quotation"
                    catalog={{
                        printLayouts: options.printLayouts ?? [],
                        assignedPrintLayoutId: options.assignedPrintLayoutId,
                    }}
                    layoutId={data.print_layout_id}
                    version={data.print_layout_version}
                    onLayoutChange={(id, version) => {
                        setValue('print_layout_id', id, { shouldDirty: true });
                        setValue('print_layout_version', version, {
                            shouldDirty: true,
                        });
                    }}
                    literals={{
                        company_name: options.company?.name ?? '',
                        company_speciality: options.company?.speciality ?? '',
                        company_legal_name: options.company?.legal_name ?? '',
                        company_address: options.company?.address ?? '',
                        company_phone: options.company?.phone ?? '',
                        company_email: options.company?.email ?? '',
                        company_contact_phone:
                            options.company?.contact_phone ?? '',
                        company_website: options.company?.website ?? '',
                        company_contact_url: options.company?.contact_url ?? '',
                    }}
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
                                                variant="outline"
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
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
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
        </form>
    );
}
