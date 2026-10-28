import CreatableSelect, { type CreatableOption } from '@/Components/CreatableSelect';
import ReceiptCamera from '@/Components/ReceiptCamera';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { PageProps } from '@/types';
import { cn } from '@/lib/utils';
import { useForm, usePage } from '@inertiajs/react';
import { BanknoteIcon, CameraIcon, PlusIcon, ReceiptIcon, ShoppingBagIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type PaymentRow = {
    id: number;
    due_on: string;
    paid_on: string | null;
    amount: string;
    status: 'paid' | 'scheduled';
    status_label: string;
    method: string;
    method_label: string;
};

type PaymentDraft = {
    id: number | null;
    due_on: string;
    paid_on: string;
    amount: string;
    status: 'paid' | 'scheduled';
    method: string;
};

export type ExpenseRecord = {
    id: number;
    spent_on: string;
    person_name: string;
    payee: string;
    description: string;
    category: string;
    category_label: string;
    group_name: string;
    amount: string;
    notes: string | null;
    receipt_name: string | null;
    receipt_url: string | null;
    receipt_preview_url: string | null;
    payments: PaymentRow[];
};

type ExpenseFormProps = {
    action: string;
    title: string;
    description: string;
    expense?: ExpenseRecord | null;
    people: CreatableOption[];
    categoryChoices: CreatableOption[];
    groups: CreatableOption[];
    payees: CreatableOption[];
    paymentStatuses: Record<string, string>;
    paymentMethods: Record<string, string>;
};

const money = (value: string) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value || 0));

const today = () => {
    const date = new Date();

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const addMonths = (iso: string, count: number) => {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1 + count, 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const blankPayment = (amount = ''): PaymentDraft => ({
    id: null,
    due_on: today(),
    paid_on: '',
    amount,
    status: 'scheduled',
    method: 'card',
});

const fieldClass =
    'h-11 w-full rounded-md border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm dark:[color-scheme:dark]';

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const receiptTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const shrinkReceiptPhoto = (file: File) => new Promise<File>((resolve) => {
    const looksLikeImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name);

    if (!looksLikeImage || file.size <= 1_500_000) {
        resolve(file);

        return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
        const longest = Math.max(image.width, image.height);
        const scale = longest > 2000 ? 2000 / longest : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');

        if (!context) {
            URL.revokeObjectURL(url);
            resolve(file);

            return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const finish = (quality: number) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    URL.revokeObjectURL(url);
                    resolve(file);

                    return;
                }

                if (blob.size > 4_500_000 && quality > 0.5) {
                    finish(Number((quality - 0.12).toFixed(2)));

                    return;
                }

                URL.revokeObjectURL(url);
                const name = file.name.replace(/\.\w+$/, '') || 'receipt';
                resolve(new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
            }, 'image/jpeg', quality);
        };

        finish(0.82);
    };

    image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
    };

    image.src = url;
});

