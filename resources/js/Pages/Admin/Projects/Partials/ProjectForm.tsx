import DateMaskInput from '@/Components/DateMaskInput';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import ContractorSelect from '@/Components/ContractorSelect';
import CreatableSelect from '@/Components/CreatableSelect';
import PhoneInput from '@/Components/PhoneInput';
import FormActionFab from '@/Components/FormActionFab';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import RichTextEditor from '@/Components/RichTextEditor';
import TextInput from '@/Components/TextInput';
import { addendumPdfText } from '@/lib/addendumPdfText';
import { notesToHtml } from '@/lib/notesHtml';
import { isEmptyHtml } from '@/Pages/Admin/Bids/bidText';
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
import {
    normalizePostalCode,
    optionalPostalCodeSchema,
} from '@/lib/postalCode';
import {
    normalizeStateInitials,
    optionalStateInitialsSchema,
    stateInitialsInputClassName,
} from '@/lib/stateInitials';
import { cn } from '@/lib/utils';
import { LoaderCircleIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useRef, useState } from 'react';
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
    blankAddendum,
    blankBidDate,
    bidDaysLeftLabel,
    blankContractor,
    blankPrice,
    blankRevision,
    blankScope,
    projectToFormData,
    type ProjectAddendumFormData,
    type ProjectBidDateFormData,
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

const optionalTimeSchema = z.string().refine(
    (value) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
    'Enter a valid time.',
);

const optionalMoneySchema = z.string().refine((value) => {
    if (value.trim() === '') {
        return true;
    }

    const amount = parseDecimal(value);

    return amount !== null && amount >= 0;
}, 'Budget amount must be zero or greater.');

const addendumDocumentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'txt'];

const addendumNotesAreBlank = (notes: string) =>
    !/<img\b/i.test(notes) && isEmptyHtml(notes);

