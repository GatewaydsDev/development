import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import PaginationNav, { type Paginator } from '@/Components/PaginationNav';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { cn } from '@/lib/utils';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { BanknoteIcon, PlusIcon, ReceiptIcon, SearchIcon, ShoppingBagIcon, Trash2Icon } from 'lucide-react';
import { FormEvent, useEffect, useState, type ReactNode } from 'react';

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

type ExpenseRow = {
    id: number;
    spent_on: string;
    payee: string;
    description: string;
    category: string;
    category_label: string;
    amount: string;
    notes: string | null;
    receipt_name: string | null;
    receipt_is_image: boolean;
    receipt_url: string | null;
    receipt_preview_url: string | null;
    recorded_by: string | null;
    paid_amount: string;
    scheduled_amount: string;
    payments: PaymentRow[];
};

type Props = {
    filters: {
        search: string;
        category: string;
    };
    categories: Record<string, string>;
    paymentStatuses: Record<string, string>;
    paymentMethods: Record<string, string>;
    total: string;
    paid: string;
    scheduled: string;
    count: number;
    expenses: Paginator & { data: ExpenseRow[] };
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
    'h-11 w-full rounded-md border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm';

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const receiptTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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
        payee: string;
        description: string;
        category: string;
        amount: string;
        notes: string;
        receipt: File | null;
        payments: PaymentDraft[];
    },
    categories: Record<string, string>,
    paymentStatuses: Record<string, string>,
    paymentMethods: Record<string, string>,
) {
    const errors: Record<string, string> = {};
    const payee = data.payee.trim();
    const description = data.description.trim();
    const totalError = amountError(data.amount, 'total amount');

    if (!isRealDate(data.spent_on)) {
        errors.spent_on = 'Enter the purchase date.';
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

    if (!Object.prototype.hasOwnProperty.call(categories, data.category)) {
        errors.category = 'Choose a category.';
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
                            <button type="button" className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 text-sm" onClick={() => setOpen(false)}>
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

    useEffect(() => {
        if (!file || !file.type.startsWith('image/')) {
            setUrl(null);

            return;
        }

        const next = URL.createObjectURL(file);
        setUrl(next);

        return () => URL.revokeObjectURL(next);
    }, [file]);

    if (!url) {
        return null;
    }

    return <ReceiptPicture src={url} alt={file?.name || 'Selected receipt'} />;
}

function Summary({
    label,
    value,
    hint,
    className,
}: {
    label: string;
    value: string;
    hint: string;
    className: string;
}) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1 rounded-lg border-l-4 bg-background px-3 py-2.5', className)}>
            <p className="text-sm font-semibold leading-snug">{label}</p>
            <p className="text-right text-xl font-semibold tabular-nums leading-none">{money(value)}</p>
            <p className="text-right text-xs text-muted-foreground">{hint}</p>
        </div>
    );
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
        <section className={cn('grid gap-3 rounded-xl border p-4', className)}>
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

export default function Index({
    filters,
    categories,
    paymentStatuses,
    paymentMethods,
    total,
    paid,
    scheduled,
    count,
    expenses,
}: Props) {
    const flash = usePage().props.flash as { success?: string | null } | undefined;
    const [search, setSearch] = useState(filters.search);
    const [category, setCategory] = useState(filters.category);
    const [editing, setEditing] = useState<ExpenseRow | null>(null);
    const [confirming, setConfirming] = useState<number | null>(null);
    const [months, setMonths] = useState('3');
    const [firstDue, setFirstDue] = useState(today());
    const form = useForm({
        spent_on: today(),
        payee: '',
        description: '',
        category: 'course',
        amount: '',
        notes: '',
        receipt: null as File | null,
        remove_receipt: false,
        payments: [blankPayment()] as PaymentDraft[],
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

    const applyFilters = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            route('admin.expenses.index'),
            { search, category },
            { preserveState: true, preserveScroll: true },
        );
    };

    const resetForm = () => {
        setEditing(null);
        form.setData({
            spent_on: today(),
            payee: '',
            description: '',
            category: 'course',
            amount: '',
            notes: '',
            receipt: null,
            remove_receipt: false,
            payments: [blankPayment()],
        });
        form.clearErrors();
    };

    const edit = (expense: ExpenseRow) => {
        setEditing(expense);
        setConfirming(null);
        form.setData({
            spent_on: expense.spent_on,
            payee: expense.payee,
            description: expense.description,
            category: expense.category,
            amount: expense.amount,
            notes: expense.notes ?? '',
            receipt: null,
            remove_receipt: false,
            payments: expense.payments.length
                ? expense.payments.map((payment) => ({
                      id: payment.id,
                      due_on: payment.due_on,
                      paid_on: payment.paid_on ?? '',
                      amount: payment.amount,
                      status: payment.status,
                      method: payment.method,
                  }))
                : [blankPayment(expense.amount)],
        });
        form.clearErrors();
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
        const errors = expenseFieldErrors(form.data, categories, paymentStatuses, paymentMethods);
        form.clearErrors();

        if (Object.keys(errors).length > 0) {
            form.setError(errors as Parameters<typeof form.setError>[0]);

            return;
        }

        form.transform((data) => {
            const payload: Record<string, unknown> = {
                ...data,
                remove_receipt: data.remove_receipt ? 1 : 0,
                payments: data.payments.map((payment) => ({
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

        const options = {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => resetForm(),
        };

        form.post(editing ? route('admin.expenses.update', editing.id) : route('admin.expenses.store'), options);
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                    Expenses
                </h2>
            }
        >
            <Head title="Expenses" />

            <div className="py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:py-8">
                <div className="mx-auto grid max-w-6xl min-w-0 gap-4 px-3 sm:gap-6 sm:px-6 lg:px-8">
                    <p className="text-sm text-muted-foreground">
                        Each expense has three parts: what was bought, the receipt, and the payments. Paid money and money still due stay separate.
                    </p>
                    {flash?.success ? (
                        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                            {flash.success}
                        </p>
                    ) : null}

                    <div className="grid gap-2 rounded-xl border border-[#c5d0dc] bg-[#eef3f8] p-2 sm:grid-cols-3 dark:border-border dark:bg-card">
                        <Summary
                            label="Expense total"
                            value={total}
                            hint={`${count} ${count === 1 ? 'purchase' : 'purchases'} in this view`}
                            className="border-emerald-600 text-emerald-950 dark:text-emerald-100"
                        />
                        <Summary
                            label="Paid"
                            value={paid}
                            hint="Already sent"
                            className="border-sky-600 text-sky-950 dark:text-sky-100"
                        />
                        <Summary
                            label="To be paid"
                            value={scheduled}
                            hint="Still due"
                            className="border-amber-600 text-amber-950 dark:text-amber-100"
                        />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ReceiptIcon className="size-4" />
                                {editing ? 'Edit expense' : 'New expense'}
                            </CardTitle>
                            <CardDescription>
                                Fill the purchase first. The receipt and the payment schedule are separate from that total.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} noValidate className="grid gap-6 pb-28">
                                <FormActionFab
                                    cancelHref={route('admin.expenses.index')}
                                    onCancel={resetForm}
                                    saveLabel="Save expense"
                                    disabled={form.processing}
                                />
                                <FormSection
                                    icon={<ShoppingBagIcon className="size-4 text-emerald-700" />}
                                    title="What was bought"
                                    hint="Who was paid, what the purchase was, and the full cost. This total does not change when you split payments."
                                    className="border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30"
                                >
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="grid gap-1 text-sm">
                                            Date
                                            <input
                                                type="date"
                                                value={form.data.spent_on}
                                                aria-invalid={Boolean(form.errors.spent_on)}
                                                onChange={(event) => form.setData('spent_on', event.target.value)}
                                                className={fieldClass}
                                            />
                                            <InputError message={form.errors.spent_on} />
                                        </label>
                                        <label className="grid gap-1 text-sm">
                                            Category
                                            <select
                                                value={form.data.category}
                                                onChange={(event) => form.setData('category', event.target.value)}
                                                className={fieldClass}
                                            >
                                                {Object.entries(categories).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                            <InputError message={form.errors.category} />
                                        </label>
                                        <label className="grid gap-1 text-sm">
                                            Paid to
                                            <input
                                                value={form.data.payee}
                                                onChange={(event) => form.setData('payee', event.target.value)}
                                                maxLength={160}
                                                aria-invalid={Boolean(form.errors.payee)}
                                                className={fieldClass}
                                            />
                                            <InputError message={form.errors.payee} />
                                        </label>
                                        <label className="grid gap-1 text-sm">
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
                                    <label className="grid max-w-xs gap-1 text-sm">
                                        Total amount
                                        <span className="text-xs font-normal text-muted-foreground">Full cost of this purchase.</span>
                                        <MaskedDecimalInput
                                            id="expense-amount"
                                            value={form.data.amount}
                                            prefix="$"
                                            placeholder="0.00"
                                            className="h-9 text-sm"
                                            onChange={(value) => form.setData('amount', value)}
                                        />
                                        <InputError message={form.errors.amount} />
                                    </label>
                                    <label className="grid gap-1 text-sm">
                                        Notes
                                        <textarea
                                            value={form.data.notes}
                                            onChange={(event) => form.setData('notes', event.target.value)}
                                            rows={2}
                                            maxLength={2000}
                                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
                                        />
                                        <InputError message={form.errors.notes} />
                                    </label>
                                </FormSection>

                                <FormSection
                                    icon={<ReceiptIcon className="size-4 text-indigo-700" />}
                                    title="Receipt"
                                    hint="Optional. A photo is saved as a one-page PDF. The picture stays separate from the payment list."
                                    className="border-indigo-200 bg-indigo-50/80 dark:border-indigo-900 dark:bg-indigo-950/30"
                                >
                                    <input
                                        type="file"
                                        accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                                        className="block w-full text-sm file:me-3 file:min-h-11 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-sm"
                                        onChange={(event) => form.setData('receipt', event.target.files?.[0] ?? null)}
                                    />
                                    <InputError message={form.errors.receipt} />
                                    <ChosenReceiptPreview file={form.data.receipt} />
                                    {editing?.receipt_preview_url && !form.data.receipt && !form.data.remove_receipt ? (
                                        <ReceiptPicture
                                            src={editing.receipt_preview_url}
                                            alt={editing.receipt_name || 'Receipt'}
                                            pdfUrl={editing.receipt_url}
                                            pdfName={editing.receipt_name}
                                        />
                                    ) : null}
                                    {editing?.receipt_name ? (
                                        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-foreground">
                                            <input
                                                type="checkbox"
                                                checked={form.data.remove_receipt}
                                                onChange={(event) => form.setData('remove_receipt', event.target.checked)}
                                            />
                                            Remove current receipt ({editing.receipt_name})
                                        </label>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            Click a picture to open it larger.
                                        </p>
                                    )}
                                </FormSection>

                                <FormSection
                                    icon={<BanknoteIcon className="size-4 text-amber-700" />}
                                    title="Payments"
                                    hint="Each row is one payment. Mark it paid when the money has been sent, or leave it to be paid later."
                                    className="border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30"
                                >
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
                                    <div className="grid gap-2 rounded-lg border border-dashed border-amber-400 bg-background p-3 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-end">
                                        <p className="text-sm font-semibold text-foreground sm:col-span-3">Split the total into monthly payments</p>
                                        <label className="grid gap-1 text-sm">
                                            Months
                                            <input
                                                inputMode="numeric"
                                                value={months}
                                                onChange={(event) => setMonths(event.target.value)}
                                                className={fieldClass}
                                            />
                                        </label>
                                        <label className="grid gap-1 text-sm">
                                            First due date
                                            <input
                                                type="date"
                                                value={firstDue}
                                                onChange={(event) => setFirstDue(event.target.value)}
                                                className={fieldClass}
                                            />
                                        </label>
                                        <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={splitMonthly}>
                                            Split monthly
                                        </Button>
                                    </div>
                                    <div className="grid gap-3">
                                        {form.data.payments.map((payment, index) => (
                                            <div key={`${payment.id ?? 'new'}-${index}`} className="grid gap-2 rounded-lg border border-amber-200 bg-background p-3 dark:border-amber-900">
                                                <p className="text-sm font-semibold text-foreground">Payment {index + 1}</p>
                                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                                    <label className="grid gap-1 text-sm">
                                                        Due
                                                        <input
                                                            type="date"
                                                            value={payment.due_on}
                                                            aria-invalid={Boolean(fieldError(`payments.${index}.due_on`))}
                                                            onChange={(event) => updatePayment(index, { due_on: event.target.value })}
                                                            className={fieldClass}
                                                        />
                                                        <InputError message={fieldError(`payments.${index}.due_on`)} />
                                                    </label>
                                                    <label className="grid gap-1 text-sm">
                                                        Amount
                                                        <MaskedDecimalInput
                                                            id={`payment-amount-${index}`}
                                                            value={payment.amount}
                                                            prefix="$"
                                                            placeholder="0.00"
                                                            className="h-9 text-sm"
                                                            onChange={(value) => updatePayment(index, { amount: value })}
                                                        />
                                                        <InputError message={fieldError(`payments.${index}.amount`)} />
                                                    </label>
                                                    <label className="grid gap-1 text-sm">
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
                                                    <label className="grid gap-1 text-sm">
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
                                                    <label className="grid max-w-xs gap-1 text-sm">
                                                        Date paid
                                                        <input
                                                            type="date"
                                                            value={payment.paid_on}
                                                            aria-invalid={Boolean(fieldError(`payments.${index}.paid_on`))}
                                                            onChange={(event) => updatePayment(index, { paid_on: event.target.value })}
                                                            className={fieldClass}
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
                                </FormSection>

                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Ledger</CardTitle>
                            <CardDescription>The purchase is on top. Paid and still due are on the right. The schedule is listed underneath.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            <form onSubmit={applyFilters} className="grid gap-2 rounded-lg border border-[#c5d0dc] bg-[#eef3f8] p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] dark:border-border dark:bg-muted/40">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#0a2540] sm:col-span-3 dark:text-foreground">Find an expense</p>
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search payee, description, or notes"
                                    className={fieldClass}
                                />
                                <select
                                    value={category}
                                    onChange={(event) => setCategory(event.target.value)}
                                    className={fieldClass}
                                    aria-label="Filter by category"
                                >
                                    <option value="">All categories</option>
                                    {Object.entries(categories).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <Button type="submit" variant="outline" size="sm" className="self-center">
                                    <SearchIcon data-icon="inline-start" />
                                    Search
                                </Button>
                            </form>

                            {expenses.data.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No expenses match this view.</p>
                            ) : (
                                <ul className="grid gap-3">
                                    {expenses.data.map((expense) => (
                                        <li key={expense.id} className="overflow-hidden rounded-xl border border-[#c5d0dc] dark:border-border">
                                            <div className="grid gap-3 border-b border-[#c5d0dc] bg-[#eef3f8] p-3 dark:border-border dark:bg-muted/40 lg:grid-cols-[minmax(0,1fr)_auto]">
                                                <div className="min-w-0">
                                                    <p className="break-words text-base font-semibold text-[#0a2540] dark:text-foreground">{expense.description}</p>
                                                    <p className="break-words text-sm text-[#111827] dark:text-muted-foreground">
                                                        {expense.spent_on} · {expense.payee}
                                                    </p>
                                                    <Badge variant="outline" className="mt-2 border-emerald-300 bg-white text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                                                        {expense.category_label}
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3 text-right">
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">Total</p>
                                                        <p className="text-sm font-semibold tabular-nums text-[#111827] dark:text-foreground">{money(expense.amount)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">Paid</p>
                                                        <p className="text-sm font-semibold tabular-nums text-[#111827] dark:text-foreground">{money(expense.paid_amount)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">To be paid</p>
                                                        <p className="text-sm font-semibold tabular-nums text-[#111827] dark:text-foreground">{money(expense.scheduled_amount)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid gap-3 p-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
                                                {expense.receipt_preview_url ? (
                                                    <ReceiptPicture
                                                        src={expense.receipt_preview_url}
                                                        alt={expense.receipt_name || 'Receipt'}
                                                        pdfUrl={expense.receipt_url}
                                                        pdfName={expense.receipt_name}
                                                    />
                                                ) : (
                                                    <div className="hidden text-xs text-muted-foreground sm:block">No receipt</div>
                                                )}
                                                <div className="min-w-0">
                                                    {expense.notes ? (
                                                        <p className="mb-3 whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{expense.notes}</p>
                                                    ) : null}
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment schedule</p>
                                                    {expense.payments.length > 0 ? (
                                                        <ul className="mt-2 grid gap-2">
                                                            {expense.payments.map((payment) => (
                                                                <li key={payment.id} className="grid items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]">
                                                                    <span className="text-[#111827] dark:text-foreground">{payment.due_on}</span>
                                                                    <span className="flex flex-wrap items-center gap-2">
                                                                        <Badge className={payment.status === 'paid'
                                                                            ? 'border-sky-300 bg-sky-100 text-sky-950 hover:bg-sky-100'
                                                                            : 'border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-100'}>
                                                                            {payment.status_label}
                                                                        </Badge>
                                                                        <span className="text-muted-foreground">{payment.method_label}</span>
                                                                    </span>
                                                                    <span className="font-semibold tabular-nums sm:text-right">{money(payment.amount)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="mt-2 text-sm text-muted-foreground">No payments recorded yet.</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
                                            <p className="text-xs text-muted-foreground">
                                                Recorded by {expense.recorded_by || 'a removed account'}
                                                {expense.receipt_url ? (
                                                    <>
                                                        {' '}
                                                        · <a href={expense.receipt_url} target="_blank" rel="noopener" className="underline">{expense.receipt_name || 'Receipt'}</a>
                                                    </>
                                                ) : null}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={() => edit(expense)}>
                                                    Edit
                                                </Button>
                                                {confirming === expense.id ? (
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        className="min-h-11 touch-manipulation"
                                                        onClick={() =>
                                                            router.delete(route('admin.expenses.destroy', expense.id), {
                                                                preserveScroll: true,
                                                                onFinish: () => setConfirming(null),
                                                            })
                                                        }
                                                    >
                                                        Confirm delete
                                                    </Button>
                                                ) : (
                                                    <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={() => setConfirming(expense.id)}>
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <PaginationNav paginator={expenses} itemLabel="expenses" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