const isRealDate = (value: string) => {
    const match = value.match(datePattern);

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const amountError = (value: string, label: string) => {
    const trimmed = value.trim();

    if (trimmed === '') {
        return `Enter the ${label}.`;
    }

    const amount = Number(trimmed);

    if (!Number.isFinite(amount)) {
        return `Enter the ${label} as a number.`;
    }

    if (amount < 0.01) {
        return `The ${label} must be at least $0.01.`;
    }

    if (amount > 99999999.99) {
        return `The ${label} is too large.`;
    }

    return null;
};

function expenseFieldErrors(
    data: {
        spent_on: string;
        person_name: string;
        payee: string;
        description: string;
        category: string;
        group_name: string;
        amount: string;
        notes: string;
        receipt: File | null;
        payments: PaymentDraft[];
    },
    paymentStatuses: Record<string, string>,
    paymentMethods: Record<string, string>,
    oneTime: boolean,
) {
    const errors: Record<string, string> = {};
    const payee = data.payee.trim();
    const description = data.description.trim();
    const totalError = amountError(data.amount, 'total amount');
    const person = data.person_name.trim();
    const category = data.category.trim();
    const groupName = data.group_name.trim();

    if (!isRealDate(data.spent_on)) {
        errors.spent_on = 'Enter the purchase date.';
    }

    if (person === '') {
        errors.person_name = 'Enter the person this expense is for.';
    } else if (person.length > 160) {
        errors.person_name = 'The person name must be 160 characters or fewer.';
    }

    if (payee === '') {
        errors.payee = 'Enter who was paid.';
    } else if (payee.length > 160) {
        errors.payee = 'Who was paid must be 160 characters or fewer.';
    }

    if (description === '') {
        errors.description = 'Enter what this purchase was for.';
    } else if (description.length > 255) {
        errors.description = 'What it was for must be 255 characters or fewer.';
    }

    if (category === '') {
        errors.category = 'Choose a category or add one.';
    } else if (category.length > 80) {
        errors.category = 'Category must be 80 characters or fewer.';
    }

    if (groupName.length > 160) {
        errors.group_name = 'Group must be 160 characters or fewer.';
    }

    if (totalError) {
        errors.amount = totalError;
    }

    if (data.notes.length > 2000) {
        errors.notes = 'Notes must be 2,000 characters or fewer.';
    }

    if (data.receipt) {
        const allowedName = /\.(pdf|jpe?g|png|webp|gif)$/i.test(data.receipt.name);

        if (data.receipt.type !== '' && !receiptTypes.has(data.receipt.type) && !allowedName) {
            errors.receipt = 'Use a PDF or a picture (JPEG, PNG, WEBP, or GIF).';
        } else if (data.receipt.size > 5 * 1024 * 1024) {
            errors.receipt = 'The receipt must be 5 MB or smaller.';
        }
    }

    if (data.payments.length > 60) {
        errors.payments = 'An expense can have at most 60 payments.';
    }

    if (oneTime) {
        return errors;
    }

    data.payments.forEach((payment, index) => {
        const paymentAmount = amountError(payment.amount, 'payment amount');

        if (!isRealDate(payment.due_on)) {
            errors[`payments.${index}.due_on`] = 'Enter the due date.';
        }

        if (paymentAmount) {
            errors[`payments.${index}.amount`] = paymentAmount;
        }

        if (!Object.prototype.hasOwnProperty.call(paymentStatuses, payment.status)) {
            errors[`payments.${index}.status`] = 'Choose whether this payment is paid or still due.';
        }

        if (!Object.prototype.hasOwnProperty.call(paymentMethods, payment.method)) {
            errors[`payments.${index}.method`] = 'Choose how this payment is made.';
        }

        if (payment.status === 'paid' && !isRealDate(payment.paid_on)) {
            errors[`payments.${index}.paid_on`] = 'Enter the date this payment was sent.';
        }
    });

    return errors;
}

function ReceiptPicture({
    src,
    alt,
    pdfUrl,
    pdfName,
}: {
    src: string;
    alt: string;
    pdfUrl?: string | null;
    pdfName?: string | null;
}) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        const close = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        window.addEventListener('keydown', close);

        return () => window.removeEventListener('keydown', close);
    }, [open]);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className="inline-block text-left">
                <img
                    src={src}
                    alt={alt}
                    className="max-h-40 max-w-full rounded-md border border-border object-contain"
                />
            </button>
            {open ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={alt}>
                    <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close receipt" onClick={() => setOpen(false)} />
                    <div className="relative z-10 grid max-h-[90vh] w-full max-w-4xl justify-items-center gap-3">
                        <img src={src} alt={alt} className="max-h-[78vh] w-auto max-w-full rounded-md bg-white object-contain" />
                        <div className="flex flex-wrap justify-center gap-2">
                            {pdfUrl ? (
                                <a href={pdfUrl} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
                                    Open PDF{pdfName ? ` (${pdfName})` : ''}
                                </a>
                            ) : null}
                            <button type="button" className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 text-sm text-foreground" onClick={() => setOpen(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

function ChosenReceiptPreview({ file }: { file: File | null }) {
    const [url, setUrl] = useState<string | null>(null);
    const isImage = Boolean(file && (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name)));
    const isPdf = Boolean(file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)));

    useEffect(() => {
        if (!file || (!isImage && !isPdf)) {
            setUrl(null);

            return;
        }

        const next = URL.createObjectURL(file);
        setUrl(next);

        return () => URL.revokeObjectURL(next);
    }, [file, isImage, isPdf]);

    if (!url || !file) {
        return null;
    }

    if (isPdf) {
        return (
            <iframe
                title={file.name}
                src={url}
                className="h-40 w-full rounded-md border border-border bg-white"
            />
        );
    }

    return <ReceiptPicture src={url} alt={file.name || 'Selected receipt'} />;
}