const addendumDocumentSchema = z
    .custom<File | null>((value) => value === null || value instanceof File)
    .nullable()
    .refine(
        (file) => !file || file.size <= 20 * 1024 * 1024,
        'Document must be 20 MB or less.',
    )
    .refine((file) => {
        if (!file) {
            return true;
        }

        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

        return addendumDocumentExtensions.includes(extension);
    }, 'Use a PDF, Word, Excel, image, or text file.');

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
    const prioritySlugs = (options.priorityOptions ?? []).map((priority) => priority.slug);

    return z
        .object({
            name: canEditCoreFields
                ? z.string().trim().min(1, 'Enter the project name.').max(255)
                : z.string(),
            project_number: z.string().trim().max(255),
            assigned_to: z.string(),
            status_id: z.string().trim().min(1, 'Select a status.'),
            priority: z
                .string()
                .trim()
                .min(1, 'Select a priority.')
                .refine(
                    (value) => prioritySlugs.includes(value),
                    'Select a valid priority.',
                ),
            site_address_line_1: z.string().trim().max(255),
            site_address_line_2: z.string().trim().max(255),
            site_city: z.string().trim().max(255),
            site_state: optionalStateInitialsSchema,
            site_postal_code: optionalPostalCodeSchema,
            site_country: z.string().trim().max(255),
            estimated_start_date: optionalDateSchema,
            estimated_end_date: optionalDateSchema,
            completed_at: optionalDateSchema,
            budget_amount: optionalMoneySchema,
            prices: z.array(
                z.object({
                    id: z.string(),
                    label: z
                        .string()
                        .trim()
                        .max(255, 'Price description must be 255 characters or less.'),
                    amount: optionalMoneySchema,
                }),
            ),
            public_notes: z
                .string()
                .trim()
                .max(60000, 'Project notes must be 60,000 characters or less.'),
            internal_notes: z
                .string()
                .trim()
                .max(60000, 'Internal notes must be 60,000 characters or less.'),
            company_uuids: z.array(z.string()),
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
            bid_dates: z.array(
                z.object({
                    id: z.string(),
                    bid_date: optionalDateSchema,
                    bid_time: optionalTimeSchema,
                    notes: z
                        .string()
                        .trim()
                        .max(2000, 'Bid date notes must be 2,000 characters or less.'),
                    user_id: z.string(),
                    user_name: z.string(),
                }),
            ),
            addendums: z.array(
                z.object({
                    id: z.string(),
                    number: z
                        .string()
                        .trim()
                        .max(50, 'Addendum number must be 50 characters or less.'),
                    issued_on: optionalDateSchema,
                    notes: z
                        .string()
                        .trim()
                        .max(60000, 'Addendum notes must be 60,000 characters or less.'),
                    document_name: z.string(),
                    document_url: z.string(),
                    document: addendumDocumentSchema,
                    remove_document: z.boolean(),
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

            values.prices.forEach((price, index) => {
                const label = price.label.trim();
                const amount = price.amount.trim();

                if (label === '' && amount === '') {
                    return;
                }

                if (label === '') {
                    context.addIssue({
                        code: 'custom',
                        path: ['prices', index, 'label'],
                        message:
                            'Enter what this price covers, such as 2 windows.',
                    });
                }

                if (amount === '') {
                    context.addIssue({
                        code: 'custom',
                        path: ['prices', index, 'amount'],
                        message: 'Enter the amount for this price.',
                    });
                }
            });

            if (!canEditCoreFields) {
                return;
            }

            const seenCompanies = new Map<string, number>();
            values.company_uuids.forEach((uuid, index) => {
                const companyUuid = uuid.trim();

                if (companyUuid === '') {
                    return;
                }

                const firstIndex = seenCompanies.get(companyUuid);

                if (firstIndex !== undefined) {
                    context.addIssue({
                        code: 'custom',
                        path: ['company_uuids', index],
                        message: 'This company is already added.',
                    });
                } else {
                    seenCompanies.set(companyUuid, index);
                }
            });

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

            const seenBidDates = new Map<string, number>();
            values.bid_dates.forEach((bidDate, index) => {
                const date = bidDate.bid_date.trim();
                const notes = bidDate.notes.trim();
                const time = bidDate.bid_time.trim();

                if (date === '' && notes === '' && time === '') {
                    return;
                }

                if (date === '') {
                    context.addIssue({
                        code: 'custom',
                        path: ['bid_dates', index, 'bid_date'],
                        message: 'Enter the bid date.',
                    });

                    return;
                }

                const firstIndex = seenBidDates.get(date);

                if (firstIndex !== undefined) {
                    context.addIssue({
                        code: 'custom',
                        path: ['bid_dates', index, 'bid_date'],
                        message: 'This bid date is already on the list. Add the new date instead.',
                    });
                } else {
                    seenBidDates.set(date, index);
                }
            });

            const seenAddendums = new Map<string, number>();
            values.addendums.forEach((addendum, index) => {
                const number = addendum.number.trim().toLowerCase();
                const issuedOn = addendum.issued_on.trim();
                const notes = addendumNotesAreBlank(addendum.notes)
                    ? ''
                    : addendum.notes.trim();
                const hasDocument =
                    addendum.document !== null ||
                    (addendum.document_name.trim() !== '' && !addendum.remove_document);

                if (number === '' && issuedOn === '' && notes === '' && !hasDocument) {
                    return;
                }

                if (number === '') {
                    context.addIssue({
                        code: 'custom',
                        path: ['addendums', index, 'number'],
                        message: 'Enter the addendum number.',
                    });

                    return;
                }

                const firstIndex = seenAddendums.get(number);

                if (firstIndex !== undefined) {
                    context.addIssue({
                        code: 'custom',
                        path: ['addendums', index, 'number'],
                        message: 'This addendum is already on the list.',
                    });
                } else {
                    seenAddendums.set(number, index);
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
    const [addendumReadNote, setAddendumReadNote] = useState<Record<string, string>>({});
    const [readingAddendum, setReadingAddendum] = useState<Record<string, boolean>>({});
    const addendumReadRequest = useRef<Record<string, number>>({});
    const addendumCardRefs = useRef<Array<HTMLDivElement | null>>([]);
    const companyRowRefs = useRef<Array<HTMLDivElement | null>>([]);
    const [companyFocusIndex, setCompanyFocusIndex] = useState<number | null>(null);
    const scrollToAddendum = useRef<number | null>(null);
    const [checkingName, setCheckingName] = useState(false);
    const [nameTaken, setNameTaken] = useState(false);
    const nameCheckRequest = useRef(0);
    const canEditCoreFields = options.can.create || options.can.update;
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
        getValues,
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
    const {
        fields: bidDateFields,
        prepend: prependBidDate,
        remove: removeBidDate,
    } = useFieldArray({
        control,
        name: 'bid_dates',
    });
    const {
        fields: addendumFields,
        append: appendAddendum,
        remove: removeAddendum,
    } = useFieldArray({
        control,
        name: 'addendums',
    });
    const {
        fields: priceFields,
        append: appendPrice,
        remove: removePrice,
    } = useFieldArray({
        control,
        name: 'prices',
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

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void checkProjectNameAvailability(data.name);
        }, 350);

        return () => window.clearTimeout(timer);
    }, [data.name]);

    const submit = handleSubmit(
        async (values) => {
        const nameIsAvailable = await checkProjectNameAvailability(values.name);

        if (!nameIsAvailable) {
            toast.error('A project with this name already exists.');
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { budget_amount: _budgetAmount, ...projectValues } = values;
        const payload = {
            ...projectValues,
            ...(canViewSensitive
                ? {
                      prices: values.prices
                          .filter(
                              (price) =>
                                  price.label.trim() !== '' ||
                                  price.amount.trim() !== '',
                          )
                          .map((price) => ({
                              id: price.id.trim() || null,
                              label: price.label,
                              amount: inputToDecimal(price.amount) || null,
                          })),
                  }
                : {}),
            company_uuids: (values.company_uuids ?? []).filter((uuid) => uuid.trim() !== ''),
            contractors: (values.contractors ?? []).filter(
                (contractor) =>
                    contractor.contractor_id.trim() !== '' ||
                    contractor.company_name.trim() !== '',
            ),
            scopes: (values.scopes ?? [])
                .filter((scope) => scope.type.trim() !== '')
                .map((scope) => ({
                    type: scope.type,
                    notes: '',
                })),
            revisions: (values.revisions ?? [])
                .filter((revision) => revision.number.trim() !== '')
                .map((revision) => ({
                    id: revision.id.trim() || null,
                    number: revision.number,
                    revision_date: revision.revision_date,
                    notes: revision.notes,
                })),
            bid_dates: (values.bid_dates ?? [])
                .filter(
                    (bidDate) =>
                        bidDate.bid_date.trim() !== '' ||
                        bidDate.notes.trim() !== '' ||
                        bidDate.bid_time.trim() !== '',
                )
                .map((bidDate) => ({
                    id: bidDate.id.trim() || null,
                    bid_date: bidDate.bid_date,
                    bid_time: bidDate.bid_time,
                    notes: bidDate.notes,
                })),
            addendums: (values.addendums ?? [])
                .filter(
                    (addendum) =>
                        addendum.number.trim() !== '' ||
                        addendum.issued_on.trim() !== '' ||
                        !addendumNotesAreBlank(addendum.notes) ||
                        addendum.document !== null ||
                        (addendum.document_name.trim() !== '' && !addendum.remove_document),
                )
                .map((addendum) => ({
                    id: addendum.id.trim() || null,
                    number: addendum.number,
                    issued_on: addendum.issued_on,
                    notes: addendumNotesAreBlank(addendum.notes) ? '' : addendum.notes,
                    remove_document: addendum.remove_document,
                    ...(addendum.document ? { document: addendum.document } : {}),
                })),
        };
        const hasAddendumDocument = payload.addendums.some(
            (addendum) => addendum.document instanceof File,
        );
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

        if (hasAddendumDocument) {
            router.post(
                action,
                method === 'patch' ? { ...payload, _method: 'patch' } : payload,
                { ...submitOptions, forceFormData: true },
            );
            return;
        }

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
    const addButtonClassName =
        'border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white';
    const manageButtonClassName =
        'border-sky-800 bg-sky-700 text-white hover:bg-sky-800 hover:text-white';
    const removeButtonClassName =
        'h-11 border-rose-700 bg-rose-600 text-white hover:bg-rose-700 hover:text-white';
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
    const setBidDateData = (
        index: number,
        field: keyof ProjectBidDateFormData,
        value: string,
    ) => {
        setData(
            `bid_dates.${index}.${field}` as FieldPath<ProjectFormData>,
            value as PathValue<ProjectFormData, FieldPath<ProjectFormData>>,
        );
    };
    const setAddendumData = (
        index: number,
        field: keyof ProjectAddendumFormData,
        value: string,
    ) => {
        setData(
            `addendums.${index}.${field}` as FieldPath<ProjectFormData>,
            value as PathValue<ProjectFormData, FieldPath<ProjectFormData>>,
        );
    };
    const readAddendumFile = async (index: number, fieldId: string, file: File) => {
        const requestId = (addendumReadRequest.current[fieldId] ?? 0) + 1;
        addendumReadRequest.current[fieldId] = requestId;
        setReadingAddendum((current) => ({ ...current, [fieldId]: true }));
        setAddendumReadNote((notes) => ({ ...notes, [fieldId]: '' }));

        try {
            const token = decodeURIComponent(
                window.document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '',
            );
            const body = new FormData();
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

            if (isPdf) {
                body.append('text', await addendumPdfText(file));
                body.append('filename', file.name);
            } else {
                body.append('document', file);
            }

            const response = await fetch(route('admin.projects.addendums.read'), {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body,
                signal: AbortSignal.timeout(15000),
            });
            const json = await response.json().catch(() => ({}));

            if (addendumReadRequest.current[fieldId] !== requestId) {
                return;
            }

            if (!response.ok) {
                const raw = String(json.errors?.document?.[0] ?? json.message ?? '');
                const message = /maximum execution time/i.test(raw)
                    ? 'Reading this addendum took too long. Try again, or type the details by hand.'
                    : (raw || 'This document could not be read. Fill the addendum by hand.');
                setAddendumReadNote((notes) => ({ ...notes, [fieldId]: message }));

                return;
            }

            const current = getValues(`addendums.${index}`);
            const filled: string[] = [];

            if (json.number && current.number.trim() === '') {
                setAddendumData(index, 'number', String(json.number));
                filled.push(`addendum ${json.number}`);
            }

            if (json.issued_on && (current.issued_on ?? '') !== String(json.issued_on)) {
                setAddendumData(index, 'issued_on', String(json.issued_on));
                filled.push(`issued ${json.issued_on}`);
            }

            if (json.notes && isEmptyHtml(current.notes)) {
                setAddendumData(index, 'notes', String(json.notes));
                filled.push('notes');
            }

            let bidMessage = '';

            if (
                json.bid_date &&
                !getValues('bid_dates').some((row) => row.bid_date === json.bid_date)
            ) {
                prependBidDate({
                    ...blankBidDate(currentUserId, auth.user?.name ?? ''),
                    bid_date: String(json.bid_date),
                    bid_time: json.bid_time ? String(json.bid_time) : '',
                    notes: json.number ? `Moved by addendum ${json.number}` : 'Moved by an addendum',
                });
                bidMessage = ` The revised bid date ${json.bid_date} was added under Bid dates.`;
            }

            const summary = filled.length > 0
                ? `Filled ${filled.join(', ')} from the document.${bidMessage}`
                : json.readable
                    ? `Nothing new to fill from this document.${bidMessage}`.trim()
                    : 'No text was found in this file. If it is a scan or a picture, type the addendum details.';

            setAddendumReadNote((notes) => ({
                ...notes,
                [fieldId]: summary,
            }));
        } catch (error) {
            if (addendumReadRequest.current[fieldId] !== requestId) {
                return;
            }

            const timedOut = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');

            setAddendumReadNote((notes) => ({
                ...notes,
                [fieldId]: timedOut
                    ? 'This file is too large to read without freezing the page. Type the addendum date by hand.'
                    : 'This document could not be read. Fill the addendum by hand.',
            }));
        } finally {
            if (addendumReadRequest.current[fieldId] === requestId) {
                setReadingAddendum((current) => ({ ...current, [fieldId]: false }));
            }
        }
    };

    useEffect(() => {
        const index = scrollToAddendum.current;

        if (index === null) {
            return;
        }

        const card = addendumCardRefs.current[index];

        if (!card) {
            return;
        }

        scrollToAddendum.current = null;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => {
            window.document.getElementById(`project-addendum-document-${index}`)?.focus();
        }, 350);
    }, [addendumFields.length]);
    useEffect(() => {
        if (companyFocusIndex === null) {
            return;
        }

        companyRowRefs.current[companyFocusIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    }, [companyFocusIndex, data.company_uuids.length]);
    const currentBidDate = data.bid_dates
        .map((bidDate) => bidDate.bid_date)
        .filter((bidDate) => bidDate !== '')
        .sort()
        .at(-1);

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="flex w-full min-w-0 max-w-full flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6">
                    <FormActionFab
                        cancelHref={route('admin.projects.index')}
                        saveLabel={submitLabel}
                        disabled={processing || nameTaken || checkingName}
                    />
                    <section className="flex flex-col gap-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                        {canEditCoreFields && (
                            <div className="flex justify-end">
                                <div className="flex w-full max-w-xs flex-col items-end gap-2 lg:w-80">
                                    <InputLabel
                                        htmlFor="project-number"
                                        value="Project number"
                                        className={`${labelClassName} text-right`}
                                    />
                                    <TextInput
                                        id="project-number"
                                        value={data.project_number}
                                        className={`${inputClassName} text-right`}
                                        onChange={(event) =>
                                            setData(
                                                'project_number',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <p className="text-right text-sm text-muted-foreground">
                                        Leave blank to assign the next number,
                                        such as GDS-2026-0001.
                                    </p>
                                    <InputError
                                        className="text-right"
                                        message={errors.project_number}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="grid items-start gap-5 xl:grid-cols-2">
                            {canEditCoreFields && (
                                <div className="flex flex-col gap-2 xl:col-span-2">
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
                            )}

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

                            <CreatableSelect
                                id="project-priority"
                                label="Priority"
                                compact
                                value={String(
                                    options.priorityOptions.find(
                                        (priority) =>
                                            priority.slug === data.priority,
                                    )?.id ?? '',
                                )}
                                options={options.priorityOptions}
                                createRoute={route(
                                    'admin.project-priorities.store',
                                )}
                                catalogKey="priorityOptions"
                                entityLabel="priority"
                                placeholder="Low, Normal, High..."
                                error={errors.priority}
                                onChange={(_id, option) =>
                                    setData('priority', option?.slug ?? '')
                                }
                            />

                            {canEditCoreFields && (
                                <CreatableSelect
                                    id="assigned-to"
                                    label="Assigned to"
                                    compact
                                    allowCreate={false}
                                    value={data.assigned_to}
                                    options={options.assignees}
                                    placeholder="Unassigned"
                                    error={errors.assigned_to}
                                    onChange={(assigneeId) =>
                                        setData('assigned_to', assigneeId)
                                    }
                                />
                            )}
                        </div>


                        {canEditCoreFields && (
                            <div className="grid items-start gap-5 rounded-lg border border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30 p-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-4">
                                    <h3 className="text-base font-semibold text-foreground">
                                        Address
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Site location where the project work
                                        will happen.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2 xl:col-span-2">
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
                                <div className="flex flex-col gap-2 xl:col-span-2">
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
                                <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="site-state"
                                            value="State"
                                            className={labelClassName}
                                        />
                                        <TextInput
                                            id="site-state"
                                            value={data.site_state}
                                            className={cn(
                                                inputClassName,
                                                stateInitialsInputClassName,
                                            )}
                                            autoComplete="address-level1"
                                            autoCapitalize="characters"
                                            maxLength={2}
                                            size={2}
                                            placeholder="PA"
                                            onChange={(event) =>
                                                setData(
                                                    'site_state',
                                                    normalizeStateInitials(
                                                        event.target.value,
                                                    ),
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
                                            autoComplete="postal-code"
                                            maxLength={15}
                                            placeholder="07102-1234"
                                            onChange={(event) =>
                                                setData(
                                                    'site_postal_code',
                                                    normalizePostalCode(
                                                        event.target.value,
                                                    ),
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
                        )}

                        <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
                    </section>

                        {canEditCoreFields && (
                            <section className="flex flex-col gap-4 rounded-xl border border-orange-200 bg-orange-50/70 p-5 dark:border-orange-900 dark:bg-orange-950/30">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        Bid dates
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Keep every bid date. When the date changes, add the new date here. The latest date stays the current bid date, and the days left update as you type the date. Opens at is the time the bid opens.
                                    </p>
                                </div>

                                {bidDateFields.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                                        No bid dates added yet.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {bidDateFields.map((field, index) => {
                                            const bidDate = data.bid_dates[index];
                                            const isCurrent =
                                                bidDate?.bid_date !== '' &&
                                                bidDate?.bid_date === currentBidDate;

                                            return (
                                                <div
                                                    key={field.id}
                                                    className="grid min-w-0 items-start gap-4 rounded-lg border border-border bg-muted/10 p-4 md:grid-cols-2 xl:grid-cols-[minmax(10rem,0.85fr)_minmax(8.5rem,0.6fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto]"
                                                >
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-bid-date-${index}`}
                                                            value={isCurrent ? 'Bid date · Current' : 'Bid date'}
                                                            className={labelClassName}
                                                        />
                                                        <DateMaskInput
                                                            id={`project-bid-date-${index}`}
                                                            value={bidDate?.bid_date ?? ''}
                                                            className={inputClassName}
                                                            onValueChange={(value) =>
                                                                setBidDateData(
                                                                    index,
                                                                    'bid_date',
                                                                    value,
                                                                )
                                                            }
                                                        />
                                                        <InputError
                                                            message={errorMessage(
                                                                validationErrors,
                                                                `bid_dates.${index}.bid_date`,
                                                            )}
                                                        />
                                                        {bidDaysLeftLabel(
                                                            bidDate?.bid_date,
                                                            bidDate?.bid_time,
                                                        ) ? (
                                                            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                                                {bidDaysLeftLabel(
                                                                    bidDate?.bid_date,
                                                                    bidDate?.bid_time,
                                                                )}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-bid-time-${index}`}
                                                            value="Opens at"
                                                            className={labelClassName}
                                                        />
                                                        <TextInput
                                                            id={`project-bid-time-${index}`}
                                                            type="time"
                                                            step={60}
                                                            value={bidDate?.bid_time ?? ''}
                                                            className={inputClassName}
                                                            aria-label="Bid opening time"
                                                            onChange={(event) =>
                                                                setBidDateData(
                                                                    index,
                                                                    'bid_time',
                                                                    event.target.value,
                                                                )
                                                            }
                                                        />
                                                        <InputError
                                                            message={errorMessage(
                                                                validationErrors,
                                                                `bid_dates.${index}.bid_time`,
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-bid-date-notes-${index}`}
                                                            value="Notes"
                                                            className={labelClassName}
                                                        />
                                                        <TextInput
                                                            id={`project-bid-date-notes-${index}`}
                                                            value={bidDate?.notes ?? ''}
                                                            className={inputClassName}
                                                            placeholder="Add a note"
                                                            onChange={(event) =>
                                                                setBidDateData(
                                                                    index,
                                                                    'notes',
                                                                    event.target.value,
                                                                )
                                                            }
                                                        />
                                                        <InputError
                                                            message={errorMessage(
                                                                validationErrors,
                                                                `bid_dates.${index}.notes`,
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-bid-date-user-${index}`}
                                                            value="Recorded by"
                                                            className={labelClassName}
                                                        />
                                                        <TextInput
                                                            id={`project-bid-date-user-${index}`}
                                                            value={bidDate?.user_name ?? ''}
                                                            disabled
                                                            readOnly
                                                            className={`${inputClassName} cursor-not-allowed bg-muted`}
                                                        />
                                                    </div>
                                                    <div className="flex items-start lg:pt-7">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className={removeButtonClassName}
                                                            onClick={() => removeBidDate(index)}
                                                            aria-label={`Remove bid date ${index + 1}`}
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
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        prependBidDate(
                                            blankBidDate(
                                                currentUserId,
                                                auth.user?.name ?? '',
                                            ),
                                        )
                                    }
                                    className={`ml-auto h-8 w-auto px-3 text-xs ${addButtonClassName}`}
                                >
                                    <PlusIcon className="size-3.5" />
                                    Add bid date
                                </Button>
                            </section>
                        )}

                        {canEditCoreFields && (
                            <section className="flex flex-col gap-4 rounded-xl border border-violet-200 bg-violet-50/70 p-5 dark:border-violet-900 dark:bg-violet-950/30">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        Addendums
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Choose the addendum file first. The number, issued date, and notes are filled from the document, and a revised bid date is added when the file states one.
                                    </p>
                                </div>

                                {addendumFields.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                                        No addendums added yet.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {addendumFields.map((field, index) => {
                                            const addendum = data.addendums[index];

                                            return (
                                                <div
                                                    key={field.id}
                                                    ref={(node) => {
                                                        addendumCardRefs.current[index] = node;
                                                    }}
                                                    className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-muted/10 p-4"
                                                >
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-addendum-document-${index}`}
                                                            value="Choose file"
                                                            className={labelClassName}
                                                        />
                                                        <input
                                                            id={`project-addendum-document-${index}`}
                                                            type="file"
                                                            disabled={readingAddendum[field.id] === true}
                                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                                                            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
                                                            onChange={(event) => {
                                                                const file = event.target.files?.[0] ?? null;
                                                                const extension = file?.name.split('.').pop()?.toLowerCase() ?? '';

                                                                if (
                                                                    file &&
                                                                    (!addendumDocumentExtensions.includes(extension) ||
                                                                        file.size > 20 * 1024 * 1024)
                                                                ) {
                                                                    event.target.value = '';
                                                                    setValue(
                                                                        `addendums.${index}.document`,
                                                                        null,
                                                                        { shouldDirty: true },
                                                                    );
                                                                    setError(
                                                                        `addendums.${index}.document`,
                                                                        {
                                                                            type: 'manual',
                                                                            message: file.size > 20 * 1024 * 1024
                                                                                ? 'Document must be 20 MB or less.'
                                                                                : 'Use a PDF, Word, Excel, image, or text file.',
                                                                        },
                                                                    );
                                                                    return;
                                                                }

                                                                clearErrors(`addendums.${index}.document`);
                                                                setValue(
                                                                    `addendums.${index}.document`,
                                                                    file,
                                                                    { shouldDirty: true },
                                                                );
                                                                setValue(
                                                                    `addendums.${index}.remove_document`,
                                                                    false,
                                                                    { shouldDirty: true },
                                                                );

                                                                if (file) {
                                                                    void readAddendumFile(index, field.id, file);
                                                                }
                                                            }}
                                                        />
                                                        <InputError
                                                            message={errorMessage(
                                                                validationErrors,
                                                                `addendums.${index}.document`,
                                                            )}
                                                        />
                                                        {readingAddendum[field.id] ? (
                                                            <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                                                <LoaderCircleIcon className="size-4 animate-spin" />
                                                                Reading the addendum. Please wait.
                                                            </p>
                                                        ) : addendumReadNote[field.id] ? (
                                                            <p className="text-sm text-muted-foreground">{addendumReadNote[field.id]}</p>
                                                        ) : null}
                                                        {addendum?.document ? (
                                                            <div className="flex flex-col gap-2 text-sm">
                                                                <div className="flex flex-wrap items-center gap-3">
                                                                    <span className="font-medium text-foreground">
                                                                        {addendum.document.name}
                                                                    </span>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="h-9"
                                                                        onClick={() => {
                                                                            const input = window.document.getElementById(
                                                                                `project-addendum-document-${index}`,
                                                                            ) as HTMLInputElement | null;
                                                                            if (input) {
                                                                                input.value = '';
                                                                            }
                                                                            setValue(
                                                                                `addendums.${index}.document`,
                                                                                null,
                                                                                { shouldDirty: true },
                                                                            );
                                                                            setAddendumReadNote((notes) => {
                                                                                const next = { ...notes };
                                                                                delete next[field.id];

                                                                                return next;
                                                                            });
                                                                        }}
                                                                    >
                                                                        Clear selected file
                                                                    </Button>
                                                                </div>
                                                                {addendum.document_url && !addendum.remove_document ? (
                                                                    <p className="text-muted-foreground">
                                                                        This file replaces {addendum.document_name || 'the saved document'} when you save.
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                        {addendum?.document_url && !addendum.remove_document && !addendum.document ? (
                                                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                                                <a
                                                                    href={addendum.document_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="font-medium text-emerald-800 underline dark:text-emerald-200"
                                                                >
                                                                    {addendum.document_name || 'Open document'}
                                                                </a>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    className="h-9"
                                                                    onClick={() =>
                                                                        setValue(
                                                                            `addendums.${index}.remove_document`,
                                                                            true,
                                                                            { shouldDirty: true },
                                                                        )
                                                                    }
                                                                >
                                                                    Remove saved document
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                        {addendum?.remove_document ? (
                                                            <p className="text-sm text-muted-foreground">
                                                                The saved document will be removed when you save the project.
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <div className="grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(8rem,0.7fr)_minmax(10rem,0.9fr)_minmax(0,1fr)_auto]">
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-addendum-number-${index}`}
                                                            value="Addendum"
                                                            className={labelClassName}
                                                        />
                                                        <TextInput
                                                            id={`project-addendum-number-${index}`}
                                                            value={addendum?.number ?? ''}
                                                            className={inputClassName}
                                                            placeholder="1, 2, 3"
                                                            onChange={(event) =>
                                                                setAddendumData(
                                                                    index,
                                                                    'number',
                                                                    event.target.value,
                                                                )
                                                            }
                                                        />
                                                        <InputError
                                                            message={errorMessage(
                                                                validationErrors,
                                                                `addendums.${index}.number`,
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-addendum-date-${index}`}
                                                            value="Issued on"
                                                            className={labelClassName}
                                                        />
                                                        <TextInput
                                                            id={`project-addendum-date-${index}`}
                                                            type="date"
                                                            value={addendum?.issued_on ?? ''}
                                                            className={inputClassName}
                                                            onChange={(event) =>
                                                                setAddendumData(
                                                                    index,
                                                                    'issued_on',
                                                                    event.target.value,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-addendum-user-${index}`}
                                                            value="Recorded by"
                                                            className={labelClassName}
                                                        />
                                                        <TextInput
                                                            id={`project-addendum-user-${index}`}
                                                            value={addendum?.user_name ?? ''}
                                                            disabled
                                                            readOnly
                                                            className={`${inputClassName} cursor-not-allowed bg-muted`}
                                                        />
                                                    </div>
                                                    <div className="flex items-start lg:pt-7">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className={removeButtonClassName}
                                                            onClick={() => removeAddendum(index)}
                                                            aria-label={`Remove addendum ${index + 1}`}
                                                        >
                                                            <Trash2Icon className="size-4" />
                                                            Remove
                                                        </Button>
                                                    </div>
                                                    </div>
                                                    <div className="flex min-w-0 flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`project-addendum-notes-${index}`}
                                                            value="Notes"
                                                            className={labelClassName}
                                                        />
                                                        <RichTextEditor
                                                            id={`project-addendum-notes-${index}`}
                                                            compact
                                                            value={notesToHtml(addendum?.notes ?? '')}
                                                            onChange={(html) =>
                                                                setAddendumData(index, 'notes', html)
                                                            }
                                                            placeholder="Notes"
                                                            error={errorMessage(
                                                                validationErrors,
                                                                `addendums.${index}.notes`,
                                                            )}
                                                            showPlaceholders={false}
                                                            allowSideToolbar={false}
                                                        />
                                                        <InputError
                                                            message={errorMessage(
                                                                validationErrors,
                                                                `addendums.${index}.notes`,
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        scrollToAddendum.current = addendumFields.length;
                                        appendAddendum(
                                            blankAddendum(
                                                currentUserId,
                                                auth.user?.name ?? '',
                                            ),
                                        );
                                    }}
                                    className={`ml-auto h-8 w-auto px-3 text-xs ${addButtonClassName}`}
                                >
                                    <PlusIcon className="size-3.5" />
                                    Add addendum
                                </Button>
                            </section>
                        )}

                        {canEditCoreFields && (
                            <section className="flex flex-col gap-4 rounded-xl border p-5 border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        Companies
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Add each company on this job. Choose one company per row.
                                    </p>
                                </div>
                                {options.companies.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No companies yet. Add them in the Contact Directory.
                                    </p>
                                ) : data.company_uuids.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                                        No companies added yet.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {data.company_uuids.map((uuid, index) => (
                                            <div
                                                key={`project-company-row-${index}`}
                                                ref={(node) => {
                                                    companyRowRefs.current[index] = node;
                                                }}
                                                className="grid items-start gap-4 rounded-lg border border-border bg-background p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                                            >
                                                <CreatableSelect
                                                    id={`project-company-${index}`}
                                                    label="Company"
                                                    compact
                                                    allowCreate={false}
                                                    autoFocus={companyFocusIndex === index}
                                                    value={uuid}
                                                    options={options.companies.map((company) => ({
                                                        id: company.uuid,
                                                        name: company.name,
                                                    }))}
                                                    disabledIds={data.company_uuids.filter(
                                                        (selected, selectedIndex) =>
                                                            selectedIndex !== index && selected !== '',
                                                    )}
                                                    placeholder="Select a company"
                                                    error={errorMessage(
                                                        validationErrors,
                                                        `company_uuids.${index}`,
                                                    )}
                                                    onChange={(companyUuid) => {
                                                        const next = [...data.company_uuids];
                                                        next[index] = companyUuid;
                                                        setData('company_uuids', next);
                                                    }}
                                                />
                                                <div className="flex items-start md:pt-7">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className={removeButtonClassName}
                                                        onClick={() =>
                                                            setData(
                                                                'company_uuids',
                                                                data.company_uuids.filter(
                                                                    (_selected, selectedIndex) =>
                                                                        selectedIndex !== index,
                                                                ),
                                                            )
                                                        }
                                                        aria-label={`Remove company ${index + 1}`}
                                                    >
                                                        <Trash2Icon className="size-4" />
                                                        Remove
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {options.companies.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setCompanyFocusIndex(data.company_uuids.length);
                                            setData('company_uuids', [...data.company_uuids, '']);
                                        }}
                                        className={`ml-auto h-8 w-auto px-3 text-xs ${addButtonClassName}`}
                                    >
                                        <PlusIcon className="size-3.5" />
                                        Add company
                                    </Button>
                                )}
                            </section>
                        )}

                        {canEditCoreFields && (
                            <section className="flex flex-col gap-4 rounded-xl border p-5 border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">
                                            Contractors
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Add contractors and their contacts
                                            for this job.
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
                                                className={`w-full sm:w-auto ${manageButtonClassName}`}
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
                                            className={`w-full sm:w-auto ${addButtonClassName}`}
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
                                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                                                            className={removeButtonClassName}
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

                        {canViewSensitive && (
                            <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">
                                            Prices
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Add a price for each option, such
                                            as one for 2 windows and another
                                            for 3 windows. Quotes and bids can
                                            use these prices.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className={addButtonClassName}
                                        onClick={() => appendPrice(blankPrice())}
                                    >
                                        <PlusIcon className="size-4" />
                                        Add price
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {priceFields.map((field, index) => (
                                        <div
                                            key={field.id}
                                            className="grid items-start gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
                                        >
                                            <div className="flex flex-col gap-2">
                                                <InputLabel
                                                    htmlFor={`price-label-${field.id}`}
                                                    value="What this price covers"
                                                    className={labelClassName}
                                                />
                                                <TextInput
                                                    id={`price-label-${field.id}`}
                                                    value={data.prices?.[index]?.label ?? ''}
                                                    className={inputClassName}
                                                    placeholder="2 windows"
                                                    onChange={(event) =>
                                                        setData(
                                                            `prices.${index}.label`,
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    message={
                                                        validationErrors.prices?.[index]?.label
                                                            ?.message
                                                    }
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <InputLabel
                                                    htmlFor={`price-amount-${field.id}`}
                                                    value="Amount"
                                                    className={labelClassName}
                                                />
                                                <MaskedDecimalInput
                                                    id={`price-amount-${field.id}`}
                                                    prefix="$"
                                                    value={data.prices?.[index]?.amount ?? ''}
                                                    className={inputClassName}
                                                    placeholder="0.00"
                                                    onChange={(value) =>
                                                        setData(
                                                            `prices.${index}.amount`,
                                                            value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    message={
                                                        validationErrors.prices?.[index]?.amount
                                                            ?.message
                                                    }
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className={removeButtonClassName}
                                                    onClick={() => removePrice(index)}
                                                    disabled={priceFields.length === 1}
                                                >
                                                    <Trash2Icon className="size-4" />
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {canEditCoreFields && (
                            <div className="flex flex-col gap-4 rounded-lg border border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">
                                            Scope of work
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Add a scope type.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => appendScope(blankScope())}
                                        className={`w-full sm:w-auto ${addButtonClassName}`}
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
                                                    </div>
                                                    <div className="flex items-start lg:pt-7">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className={removeButtonClassName}
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

                        {canEditCoreFields && (
                            <div className="flex flex-col gap-4 rounded-lg border border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30 p-4">
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
                                        className={`w-full sm:w-auto ${addButtonClassName}`}
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
                                                    className="grid min-w-0 items-start gap-4 rounded-lg border border-border bg-muted/10 p-4 md:grid-cols-2 xl:grid-cols-[minmax(8rem,0.7fr)_minmax(10rem,0.85fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]"
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
                                                            className={removeButtonClassName}
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

                    <section className="flex flex-col gap-5 rounded-xl border p-5 border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="public-notes"
                                value="Project notes"
                                className={labelClassName}
                            />
                            <RichTextEditor
                                id="public-notes"
                                value={data.public_notes}
                                onChange={(html) => setData('public_notes', html)}
                                placeholder="Project notes"
                                error={errors.public_notes}
                                showPlaceholders={false}
                                allowSideToolbar={false}
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
                                <RichTextEditor
                                    id="internal-notes"
                                    value={data.internal_notes}
                                    onChange={(html) =>
                                        setData('internal_notes', html)
                                    }
                                    placeholder="Internal notes"
                                    error={errors.internal_notes}
                                    showPlaceholders={false}
                                    allowSideToolbar={false}
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