function FormSection({
    icon,
    title,
    hint,
    className,
    children,
}: {
    icon: ReactNode;
    title: string;
    hint: string;
    className: string;
    children: ReactNode;
}) {
    return (
        <section className={cn('grid gap-3 rounded-xl border p-4 text-foreground', className)}>
            <div className="flex items-start gap-2">
                <span className="mt-0.5">{icon}</span>
                <div>
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                    <p className="text-sm text-muted-foreground">{hint}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

const paymentsFromExpense = (expense?: ExpenseRecord | null): PaymentDraft[] => {
    if (!expense || expense.payments.length === 0) {
        return [blankPayment(expense?.amount ?? '')];
    }

    return expense.payments.map((payment) => ({
        id: payment.id,
        due_on: payment.due_on,
        paid_on: payment.paid_on ?? '',
        amount: payment.amount,
        status: payment.status,
        method: payment.method,
    }));
};

export default function ExpenseForm({
    action,
    title,
    description,
    expense = null,
    people,
    categoryChoices,
    groups,
    payees,
    paymentStatuses,
    paymentMethods,
}: ExpenseFormProps) {
    const page = usePage<PageProps>();
    const currentPerson = page.props.auth.user?.name ?? '';
    const [addedPeople, setAddedPeople] = useState<CreatableOption[]>([]);
    const [addedCategories, setAddedCategories] = useState<CreatableOption[]>([]);
    const [addedGroups, setAddedGroups] = useState<CreatableOption[]>([]);
    const [addedPayees, setAddedPayees] = useState<CreatableOption[]>([]);
    const [oneTime, setOneTime] = useState(!expense || expense.payments.length <= 1);
    const [onceStatus, setOnceStatus] = useState<PaymentDraft['status']>(expense?.payments[0]?.status ?? 'scheduled');
    const [months, setMonths] = useState('3');
    const [firstDue, setFirstDue] = useState(expense?.spent_on || today());
    const form = useForm({
        spent_on: expense?.spent_on || today(),
        person_name: expense?.person_name || currentPerson,
        payee: expense?.payee ?? '',
        description: expense?.description ?? '',
        category: expense?.category || 'course',
        group_name: expense?.group_name ?? '',
        amount: expense?.amount ?? '',
        notes: expense?.notes ?? '',
        receipt: null as File | null,
        remove_receipt: false,
        payments: paymentsFromExpense(expense),
    });
    const fieldError = (key: string) => (form.errors as Record<string, string | undefined>)[key];
    const paymentTotal = form.data.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const expenseCents = Math.round((Number(form.data.amount) || 0) * 100);
    const paymentCents = Math.round(paymentTotal * 100);
    const unassignedCents = expenseCents - paymentCents;
    const paymentBalance = unassignedCents === 0
        ? 'These payments add up to the total.'
        : unassignedCents > 0
            ? `${money((unassignedCents / 100).toFixed(2))} of the total is not on a payment yet.`
            : `Payments are ${money((Math.abs(unassignedCents) / 100).toFixed(2))} over the total.`;
    const personOptions = useMemo(() => {
        const options = [...people, ...addedPeople];
        const names = new Set(options.map((option) => option.name.trim().toLowerCase()));

        if (currentPerson !== '' && !names.has(currentPerson.trim().toLowerCase())) {
            options.unshift({ id: -1, name: currentPerson });
        }

        return options;
    }, [people, addedPeople, currentPerson]);
    const selectedPerson = personOptions.find(
        (option) => option.name.trim().toLowerCase() === form.data.person_name.trim().toLowerCase(),
    );
    const categoryOptions = useMemo(
        () => [...categoryChoices, ...addedCategories],
        [categoryChoices, addedCategories],
    );
    const groupOptions = useMemo(() => [...groups, ...addedGroups], [groups, addedGroups]);
    const selectedGroup = groupOptions.find(
        (option) => option.name.trim().toLowerCase() === form.data.group_name.trim().toLowerCase(),
    );
    const selectedCategory = categoryOptions.find((option) => {
        const stored = option.slug || option.name;

        return stored === form.data.category || option.name.trim().toLowerCase() === form.data.category.trim().toLowerCase();
    });
    const payeeOptions = useMemo(() => [...payees, ...addedPayees], [payees, addedPayees]);
    const selectedPayee = payeeOptions.find(
        (option) => option.name.trim().toLowerCase() === form.data.payee.trim().toLowerCase(),
    );
    const cameraRef = useRef<HTMLInputElement>(null);
    const receiptRef = useRef<HTMLInputElement>(null);
    const [scanner, setScanner] = useState<MediaStream | null>(null);
    const scannerRef = useRef<MediaStream | null>(null);

    useEffect(() => () => {
        scannerRef.current?.getTracks().forEach((track) => track.stop());
    }, []);

    const attachReceipt = (file: File) => {
        void shrinkReceiptPhoto(file).then((next) => {
            form.setData('receipt', next);
            form.setData('remove_receipt', false);
        });
    };

    const openScanner = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            cameraRef.current?.click();

            return;
        }

        try {
            const next = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
            });
            scannerRef.current = next;
            setScanner(next);
        } catch {
            cameraRef.current?.click();
        }
    };

    const closeScanner = () => {
        scannerRef.current?.getTracks().forEach((track) => track.stop());
        scannerRef.current = null;
        setScanner(null);
    };

    const chooseReceipt = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        event.target.value = '';

        if (!file) {
            return;
        }

        attachReceipt(file);
    };

    const addPerson = (name: string) => {
        const trimmed = name.trim();
        const existing = personOptions.find(
            (option) => option.name.trim().toLowerCase() === trimmed.toLowerCase(),
        );

        if (existing) {
            form.setData('person_name', existing.name);

            return;
        }

        setAddedPeople((current) => [...current, { id: -Date.now(), name: trimmed }]);
        form.setData('person_name', trimmed);
    };

    const addNamedOption = (
        name: string,
        options: CreatableOption[],
        setAdded: (update: (current: CreatableOption[]) => CreatableOption[]) => void,
        field: 'category' | 'payee' | 'group_name',
    ) => {
        const trimmed = name.trim();
        const existing = options.find(
            (option) => (option.slug || option.name).trim().toLowerCase() === trimmed.toLowerCase()
                || option.name.trim().toLowerCase() === trimmed.toLowerCase(),
        );

        if (existing) {
            form.setData(field, existing.slug || existing.name);

            return;
        }

        const option = { id: -Date.now(), name: trimmed, slug: trimmed };
        setAdded((current) => [...current, option]);
        form.setData(field, option.slug || trimmed);
    };

    const updatePayment = (index: number, patch: Partial<PaymentDraft>) => {
        form.setData(
            'payments',
            form.data.payments.map((payment, paymentIndex) =>
                paymentIndex === index ? { ...payment, ...patch } : payment,
            ),
        );
    };

    const splitMonthly = () => {
        const countMonths = Math.min(36, Math.max(2, Number(months) || 0));
        const totalCents = Math.round((Number(form.data.amount) || 0) * 100);

        if (countMonths < 2 || totalCents < countMonths) {
            return;
        }

        const base = Math.floor(totalCents / countMonths);
        const remainder = totalCents - base * countMonths;
        const method = form.data.payments[0]?.method || 'card';

        form.setData(
            'payments',
            Array.from({ length: countMonths }, (_, index) => ({
                id: null,
                due_on: addMonths(firstDue, index),
                paid_on: '',
                amount: ((index === countMonths - 1 ? base + remainder : base) / 100).toFixed(2),
                status: 'scheduled' as const,
                method,
            })),
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const errors = expenseFieldErrors(form.data, paymentStatuses, paymentMethods, oneTime);
        form.clearErrors();

        if (Object.keys(errors).length > 0) {
            form.setError(errors as Parameters<typeof form.setError>[0]);

            return;
        }

        form.transform((data) => {
            const currentPayment = data.payments.length === 1 ? data.payments[0] : null;
            const payments = oneTime
                ? [{
                    id: currentPayment?.id ?? null,
                    due_on: data.spent_on,
                    paid_on: onceStatus === 'paid' ? (currentPayment?.paid_on || data.spent_on) : '',
                    amount: data.amount,
                    status: onceStatus,
                    method: currentPayment?.method || 'other',
                }]
                : data.payments;
            const payload: Record<string, unknown> = {
                ...data,
                remove_receipt: data.remove_receipt ? 1 : 0,
                payments: payments.map((payment) => ({
                    due_on: payment.due_on,
                    paid_on: payment.status === 'paid' ? payment.paid_on || payment.due_on : '',
                    amount: payment.amount,
                    status: payment.status,
                    method: payment.method,
                    ...(payment.id ? { id: payment.id } : {}),
                })),
            };

            if (!data.receipt) {
                delete payload.receipt;
            }

            return payload;
        });

        form.post(action, {
            forceFormData: true,
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-foreground">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} noValidate className="grid gap-6 pb-28 text-foreground">
                    <FormActionFab
                        cancelHref={route('admin.expenses.index')}
                        saveLabel="Save expense"
                        disabled={form.processing}
                    />
                    <FormSection
                        icon={<ShoppingBagIcon className="size-4 text-emerald-700 dark:text-emerald-300" />}
                        title="What was bought"
                        hint="Who the expense is for, who was paid, and what it cost. The person starts as you."
                        className="border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30"
                    >
                        <CreatableSelect
                            id="expense-group"
                            label="Group"
                            value={selectedGroup ? String(selectedGroup.id) : ''}
                            options={groupOptions}
                            allowCreate
                            showCreateFooter
                            entityLabel="group"
                            placeholder="Course in Maryland"
                            error={form.errors.group_name}
                            onCreateName={(name) => addNamedOption(name, groupOptions, setAddedGroups, 'group_name')}
                            onChange={(_id, option) => form.setData('group_name', option?.name ?? '')}
                        />
                        <div className="grid items-end gap-x-3 gap-y-4 sm:grid-cols-2">
                            <CreatableSelect
                                id="expense-person"
                                label="Person"
                                value={selectedPerson ? String(selectedPerson.id) : ''}
                                options={personOptions}
                                allowCreate
                                showCreateFooter
                                entityLabel="person"
                                placeholder="Type a name"
                                error={form.errors.person_name}
                                onCreateName={addPerson}
                                onChange={(_id, option) => form.setData('person_name', option?.name ?? '')}
                            />
                            <CreatableSelect
                                id="expense-payee"
                                label="Paid to"
                                value={selectedPayee ? String(selectedPayee.id) : ''}
                                options={payeeOptions}
                                allowCreate
                                showCreateFooter
                                entityLabel="payee"
                                placeholder="Type who was paid"
                                error={form.errors.payee}
                                onCreateName={(name) => addNamedOption(name, payeeOptions, setAddedPayees, 'payee')}
                                onChange={(_id, option) => form.setData('payee', option?.name ?? '')}
                            />
                            <CreatableSelect
                                id="expense-category"
                                label="Category"
                                value={selectedCategory ? String(selectedCategory.id) : ''}
                                options={categoryOptions}
                                allowCreate
                                showCreateFooter
                                entityLabel="category"
                                placeholder="Type a category"
                                error={form.errors.category}
                                onCreateName={(name) => addNamedOption(name, categoryOptions, setAddedCategories, 'category')}
                                onChange={(_id, option) => form.setData('category', option?.slug || option?.name || '')}
                            />
                            <label className="grid gap-2 text-sm font-medium text-foreground">
                                What it was for
                                <input
                                    value={form.data.description}
                                    onChange={(event) => form.setData('description', event.target.value)}
                                    maxLength={255}
                                    aria-invalid={Boolean(form.errors.description)}
                                    className={fieldClass}
                                />
                                <InputError message={form.errors.description} />
                            </label>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="grid w-[11.5rem] max-w-full shrink-0 gap-2 text-sm font-medium text-foreground">
                                Date
                                <input
                                    type="date"
                                    value={form.data.spent_on}
                                    aria-invalid={Boolean(form.errors.spent_on)}
                                    onChange={(event) => form.setData('spent_on', event.target.value)}
                                    className={cn(fieldClass, 'w-[11.5rem] max-w-full')}
                                />
                                <InputError message={form.errors.spent_on} />
                            </label>
                            <label className="grid w-44 max-w-full shrink-0 gap-2 text-sm font-medium text-foreground">
                                Total amount
                                <MaskedDecimalInput
                                    id="expense-amount"
                                    value={form.data.amount}
                                    prefix="$"
                                    placeholder="0.00"
                                    className="h-11 w-full text-base text-foreground md:text-sm"
                                    onChange={(value) => form.setData('amount', value)}
                                />
                                <InputError message={form.errors.amount} />
                            </label>
                            <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[28rem] sm:flex-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    aria-pressed={oneTime && onceStatus === 'paid'}
                                    className={`min-h-11 whitespace-normal px-2 text-center text-xs leading-tight sm:text-sm ${oneTime && onceStatus === 'paid'
                                        ? 'border-sky-700 bg-sky-600 text-white hover:bg-sky-700 hover:text-white'
                                        : 'border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900'}`}
                                    onClick={() => {
                                        setOneTime(true);
                                        setOnceStatus('paid');
                                    }}
                                >
                                    Paid in full
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    aria-pressed={oneTime && onceStatus === 'scheduled'}
                                    className={`min-h-11 whitespace-normal px-2 text-center text-xs leading-tight sm:text-sm ${oneTime && onceStatus === 'scheduled'
                                        ? 'border-amber-700 bg-amber-600 text-white hover:bg-amber-700 hover:text-white'
                                        : 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900'}`}
                                    onClick={() => {
                                        setOneTime(true);
                                        setOnceStatus('scheduled');
                                    }}
                                >
                                    Will be paid
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    aria-pressed={!oneTime}
                                    className={`min-h-11 whitespace-normal px-2 text-center text-xs leading-tight sm:text-sm ${!oneTime
                                        ? 'border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white'
                                        : 'border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900'}`}
                                    onClick={() => {
                                        if (!oneTime) {
                                            return;
                                        }

                                        const first = form.data.payments[0];
                                        setOneTime(false);
                                        form.setData('payments', [{
                                            id: first?.id ?? null,
                                            due_on: form.data.spent_on || today(),
                                            paid_on: onceStatus === 'paid' ? (form.data.spent_on || today()) : '',
                                            amount: form.data.amount,
                                            status: onceStatus,
                                            method: first?.method || 'other',
                                        }]);
                                    }}
                                >
                                    Split payments
                                </Button>
                            </div>
                        </div>
                        <label className="grid gap-2 text-sm font-medium text-foreground">
                            Notes
                            <textarea
                                value={form.data.notes}
                                onChange={(event) => form.setData('notes', event.target.value)}
                                rows={2}
                                maxLength={2000}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm dark:[color-scheme:dark]"
                            />
                            <InputError message={form.errors.notes} />
                        </label>
                    </FormSection>

                    <FormSection
                        icon={<ReceiptIcon className="size-4 text-indigo-700 dark:text-indigo-300" />}
                        title="Receipt"
                        hint="Optional. On a phone, fit the receipt in the frame. The camera keeps the paper and drops the background. A photo is saved as a one-page PDF."
                        className="border-indigo-200 bg-indigo-50/80 dark:border-indigo-900 dark:bg-indigo-950/30"
                    >
                        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                            <div className="grid gap-3">
                                <input
                                    ref={cameraRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="sr-only"
                                    onChange={chooseReceipt}
                                />
                                <div className="grid gap-2 lg:hidden">
                                    <Button
                                        type="button"
                                        className="min-h-11 touch-manipulation border-indigo-800 bg-indigo-700 text-white hover:bg-indigo-800"
                                        onClick={() => void openScanner()}
                                    >
                                        <CameraIcon data-icon="inline-start" />
                                        Take a photo
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="min-h-11 touch-manipulation"
                                        onClick={() => receiptRef.current?.click()}
                                    >
                                        <UploadIcon data-icon="inline-start" />
                                        Upload a file
                                    </Button>
                                </div>
                                <input
                                    ref={receiptRef}
                                    type="file"
                                    accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                                    className="sr-only w-full text-sm text-foreground file:me-3 file:min-h-11 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-sm file:text-foreground lg:not-sr-only lg:block"
                                    onChange={chooseReceipt}
                                />
                                {scanner ? (
                                    <ReceiptCamera
                                        stream={scanner}
                                        onClose={closeScanner}
                                        onCapture={attachReceipt}
                                    />
                                ) : null}
                                <InputError message={form.errors.receipt} />
                                {expense?.receipt_name ? (
                                    <label className="inline-flex min-h-11 items-center gap-2 text-sm text-foreground">
                                        <input
                                            type="checkbox"
                                            checked={form.data.remove_receipt}
                                            onChange={(event) => form.setData('remove_receipt', event.target.checked)}
                                        />
                                        Remove current receipt ({expense.receipt_name})
                                    </label>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        A picture shows here as soon as you choose it. Click it to open it larger.
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preview</p>
                                <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-md border border-border bg-background p-2">
                                    {form.data.receipt ? (
                                        <ChosenReceiptPreview file={form.data.receipt} />
                                    ) : expense?.receipt_preview_url && !form.data.remove_receipt ? (
                                        <ReceiptPicture
                                            src={expense.receipt_preview_url}
                                            alt={expense.receipt_name || 'Receipt'}
                                            pdfUrl={expense.receipt_url}
                                            pdfName={expense.receipt_name}
                                        />
                                    ) : expense?.receipt_url && !form.data.remove_receipt ? (
                                        <a href={expense.receipt_url} target="_blank" rel="noopener" className="text-sm text-foreground underline">
                                            {expense.receipt_name || 'Open receipt'}
                                        </a>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No image yet</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </FormSection>

                    {oneTime ? null : (
                    <FormSection
                        icon={<BanknoteIcon className="size-4 text-amber-700 dark:text-amber-300" />}
                        title="Payments"
                        hint="Each row is one part of the total. Mark it paid when the money has been sent, or leave it to be paid later."
                        className="border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30"
                    >
                            <>
                                <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-amber-200 bg-background px-3 py-2 dark:border-amber-900">
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            On payments {money(paymentTotal.toFixed(2))} of {money(form.data.amount || '0')}
                                        </p>
                                        <p className={cn(
                                            'text-sm font-medium',
                                            unassignedCents === 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-100',
                                        )}>
                                            {paymentBalance}
                                        </p>
                                        <InputError message={fieldError('payments')} />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="min-h-11 touch-manipulation"
                                        onClick={() => form.setData('payments', [...form.data.payments, blankPayment()])}
                                    >
                                        <PlusIcon className="size-4" />
                                        Add payment
                                    </Button>
                                </div>
                                <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-amber-400 bg-background p-3">
                                    <p className="w-full text-sm font-semibold text-foreground">Split the total into monthly payments</p>
                                    <label className="grid w-24 shrink-0 gap-2 text-sm font-medium text-foreground">
                                        Months
                                        <input
                                            inputMode="numeric"
                                            value={months}
                                            onChange={(event) => setMonths(event.target.value)}
                                            className={fieldClass}
                                        />
                                    </label>
                                    <label className="grid w-[11.5rem] max-w-full shrink-0 gap-2 text-sm font-medium text-foreground">
                                        First due date
                                        <input
                                            type="date"
                                            value={firstDue}
                                            onChange={(event) => setFirstDue(event.target.value)}
                                            className={cn(fieldClass, 'w-[11.5rem] max-w-full')}
                                        />
                                    </label>
                                    <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={splitMonthly}>
                                        Split monthly
                                    </Button>
                                </div>
                                <div className="grid gap-3">
                                    {form.data.payments.map((payment, index) => (
                                        <div key={`${payment.id ?? 'new'}-${index}`} className="grid gap-2 rounded-lg border border-amber-200 bg-background p-3 text-foreground dark:border-amber-900">
                                            <p className="text-sm font-semibold text-foreground">Payment {index + 1}</p>
                                            <div className="flex flex-wrap items-end gap-2">
                                                <label className="grid w-[11.5rem] max-w-full shrink-0 gap-2 text-sm font-medium text-foreground">
                                                    Due
                                                    <input
                                                        type="date"
                                                        value={payment.due_on}
                                                        aria-invalid={Boolean(fieldError(`payments.${index}.due_on`))}
                                                        onChange={(event) => updatePayment(index, { due_on: event.target.value })}
                                                        className={cn(fieldClass, 'w-[11.5rem] max-w-full')}
                                                    />
                                                    <InputError message={fieldError(`payments.${index}.due_on`)} />
                                                </label>
                                                <label className="grid w-36 shrink-0 gap-2 text-sm font-medium text-foreground">
                                                    Amount
                                                    <MaskedDecimalInput
                                                        id={`payment-amount-${index}`}
                                                        value={payment.amount}
                                                        prefix="$"
                                                        placeholder="0.00"
                                                        className="h-11 w-full text-base text-foreground md:text-sm"
                                                        onChange={(value) => updatePayment(index, { amount: value })}
                                                    />
                                                    <InputError message={fieldError(`payments.${index}.amount`)} />
                                                </label>
                                                <label className="grid min-w-36 flex-1 gap-2 text-sm font-medium text-foreground">
                                                    Status
                                                    <select
                                                        value={payment.status}
                                                        aria-invalid={Boolean(fieldError(`payments.${index}.status`))}
                                                        onChange={(event) =>
                                                            updatePayment(index, {
                                                                status: event.target.value as PaymentDraft['status'],
                                                            })
                                                        }
                                                        className={fieldClass}
                                                    >
                                                        {Object.entries(paymentStatuses).map(([value, label]) => (
                                                            <option key={value} value={value}>{label}</option>
                                                        ))}
                                                    </select>
                                                    <InputError message={fieldError(`payments.${index}.status`)} />
                                                </label>
                                                <label className="grid min-w-36 flex-1 gap-2 text-sm font-medium text-foreground">
                                                    How we pay
                                                    <select
                                                        value={payment.method}
                                                        aria-invalid={Boolean(fieldError(`payments.${index}.method`))}
                                                        onChange={(event) => updatePayment(index, { method: event.target.value })}
                                                        className={fieldClass}
                                                    >
                                                        {Object.entries(paymentMethods).map(([value, label]) => (
                                                            <option key={value} value={value}>{label}</option>
                                                        ))}
                                                    </select>
                                                    <InputError message={fieldError(`payments.${index}.method`)} />
                                                </label>
                                            </div>
                                            {payment.status === 'paid' ? (
                                                <label className="grid w-[11.5rem] max-w-full shrink-0 gap-2 text-sm font-medium text-foreground">
                                                    Date paid
                                                    <input
                                                        type="date"
                                                        value={payment.paid_on}
                                                        aria-invalid={Boolean(fieldError(`payments.${index}.paid_on`))}
                                                        onChange={(event) => updatePayment(index, { paid_on: event.target.value })}
                                                        className={cn(fieldClass, 'w-[11.5rem] max-w-full')}
                                                    />
                                                    <InputError message={fieldError(`payments.${index}.paid_on`)} />
                                                </label>
                                            ) : null}
                                            {form.data.payments.length > 1 ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="min-h-11 w-fit touch-manipulation"
                                                    onClick={() =>
                                                        form.setData(
                                                            'payments',
                                                            form.data.payments.filter((_, paymentIndex) => paymentIndex !== index),
                                                        )
                                                    }
                                                >
                                                    <Trash2Icon className="size-4" />
                                                    Remove payment
                                                </Button>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </>
                    </FormSection>
                    )}
                </form>
            </CardContent>
        </Card>
    );
}
